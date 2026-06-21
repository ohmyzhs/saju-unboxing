import test from "node:test";
import assert from "node:assert/strict";

import { cancelOwnedOrder, resumeOwnedOrder } from "../api/_lib/orderLifecycle.js";

test("미결제 본인 주문을 취소한다", async () => {
  let patch = null;
  const result = await cancelOwnedOrder({
    order: { id: "o1", user_id: "u1", status: "결제 준비" },
    userId: "u1",
    update: async (value) => { patch = value; },
  });

  assert.deepEqual(patch, { status: "결제 취소" });
  assert.deepEqual(result, { orderId: "o1", status: "결제 취소" });
});

test("다른 회원 주문과 결제 완료 주문은 취소하지 않는다", async () => {
  await assert.rejects(
    () => cancelOwnedOrder({ order: { id: "o2", user_id: "u2", status: "결제 준비" }, userId: "u1", update: async () => {} }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    () => cancelOwnedOrder({ order: { id: "legacy", user_id: null, status: "결제 준비" }, userId: "u1", update: async () => {} }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    () => cancelOwnedOrder({ order: { id: "o3", user_id: "u1", status: "결제 완료" }, userId: "u1", update: async () => {} }),
    (error) => error.statusCode === 409,
  );
});

test("본인 미결제 주문만 기존 주문번호로 결제를 재개한다", () => {
  const order = resumeOwnedOrder({
    order: { id: "o4", user_id: "u1", status: "결제 준비", amount: 990, points_used: 1000, product_id: "saju-analysis" },
    userId: "u1",
  });
  assert.deepEqual(order, { orderId: "o4", amount: 990, pointsUsed: 1000, productId: "saju-analysis" });
  assert.throws(() => resumeOwnedOrder({ order: { id: "o5", user_id: "u2", status: "결제 준비" }, userId: "u1" }), /본인 주문/);
  assert.throws(() => resumeOwnedOrder({ order: { id: "o6", user_id: "u1", status: "결제 취소" }, userId: "u1" }), /재개할 수 없습니다/);
});
