import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const config = readFileSync(new URL("../api/config.js", import.meta.url), "utf8");

await import("../public/point-payment.js");
const { fullUse } = globalThis.PointPayment;

test("마이페이지에 포인트 잔액과 충전 화면이 있다", () => {
  assert.match(html, /data-mypage-points/);
  assert.match(html, /data-view="points"/);
  assert.match(html, /data-point-tiers/);
  assert.match(app, /renderPointsView/);
});

test("결제 화면에 포인트 사용 입력과 현금 잔액이 있다", () => {
  assert.match(html, /data-point-use/);
  assert.match(html, /data-point-use-all/);
  assert.match(html, /data-point-balance/);
  assert.match(html, /data-pay-cash/);
  assert.match(app, /updatePointPayment/);
  assert.match(app, /PointPayment\.fullUse/);
});

test("전액사용은 보유 포인트와 상품가 중 작은 정수만 사용한다", () => {
  assert.equal(fullUse(5000, 1990), 1990);
  assert.equal(fullUse(500, 1990), 500);
  assert.equal(fullUse(-1, 1990), 0);
  assert.equal(fullUse(500.9, 1990.8), 500);
});

test("포인트 입력 라벨과 전액사용 버튼은 별도 접근성 이름을 가진다", () => {
  assert.match(html, /<label for="point-use-input">사용할 포인트<\/label>/);
  assert.match(html, /id="point-use-input"[^>]*data-point-use/);
  assert.doesNotMatch(html, /<label[^>]*>사용할 포인트\s*<span/);
});

test("무료운세 재생성 버튼과 regen 요청이 연결된다", () => {
  assert.match(html, /data-daily-regen-card/);
  assert.match(html, /data-daily-regen-count/);
  assert.match(html, /data-daily-regenerate/);
  assert.match(html, /data-points-daily/);
  assert.match(app, /regen: Boolean\(options\.regen\)/);
  assert.match(app, /renderDailyRegeneration/);
  assert.match(app, /재생성권 1개를 사용/);
  assert.match(app, /options\.regen && !data\.regenerated/);
});

test("공개 설정은 서버 충전 티어를 노출한다", () => {
  assert.match(config, /POINT_CHARGE_TIERS/);
  assert.match(config, /pointChargeTiers/);
  assert.match(config, /pointsEnabled/);
});
