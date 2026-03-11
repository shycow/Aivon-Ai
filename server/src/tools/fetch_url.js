import { z } from "zod";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { TtlCache } from "../core/utils/cache.js";
import { config } from "../config.js";
import { ensureUrlSafe } from "../core/agent/guardrails.js";

const cache = new TtlCache({ ttlMs: config.fetchCacheTtl * 1000 });

const inputSchema = z.object({
  url: z.string().url(),
  maxChars: z.number().int().min(1000).max(200000).optional()
});

function extractText(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article?.textContent) {
      return article.textContent;
    }
  } catch {
    // Fallback below
  }

  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, aside, noscript").remove();
  return $("body").text();
}

export const fetchUrlTool = {
  name: "fetch_url",
  description: "Fetch a web page and extract readable text.",
  inputSchema,
  riskLevel: "high",
  requiresApproval: true,
  async execute({ url, maxChars = 200000 }) {
    const safeUrl = await ensureUrlSafe(url);
    const cached = cache.get(`${safeUrl}:${maxChars}`);
    if (cached) return cached;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.toolTimeoutMs);
    try {
      const res = await fetch(safeUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 AivonBot/1.0" }
      });
      if (!res.ok) {
        throw new Error(`Fetch failed with ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      const html = await res.text();
      if (!contentType.includes("text") && !contentType.includes("html")) {
        throw new Error("Unsupported content type");
      }

      const text = extractText(html, safeUrl)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxChars);

      const payload = { url: safeUrl, text };
      cache.set(`${safeUrl}:${maxChars}`, payload);
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }
};
