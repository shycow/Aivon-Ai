import { config } from "../../config.js";
import { enforceToolLimits, normalizeToolArgs } from "./guardrails.js";
import { getToolByName } from "../../tools/index.js";
import { insertToolEvent, updateToolRunStatus } from "../../db.js";

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let idx = 0;

  async function next() {
    const current = idx++;
    if (current >= items.length) return;
    const item = items[current];
    results[current] = await worker(item);
    await next();
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

export async function executeTools({ runId, proposals, approvedToolIds, gemini, onEvent }) {
  const limited = enforceToolLimits(proposals);

  const toRun = limited.filter((proposal) => {
    if (!proposal) return false;
    if (proposal.requiresApproval && !approvedToolIds.includes(proposal.id)) return false;
    return true;
  });

  if (!toRun.length) {
    await updateToolRunStatus(runId, "skipped");
    return [];
  }

  await updateToolRunStatus(runId, "running");

  const outputs = await runWithConcurrency(toRun, config.toolMaxParallel, async (proposal) => {
    const tool = getToolByName(proposal.tool);
    if (!tool) {
      const errorPayload = { id: proposal.id, tool: proposal.tool, error: "Unknown tool" };
      insertToolEvent({ runId, type: "tool_error", payload: errorPayload });
      if (onEvent) onEvent({ type: "tool_error", payload: errorPayload });
      return { id: proposal.id, tool: proposal.tool, error: "Unknown tool" };
    }

    const startPayload = { id: proposal.id, tool: tool.name, args: proposal.args };
    insertToolEvent({ runId, type: "tool_start", payload: startPayload });
    if (onEvent) onEvent({ type: "tool_start", payload: startPayload });

    try {
      const args = normalizeToolArgs(tool.inputSchema, proposal.args);
      const output = await tool.execute(args, {
        gemini,
        model: config.modelResponder
      });

      const resultPayload = { id: proposal.id, tool: tool.name, output };
      insertToolEvent({ runId, type: "tool_result", payload: resultPayload });
      if (onEvent) onEvent({ type: "tool_result", payload: resultPayload });
      return { id: proposal.id, tool: tool.name, output };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool failed";
      const errorPayload = { id: proposal.id, tool: tool.name, error: message };
      insertToolEvent({ runId, type: "tool_error", payload: errorPayload });
      if (onEvent) onEvent({ type: "tool_error", payload: errorPayload });
      return { id: proposal.id, tool: tool.name, error: message };
    }
  });

  await updateToolRunStatus(runId, "completed");
  return outputs;
}
