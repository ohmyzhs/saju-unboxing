import test from "node:test";
import assert from "node:assert/strict";
import { requestPath, resolveRoute } from "../apps/api/src/gateway.js";

test("gateway resolves every legacy public API path", () => {
  assert.equal(resolveRoute("/api/config").name, "config");
  assert.equal(resolveRoute("/api/payments/confirm").name, "payment-confirm");
  assert.equal(resolveRoute("/api/saju/analyze").name, "saju-analyze");
  assert.deepEqual(resolveRoute("/api/admin/points"), { name: "admin", action: "points" });
  assert.equal(resolveRoute("/api/auth/kakao/callback").name, "kakao-callback");
  assert.deepEqual(resolveRoute("/api/chat/catalog"), { name: "chat", path: "catalog" });
  assert.deepEqual(resolveRoute("/api/chat/sessions/abc/messages"), { name: "chat", path: "sessions/abc/messages" });
  assert.equal(resolveRoute("/api/external-reports").name, "external-reports");
  assert.deepEqual(resolveRoute("/api/health"), { name: "health" });
  assert.equal(resolveRoute("/api/missing"), null);
});

test("gateway rebuilds the original nested API path from the rewrite query", () => {
  assert.equal(requestPath({ url: "/api/gateway?path=saju%2Fanalyze", query: { path: "saju/analyze" } }), "/api/saju/analyze");
  assert.equal(requestPath({ url: "/api/config", query: {} }), "/api/config");
});
