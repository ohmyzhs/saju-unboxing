import test from "node:test";
import assert from "node:assert/strict";

await import("../apps/web/public/api-client.js");

test("API URL stays same-origin when no backend origin is configured", () => {
  assert.equal(globalThis.SajuApi.url("/api/session", { apiBaseUrl: "" }), "/api/session");
});

test("API URL uses the configured backend without duplicate slashes", () => {
  assert.equal(
    globalThis.SajuApi.url("/api/session", { apiBaseUrl: "https://api.example.com/" }),
    "https://api.example.com/api/session",
  );
});

test("non-API URLs are not rewritten", () => {
  assert.equal(globalThis.SajuApi.url("https://example.com/file", { apiBaseUrl: "https://api.example.com" }), "https://example.com/file");
});
