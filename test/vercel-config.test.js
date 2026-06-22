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

test("both Vercel deployments expose one gateway function", () => {
  const rootFunctions = apiFunctions(new URL("../api/", import.meta.url));
  const backendFunctions = apiFunctions(new URL("../apps/api/api/", import.meta.url));
  const rootConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const backendConfig = JSON.parse(readFileSync(new URL("../apps/api/vercel.json", import.meta.url), "utf8"));
  assert.equal(rootFunctions.length, 1);
  assert.equal(backendFunctions.length, 1);
  assert.ok(rootFunctions[0].endsWith("/api/gateway.js"));
  assert.ok(backendFunctions[0].endsWith("/api/gateway.js"));
  assert.deepEqual(rootConfig.rewrites.at(-1), { source: "/api/(.*)", destination: "/api/gateway?path=$1" });
  assert.deepEqual(backendConfig.rewrites.at(-1), { source: "/api/(.*)", destination: "/api/gateway?path=$1" });
});

test("Vercel runtime uses a pinned Node LTS major", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.engines.node, "24.x");
});
