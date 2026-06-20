import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const config = readFileSync(new URL("../api/config.js", import.meta.url), "utf8");

test("마이페이지에 포인트 잔액과 충전 화면이 있다", () => {
  assert.match(html, /data-mypage-points/);
  assert.match(html, /data-view="points"/);
  assert.match(html, /data-point-tiers/);
  assert.match(app, /renderPointsView/);
});

test("결제 화면에 포인트 사용 입력과 현금 잔액이 있다", () => {
  assert.match(html, /data-point-use/);
  assert.match(html, /data-point-balance/);
  assert.match(html, /data-pay-cash/);
  assert.match(app, /updatePointPayment/);
});

test("무료운세 재생성 버튼과 regen 요청이 연결된다", () => {
  assert.match(html, /data-daily-regenerate/);
  assert.match(app, /regen: Boolean\(options\.regen\)/);
  assert.match(app, /regenerate\.disabled = true/);
});

test("공개 설정은 서버 충전 티어를 노출한다", () => {
  assert.match(config, /POINT_CHARGE_TIERS/);
  assert.match(config, /pointChargeTiers/);
  assert.match(config, /pointsEnabled/);
});
