import test from "node:test";
import assert from "node:assert/strict";

import { confirmOrderPayment } from "../api/payments/confirm.js";

test("혼합 결제는 포인트 차감 후 남은 금액만 토스 승인한다", async () => {
  const calls = [];
  const result = await confirmOrderPayment({
    order: { id: "o1", amount: 590, points_used: 400, pay_method: "mixed", user_id: "u1", status: "결제 준비" },
    paymentKey: "pk1",
    requestedAmount: 590,
    adjust: async (entry) => { calls.push(entry); return 600; },
    confirm: async (order) => { calls.push({ kind: "toss", order }); return { paymentKey: "pk1", status: "DONE" }; },
    markDone: async (payment) => { calls.push({ kind: "done", payment }); },
  });

  assert.equal(result.pointsUsed, 400);
  assert.deepEqual(calls.map((entry) => entry.type || entry.kind), ["spend", "toss", "done"]);
  assert.equal(calls[1].order.amount, 590);
});

test("토스 승인 실패 시 혼합 차감 포인트를 환원한다", async () => {
  const calls = [];
  let failed = false;
  await assert.rejects(
    () => confirmOrderPayment({
      order: { id: "o2", amount: 590, points_used: 400, pay_method: "mixed", user_id: "u1", status: "결제 준비" },
      paymentKey: "pk2",
      requestedAmount: 590,
      adjust: async (entry) => { calls.push(entry); return 1000; },
      confirm: async () => { throw new Error("토스 승인 실패"); },
      markDone: async () => {},
      markFailed: async () => { failed = true; },
    }),
    /토스 승인 실패/,
  );
  assert.deepEqual(calls.map((entry) => entry.type), ["spend", "refund"]);
  assert.equal(calls[1].delta, 400);
  assert.equal(failed, true);
});

test("충전 주문은 원금과 보너스를 별도 거래로 적립한다", async () => {
  const calls = [];
  const result = await confirmOrderPayment({
    order: { id: "c1", product_id: "point-charge", amount: 10000, points_used: 0, pay_method: "toss", user_id: "u1", status: "결제 준비" },
    paymentKey: "pk3",
    requestedAmount: 10000,
    adjust: async (entry) => { calls.push(entry); return entry.type === "charge" ? 10000 : 13000; },
    confirm: async () => ({ paymentKey: "pk3", status: "DONE" }),
    markDone: async () => {},
  });
  assert.deepEqual(calls.map(({ type, delta }) => [type, delta]), [["charge", 10000], ["bonus", 3000]]);
  assert.equal(result.pointsAdded, 13000);
  assert.equal(result.pointBalance, 13000);
});

test("주문 금액 위변조를 승인 전에 거절한다", async () => {
  await assert.rejects(
    () => confirmOrderPayment({
      order: { id: "o3", amount: 590, points_used: 400, pay_method: "mixed", user_id: "u1" },
      paymentKey: "pk",
      requestedAmount: 100,
      adjust: async () => 0,
      confirm: async () => ({}),
      markDone: async () => {},
    }),
    /금액이 다릅니다/,
  );
});

test("이미 완료된 주문은 토스를 다시 호출하지 않는다", async () => {
  let called = false;
  const result = await confirmOrderPayment({
    order: { id: "o4", amount: 590, status: "결제 완료", toss_payment_key: "saved" },
    paymentKey: "saved",
    requestedAmount: 590,
    adjust: async () => 0,
    confirm: async () => { called = true; return {}; },
    markDone: async () => {},
  });
  assert.equal(called, false);
  assert.equal(result.alreadyProcessed, true);
});

test("취소된 주문은 뒤늦은 토스 승인 콜백을 거절한다", async () => {
  let confirmed = false;
  await assert.rejects(
    () => confirmOrderPayment({
      order: { id: "o5", amount: 990, status: "결제 취소" },
      paymentKey: "late",
      requestedAmount: 990,
      adjust: async () => 0,
      confirm: async () => { confirmed = true; return {}; },
      markDone: async () => {},
    }),
    /취소된 주문/,
  );
  assert.equal(confirmed, false);
});
