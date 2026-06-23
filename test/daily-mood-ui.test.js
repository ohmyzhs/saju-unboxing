import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("오늘운세 마음 칩은 직접 입력과 실제 분석 요청에 연결된다", () => {
  assert.match(html, /data-fortune-mood-custom/);
  assert.match(html, /data-fortune-mood-input/);
  assert.match(html, /data-fortune-start/);
  assert.match(app, /function fortuneMoodValue/);
  assert.match(app, /startDailyFortune\(profile, \{ mood \}\)/);
  assert.match(app, /JSON\.stringify\(\{ productId: "daily-fortune", profile, mood/);
  assert.match(app, /dailyCacheKey\(profile\.id, mood\)/);
});
