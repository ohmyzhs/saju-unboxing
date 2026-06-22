import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiBase, renderRuntimeConfig } from "../apps/web/scripts/write-runtime-config.mjs";

test("runtime config accepts only an HTTP origin", () => {
  assert.equal(normalizeApiBase("https://api.example.com/"), "https://api.example.com");
  assert.equal(normalizeApiBase(""), "");
  assert.throws(() => normalizeApiBase("javascript:alert(1)"), /HTTP/);
  assert.throws(() => normalizeApiBase("https://api.example.com/base"), /origin/);
});

test("runtime config serializes the normalized backend origin", () => {
  const output = renderRuntimeConfig("https://api.example.com/");
  assert.equal(output, 'window.__SAJU_RUNTIME__ = {"apiBaseUrl":"https://api.example.com"};\n');
});
