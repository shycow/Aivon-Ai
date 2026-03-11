import { GoogleGenerativeAI } from "@google/generative-ai";

function buildContents({ systemPrompt, messages }) {
  const contents = [];

  if (systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: `System instruction: ${systemPrompt}` }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will follow this instruction." }]
    });
  }

  for (const msg of messages || []) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    });
  }

  return contents;
}

export function buildGeminiClient({ apiKey }) {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Set it in .env and restart server.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    async generateText({ model, systemPrompt, messages }) {
      const aiModel = genAI.getGenerativeModel({ model });
      const contents = buildContents({ systemPrompt, messages });
      const result = await aiModel.generateContent({ contents });
      return result?.response?.text?.() || "";
    },

    async *streamText({ model, systemPrompt, messages }) {
      const aiModel = genAI.getGenerativeModel({ model });
      const contents = buildContents({ systemPrompt, messages });
      const result = await aiModel.generateContentStream({ contents });
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    }
  };
}
