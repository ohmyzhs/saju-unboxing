import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("사용자 리포트 공유는 관리자 전용 함수 없이 공용 API 클라이언트를 사용한다", () => {
  const start = app.indexOf("async function ensureShareUrl");
  const end = app.indexOf("function fallbackCopy", start);
  const source = app.slice(start, end);

  assert.match(source, /getJson\("\/api\/share"/);
  assert.doesNotMatch(source, /adminPost\(/);
});
