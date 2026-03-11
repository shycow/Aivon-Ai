import { config } from "../../config.js";
import { buildResponderMessages, buildSystemPrompt } from "./contextBuilder.js";

export async function streamResponse({ gemini, history, memories, toolOutputs, userMessage, citations, onToken }) {
  const systemPrompt = buildSystemPrompt({ citations });
  const messages = buildResponderMessages({ history, memories, toolOutputs, userMessage });

  let fullText = "";
  for await (const token of gemini.streamText({
    model: config.modelResponder,
    systemPrompt,
    messages
  })) {
    fullText += token;
    if (onToken) onToken(token);
  }

  return fullText;
}

export async function suggestMemories({ gemini, userMessage, assistantResponse }) {
  const prompt = `Suggest up to 3 memory items to store about the user. Output JSON array of objects with fields: content, type, confidence (0-1). Types: preference, profile, fact, project, note. Only suggest if clearly useful.`;
  const output = await gemini.generateText({
    model: config.modelResponder,
    systemPrompt: prompt,
    messages: [
      { role: "user", content: `User: ${userMessage}` },
      { role: "assistant", content: assistantResponse }
    ]
  });

  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map((item) => ({
        content: String(item.content || "").trim(),
        type: String(item.type || "note").trim(),
        confidence: Number(item.confidence || 0.5)
      })).filter((item) => item.content.length > 0);
    }
  } catch {
    return [];
  }

  return [];
}