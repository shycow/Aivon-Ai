import { z } from "zod";
import { nanoid } from "nanoid";
import { config } from "../../config.js";

const PlanSchema = z.object({
  reasoningSummary: z.string().default(""),
  proposals: z
    .array(
      z.object({
        id: z.string(),
        tool: z.string(),
        args: z.record(z.any()).default({}),
        reason: z.string().default(""),
        riskLevel: z.string().default("low"),
        requiresApproval: z.boolean().default(true)
      })
    )
    .default([]),
  requiresApproval: z.boolean().default(true)
});

function summarizeTools(tools) {
  return tools
    .map((tool) => {
      const shape = tool.inputSchema?.shape ? Object.keys(tool.inputSchema.shape) : [];
      return `- ${tool.name}: ${tool.description}. Args: ${shape.join(", ") || "none"}`;
    })
    .join("\n");
}

export async function planTools({ gemini, userMessage, history, memories, tools }) {
  const systemPrompt = `${config.systemPrompt}\n\nYou are a planner. Produce JSON only with: reasoningSummary, proposals, requiresApproval.\nUse available tools only. Keep reasoningSummary short.\n`;
  const toolList = summarizeTools(tools);
  const memoryBlock = memories?.length
    ? `Relevant memories:\n${memories.map((m) => `- ${m.content}`).join("\n")}`
    : "";

  const plannerMessages = [
    { role: "user", content: `User message: ${userMessage}` },
    { role: "user", content: `Tools:\n${toolList}` },
    { role: "user", content: memoryBlock }
  ].filter((msg) => msg.content);

  const raw = await gemini.generateText({
    model: config.modelPlanner,
    systemPrompt,
    messages: [...history, ...plannerMessages]
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reasoningSummary: "", proposals: [], requiresApproval: false };
  }

  const result = PlanSchema.safeParse(parsed);
  if (!result.success) {
    return PlanSchema.parse({ reasoningSummary: "", proposals: [], requiresApproval: false });
  }

  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const proposals = result.data.proposals
    .map((proposal) => {
      const tool = toolMap.get(proposal.tool);
      if (!tool) return null;
      return {
        id: proposal.id || nanoid(),
        tool: proposal.tool,
        args: proposal.args || {},
        reason: proposal.reason || "",
        riskLevel: proposal.riskLevel || tool.riskLevel || "low",
        requiresApproval: tool.requiresApproval
      };
    })
    .filter(Boolean);

  return {
    reasoningSummary: result.data.reasoningSummary,
    proposals,
    requiresApproval: proposals.some((proposal) => proposal.requiresApproval)
  };
}
