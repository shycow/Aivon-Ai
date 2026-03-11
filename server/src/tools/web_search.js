import { z } from "zod";
import * as cheerio from "cheerio";
import { TtlCache } from "../core/utils/cache.js";
import { config } from "../config.js";

const cache = new TtlCache({ ttlMs: config.searchCacheTtl * 1000 });

const inputSchema = z.object({
  query: z.string().min(2),
  maxResults: z.number().int().min(1).max(10).optional()
});

function extractResults(html) {
  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((_, el) => {
    const link = $(el).find("a.result__a");
    const title = link.text().trim();
    const url = link.attr("href");
    const snippet = $(el).find(".result__snippet").text().trim();
    if (title && url) {
      results.push({ title, url, snippet });
    }
  });
  return results;
}

function dedupe(results) {
  const seen = new Set();
  return results.filter((item) => {
    const key = item.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const webSearchTool = {
  name: "web_search",
  description: "Search the web for recent information.",
  inputSchema,
  riskLevel: "medium",
  requiresApproval: true,
  async execute({ query, maxResults = 5 }) {
    const cached = cache.get(`${query}:${maxResults}`);
    if (cached) return cached;

    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 AivonBot/1.0"
      }
    });
    if (!res.ok) {
      throw new Error(`Search failed with ${res.status}`);
    }
    const html = await res.text();
    let results = extractResults(html);
    results = dedupe(results);

    const filtered = results
      .filter((item) => !config.blockedDomains.some((domain) => item.url.toLowerCase().includes(domain)))
      .map((item) => ({
        ...item,
        score: (item.snippet?.length || 0) + (item.title?.length || 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ score, ...rest }) => rest);

    cache.set(`${query}:${maxResults}`, filtered);
    return filtered;
  }
};
