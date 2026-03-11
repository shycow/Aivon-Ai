import { webSearchTool } from "./web_search.js";
import { fetchUrlTool } from "./fetch_url.js";
import { calculatorTool } from "./calculator.js";
import { summarizeTool } from "./summarize.js";
import { extractTool } from "./extract.js";

export const toolRegistry = [
  webSearchTool,
  fetchUrlTool,
  calculatorTool,
  summarizeTool,
  extractTool
];

export function getToolByName(name) {
  return toolRegistry.find((tool) => tool.name === name);
}