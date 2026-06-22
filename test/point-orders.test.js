import test from "node:test";
import assert from "node:assert/strict";

import { completePointOnlyOrder, resolveOrderPayment, resolveProductPrice } from "../apps/api/src/legacy/orders.js";

test("서버 상품 설정 가격을 클라이언트 금액보다 우선한다", () => {
  const config = { products: { "saju-analysis": { amount: 1490 } } };
  assert.equal(resolveProductPrice(config, "saju-analysis", { amount: 990 }), 1490);
  assert.equal(resolveProductPrice({}, "saju-analysis", { amount: 990 }), 990);
});

test("잘못된 서버 상품 가격을 거절한다", () => {
  assert.throws(() => resolveProductPrice({ products: { x: { amount: -1 } } }, "x", { amount: 990 }), /상품 가격/);
});

test("포인트 전액 결제는 토스 금액이 0이다", () => {
  assert.deepEqual(resolveOrderPayment({ price: 990, requestedPoints: 990, balance: 2000 }), {
    price: 990,
    pointsUsed: 990,
    cashAmount: 0,
    payMethod: "points",
  });
});

test("혼합 결제는 잔액 범위 안에서 남은 금액만 토스로 보낸다", () => {
  assert.deepEqual(resolveOrderPayment({ price: 990, requestedPoints: 800, balance: 400 }), {
    price: 990,
    pointsUsed: 400,
    cashAmount: 590,
    payMethod: "mixed",
  });
});

test("포인트 차감 자체가 실패하면 환원으로 포인트를 만들지 않는다", async () => {
  const calls = [];
  await assert.rejects(() => completePointOnlyOrder({
    userId: "u1",
    orderId: "o1",
    pointsUsed: 990,
    adjust: async (entry) => { calls.push(entry); throw new Error("RPC 연결 실패"); },
    markDone: async () => {},
    markFailed: async () => {},
  }), /RPC 연결 실패/);
  assert.deepEqual(calls.map((entry) => entry.type), ["spend"]);
});

test("차감 후 주문 완료 저장이 실패하면 포인트를 환원한다", async () => {
  const calls = [];
  await assert.rejects(() => completePointOnlyOrder({
    userId: "u1",
    orderId: "o2",
    pointsUsed: 990,
    adjust: async (entry) => { calls.push(entry); return entry.type === "spend" ? 10 : 1000; },
    markDone: async () => { throw new Error("주문 저장 실패"); },
    markFailed: async () => {},
  }), /주문 저장 실패/);
  assert.deepEqual(calls.map((entry) => entry.type), ["spend", "refund"]);
});
