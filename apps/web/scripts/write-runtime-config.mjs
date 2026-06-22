import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function normalizeApiBase(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  const parsed = new URL(input);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SAJU_API_BASE_URL must use HTTP or HTTPS.");
  }
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (normalizedPath) throw new Error("SAJU_API_BASE_URL must be an origin without a path.");
  return parsed.origin;
}

export function renderRuntimeConfig(value) {
  return `window.__SAJU_RUNTIME__ = ${JSON.stringify({ apiBaseUrl: normalizeApiBase(value) })};\n`;
}

export async function writeRuntimeConfig(value = process.env.SAJU_API_BASE_URL || "") {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outputPath = resolve(scriptDir, "../public/runtime-config.js");
  await writeFile(outputPath, renderRuntimeConfig(value), "utf8");
  return outputPath;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await writeRuntimeConfig();
}
