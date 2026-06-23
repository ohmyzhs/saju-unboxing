import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("홈 초보자 안내는 단계별 설명과 실제 화면 이동 CTA를 제공한다", () => {
  for (const step of ["profile", "product", "orders", "library"]) {
    assert.match(html, new RegExp(`data-guide-step="${step}"`));
  }
  assert.match(html, /data-guide-panel/);
  assert.match(html, /data-guide-action/);
  assert.match(app, /HOME_GUIDE_STEPS/);
  assert.match(app, /function bindHomeGuide/);
  assert.match(app, /showView\(step\.view\)/);
});
