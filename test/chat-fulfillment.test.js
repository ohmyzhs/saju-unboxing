import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { grantChatCredits } from "../apps/api/src/domain/chatCredits.js";
import {
  fulfillPaidOrder,
  settleOrderFulfillment,
} from "../apps/api/src/domain/orderFulfillment.js";
import { resolveOrderProduct } from "../apps/api/src/legacy/orders.js";

function supabaseStub({ rpcData = 8, rpcError = null, updateError = null } = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ kind: "rpc", name, args });
      return { data: rpcData, error: rpcError };
    },
    from(table) {
      return {
        update(patch) {
          calls.push({ kind: "update", table, patch });
          return {
            async eq(column, value) {
              calls.push({ kind: "eq", column, value });
              return { error: updateError };
            },
          };
        },
      };
    },
  };
}

test("질의권 구매 적립은 주문번호 기준 RPC를 호출한다", async () => {
  const sb = supabaseStub({ rpcData: 12 });
  const result = await grantChatCredits(sb, {
    userId: "u1",
    orderId: "o1",
    productId: "chat-qa-5",
  });
  assert.deepEqual(result, { balance: 12, creditsAdded: 5, productId: "chat-qa-5" });
  assert.deepEqual(sb.calls[0], {
    kind: "rpc",
    name: "grant_chat_credits",
    args: { p_user_id: "u1", p_amount: 5, p_order_id: "o1" },
  });
});

test("챗봇 상품 가격과 수량은 관리자·클라이언트 값으로 바뀌지 않는다", () => {
  const product = resolveOrderProduct({
    config: { products: { "chat-qa-5": { amount: 1 } } },
    productId: "chat-qa-5",
    plan: { amount: 9999, name: "변조" },
    user: { id: "u1" },
  });
  assert.equal(product.amount, 2250);
  assert.equal(product.questions, 5);
  assert.throws(
    () => resolveOrderProduct({ productId: "chat-qa-1", plan: { amount: 1 }, user: null }),
    (error) => error.statusCode === 401,
  );
});

test("결제 완료된 챗봇 주문만 질의권을 적립하고 완료 상태를 기록한다", async () => {
  const sb = supabaseStub({ rpcData: 3 });
  const result = await fulfillPaidOrder(sb, {
    id: "o2",
    product_id: "chat-qa-3",
    user_id: "u1",
    status: "결제 완료",
  });
  assert.equal(result.status, "fulfilled");
  assert.equal(result.balance, 3);
  assert.deepEqual(
    sb.calls.filter((call) => call.kind === "update").map((call) => call.patch.fulfillment_status),
    ["processing", "fulfilled"],
  );

  await assert.rejects(
    () => fulfillPaidOrder(sb, { id: "o3", product_id: "chat-qa-1", user_id: "u1", status: "결제 준비" }),
    /결제 완료 주문/,
  );
});

test("적립 실패는 결제를 되돌리지 않고 재처리 가능한 상태로 반환한다", async () => {
  const sb = supabaseStub({ rpcError: { message: "database unavailable" } });
  const result = await settleOrderFulfillment(sb, {
    id: "o4",
    product_id: "chat-qa-1",
    user_id: "u1",
    status: "결제 완료",
  });
  assert.equal(result.status, "pending");
  assert.equal(result.required, true);
  assert.match(result.error, /database unavailable/);
  assert.equal(
    sb.calls.filter((call) => call.kind === "update").at(-1).patch.fulfillment_status,
    "pending",
  );
});

test("일반 리포트 주문은 별도 fulfillment가 필요 없다", async () => {
  const sb = supabaseStub();
  assert.deepEqual(
    await settleOrderFulfillment(sb, {
      id: "o5",
      product_id: "saju-analysis",
      user_id: "u1",
      status: "결제 완료",
    }),
    { required: false, status: "not_required" },
  );
  assert.equal(sb.calls.length, 0);
});

test("MZ다크무당 온라인뷰 상품은 saju-web 외부 리포트 주문을 생성한다", async () => {
  const sb = supabaseStub();
  const result = await fulfillPaidOrder(sb, {
    id: "o6",
    product_id: "mz-dark-mudang-online",
    user_id: "u1",
    status: "결제 완료",
    purchase_snapshot: {
      profile: {
        name: "김가별",
        birthDate: "1980-10-31",
        birthTime: "12:00",
        calendar: "solar",
        gender: "M",
      },
    },
  }, {
    createExternalReportOrder: async ({ order, product }) => ({
      provider: product.provider,
      externalOrderId: 77,
      shareToken: "share77",
      shareUrl: "https://saju-web.example/share/share77",
      status: "queued",
      orderName: order.profile_name,
    }),
  });

  assert.equal(result.required, true);
  assert.equal(result.status, "submitted");
  assert.equal(result.externalOrderId, 77);
  assert.deepEqual(
    sb.calls.filter((call) => call.kind === "update").map((call) => call.patch.fulfillment_status),
    ["processing", "fulfilled"],
  );
  assert.equal(
    sb.calls.filter((call) => call.kind === "update").at(-1).patch.external_report.shareUrl,
    "https://saju-web.example/share/share77",
  );
});

test("포인트 전액과 토스 승인 모두 같은 fulfillment 서비스를 호출한다", () => {
  const orders = readFileSync(new URL("../apps/api/src/legacy/orders.js", import.meta.url), "utf8");
  const confirm = readFileSync(new URL("../apps/api/src/legacy/payments/confirm.js", import.meta.url), "utf8");
  assert.match(orders, /settleOrderFulfillment\(sb, \{ \.\.\.orderRow, status: "결제 완료" \}\)/);
  assert.match(confirm, /settleOrderFulfillment\(sb, \{ \.\.\.order, status: "결제 완료" \}\)/);
});
