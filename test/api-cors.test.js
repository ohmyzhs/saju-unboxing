import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, parseAllowedOrigins } from "../apps/api/src/gateway.js";
import { webBaseUrl } from "../apps/api/src/legacy/_lib/http.js";
import kakaoStart from "../apps/api/src/legacy/auth/kakao/start.js";

test("only configured browser origins receive credentialed API access", () => {
  const allowed = ["https://www.example.com", "http://localhost:3000"];
  assert.equal(isAllowedOrigin("https://www.example.com", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.example", allowed), false);
});

test("configured origins are normalized and deduplicated", () => {
  assert.deepEqual(
    parseAllowedOrigins({ WEB_BASE_URL: "https://www.example.com/", WEB_ORIGINS: "https://admin.example.com, https://www.example.com" }),
    ["https://www.example.com", "https://admin.example.com"],
  );
});

test("OAuth completion uses the configured web origin", () => {
  const old = process.env.WEB_BASE_URL;
  process.env.WEB_BASE_URL = "https://www.example.com/";
  try {
    assert.equal(webBaseUrl({ headers: { host: "api.example.com" } }), "https://www.example.com");
  } finally {
    if (old === undefined) delete process.env.WEB_BASE_URL;
    else process.env.WEB_BASE_URL = old;
  }
});

test("Kakao setup errors return to the configured web origin", async () => {
  const oldWeb = process.env.WEB_BASE_URL;
  const oldKey = process.env.KAKAO_REST_API_KEY;
  process.env.WEB_BASE_URL = "https://www.example.com";
  delete process.env.KAKAO_REST_API_KEY;
  const headers = new Map();
  const res = {
    setHeader(name, value) { headers.set(name, value); },
    end() {},
  };
  try {
    await kakaoStart({ headers: { host: "api.example.com" } }, res);
    assert.equal(res.statusCode, 302);
    assert.equal(headers.get("Location"), "https://www.example.com/?auth=missing-kakao");
  } finally {
    if (oldWeb === undefined) delete process.env.WEB_BASE_URL;
    else process.env.WEB_BASE_URL = oldWeb;
    if (oldKey === undefined) delete process.env.KAKAO_REST_API_KEY;
    else process.env.KAKAO_REST_API_KEY = oldKey;
  }
});
