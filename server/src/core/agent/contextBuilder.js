import { config } from "../../config.js";

function trimMessages(messages, maxChars) {
  const trimmed = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const size = msg.content?.length || 0;
    if (total + size > maxChars) break;
    trimmed.unshift(msg);
    total += size;
  }
  return trimmed;
}

export function buildResponderMessages({ history, memories, toolOutputs, userMessage }) {
  const memoryBlock = memories?.length
    ? `Relevant memories:\n${memories.map((m) => `- ${m.content}`).join("\n")}`
    : "";

  const toolBlock = toolOutputs?.length
    ? `Tool outputs:\n${toolOutputs
        .map((output, idx) => `Tool ${idx + 1} (${output.tool}): ${JSON.stringify(output.output || output.error)}`)
        .join("\n")}`
    : "";

  const messages = [
    ...trimMessages(history || [], 6000),
    ...(memoryBlock ? [{ role: "user", content: memoryBlock }] : []),
    ...(toolBlock ? [{ role: "user", content: toolBlock }] : []),
    { role: "user", content: userMessage }
  ];

  return messages;
}

export function buildSystemPrompt({ citations }) {
  if (!citations?.length) {
    return config.systemPrompt;
  }

  const sources = citations
    .map((source, idx) => `[${idx + 1}] ${source.title || source.url}`)
    .join("\n");

  return `${config.systemPrompt}\n\nWhen using external info, cite sources inline like [1], [2].\nSources list:\n${sources}`;
}