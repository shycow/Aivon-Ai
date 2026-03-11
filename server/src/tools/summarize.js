import { z } from "zod";

const inputSchema = z.object({
  text: z.string().min(20),
  maxWords: z.number().int().min(30).max(300).optional()
});

export const summarizeTool = {
  name: "summarize",
  description: "Summarize long text into concise bullet points.",
  inputSchema,
  riskLevel: "low",
  requiresApproval: false,
  async execute({ text, maxWords = 120 }, { gemini, model }) {
    const prompt = `Summarize the following text in under ${maxWords} words. Use bullet points when helpful.`;
    const output = await gemini.generateText({
      model,
      systemPrompt: prompt,
      messages: [{ role: "user", content: text }]
    });
    return { summary: output.trim() };
  }
};