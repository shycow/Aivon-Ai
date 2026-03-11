import { z } from "zod";

const inputSchema = z.object({
  text: z.string().min(20),
  fields: z.array(z.string().min(1)).min(1).max(10)
});

export const extractTool = {
  name: "extract",
  description: "Extract structured fields from text and return JSON.",
  inputSchema,
  riskLevel: "low",
  requiresApproval: false,
  async execute({ text, fields }, { gemini, model }) {
    const prompt = `Extract the following fields as JSON keys: ${fields.join(", ")}. Return only valid JSON.`;
    const output = await gemini.generateText({
      model,
      systemPrompt: prompt,
      messages: [{ role: "user", content: text }]
    });
    try {
      const parsed = JSON.parse(output);
      return { data: parsed };
    } catch {
      return { data: output.trim() };
    }
  }
};