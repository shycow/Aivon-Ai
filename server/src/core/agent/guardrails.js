import dns from "node:dns/promises";
import { config } from "../../config.js";

const BLOCKED_SCHEMES = new Set(["file:", "ftp:"]);
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./
];

function isPrivateIpv4(ip) {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

function isPrivateHost(hostname) {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local")) return true;
  if (lower === "::1") return true;
  return false;
}

export async function ensureUrlSafe(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!parsed.protocol || BLOCKED_SCHEMES.has(parsed.protocol)) {
    throw new Error("Blocked URL scheme");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported URL scheme");
  }

  const host = parsed.hostname.toLowerCase();
  if (config.blockedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error("Blocked domain");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Blocked host");
  }

  try {
    const records = await dns.lookup(parsed.hostname, { all: true });
    for (const record of records) {
      if (record.family === 4 && isPrivateIpv4(record.address)) {
        throw new Error("Blocked private IP");
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("DNS lookup failed");
  }

  return parsed.toString();
}

export function enforceToolLimits(proposals) {
  if (proposals.length > config.toolMaxCallsPerRun) {
    return proposals.slice(0, config.toolMaxCallsPerRun);
  }
  return proposals;
}

export function normalizeToolArgs(schema, args) {
  const parsed = schema.safeParse(args || {});
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(", ");
    throw new Error(`Invalid tool arguments: ${message}`);
  }
  return parsed.data;
}
