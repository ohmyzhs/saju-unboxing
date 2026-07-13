import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("새 결제 화면은 이전 결제 버튼의 disabled 상태를 초기화한다", () => {
  const setupStart = app.indexOf("function setupPayView(product)");
  const setupEnd = app.indexOf("function pointPaymentBreakdown()", setupStart);
  const setup = app.slice(setupStart, setupEnd);
  assert.match(app, /function resetPaymentSubmitButton\(button, context = currentCheckout\)/);
  assert.match(app, /button\.disabled = false/);
  assert.match(app, /button\.removeAttribute\("aria-busy"\)/);
  assert.match(setup, /resetPaymentSubmitButton\(confirm, currentCheckout\)/);
});

test("페이지 이동 없는 포인트 결제 완료 후에도 결제 버튼을 복구한다", () => {
  const paymentStart = app.indexOf("async function beginTossPayment(");
  const paymentEnd = app.indexOf("async function requestExistingOrderPayment(", paymentStart);
  const payment = app.slice(paymentStart, paymentEnd);
  assert.match(payment, /button\.disabled = true/);
  assert.match(payment, /button\.setAttribute\("aria-busy", "true"\)/);
  assert.match(payment, /if \(order\.paidWithPoints && purchase\)[\s\S]*return;/);
  assert.match(payment, /finally\s*\{[\s\S]*context === currentCheckout\)[\s\S]*resetPaymentSubmitButton\(button, context\)/);
});
