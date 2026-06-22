import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

function apiFunctions(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, path);
    if (entry.isDirectory()) return entry.name === "_lib" ? [] : apiFunctions(target);
    return entry.name.endsWith(".js") ? [target.pathname] : [];
  });
}

test("Vercel Fluid Compute allows report APIs up to the Hobby maximum", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.functions["api/**/*.js"].maxDuration, 300);
  assert.equal(config.functions["api/**/*.js"].memory, undefined);
});

test("Vercel Hobby deployment stays within the 12 function limit", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const functions = apiFunctions(new URL("../api/", import.meta.url));
  assert.ok(functions.length <= 12, `serverless functions: ${functions.length}/12`);
  assert.ok(!functions.some((path) => path.endsWith("/api/health.js")));
  assert.deepEqual(config.rewrites.at(-1), { source: "/api/health", destination: "/api/config?mode=health" });
});

test("Vercel runtime uses a pinned Node LTS major", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.engines.node, "24.x");
});
