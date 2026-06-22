import test from "node:test";
import assert from "node:assert/strict";

import { chatCatalogPayload, createChatHandler } from "../apps/api/src/http/chat.js";

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

test("POST sessions는 로그인 사용자의 보관함으로 대화방을 만든다", async () => {
  const calls = [];
  const handler = createChatHandler({
    getUser: async () => ({ id: "u1" }),
    getDb: () => ({
      async rpc(name, args) {
        calls.push({ name, args });
        return {
          data: { id: "s1", sourceArchiveId: "a1", title: "기본 사주", status: "active", duplicate: false },
          error: null,
        };
      },
    }),
  });
  const response = await invoke(handler, { method: "POST", query: { chatPath: "sessions" }, body: { archiveId: "a1" } });
  assert.equal(response.status, 201);
  assert.equal(response.body.session.id, "s1");
  assert.deepEqual(calls[0].args, { p_user_id: "u1", p_archive_id: "a1" });
});

test("GET sessions는 대화방이 없을 때 빈 목록과 잔액을 반환한다", async () => {
  const handler = createChatHandler({
    getUser: async () => ({ id: "u1" }),
    getDb: () => ({
      from(table) {
        const chain = {
          select() { return chain; },
          eq() { return chain; },
          order() { return Promise.resolve({ data: table === "chat_sessions" ? [] : null, error: null }); },
          maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        };
        return chain;
      },
    }),
  });
  const response = await invoke(handler, { method: "GET", query: { chatPath: "sessions" } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { sessions: [] });
});

async function invoke(handler, req) {
  let text = "";
  const res = {
    statusCode: 200,
    setHeader() {},
    end(value = "") { text = value; },
  };
  await handler({ headers: {}, url: "/api/gateway", ...req }, res);
  return { status: res.statusCode, body: text ? JSON.parse(text) : null };
}
