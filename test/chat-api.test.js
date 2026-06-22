import test from "node:test";
import assert from "node:assert/strict";

import { chatCatalogPayload } from "../apps/api/src/http/chat.js";

function accountSupabase(row = null) {
  return {
    from(table) {
      assert.equal(table, "chat_credit_accounts");
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async maybeSingle() { return { data: row, error: null }; },
      };
      return chain;
    },
  };
}

test("챗봇 catalog는 고정 상품과 로그인 회원 잔액을 반환한다", async () => {
  const payload = await chatCatalogPayload(accountSupabase({ balance: 7, updated_at: "2026-06-22T00:00:00Z" }), { id: "u1" });
  assert.equal(payload.balance, 7);
  assert.deepEqual(payload.products.map(({ id, questions, amount }) => [id, questions, amount]), [
    ["chat-qa-1", 1, 500],
    ["chat-qa-3", 3, 1500],
    ["chat-qa-5", 5, 2250],
    ["chat-qa-10", 10, 4000],
  ]);
});

test("챗봇 catalog는 비로그인 요청을 거절한다", async () => {
  await assert.rejects(
    () => chatCatalogPayload(accountSupabase(), null),
    (error) => error.statusCode === 401 && /로그인/.test(error.message),
  );
});
