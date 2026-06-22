import test from "node:test";
import assert from "node:assert/strict";

import {
  createReportChatSession,
  getReportChatSession,
  listReportChatSessions,
} from "../apps/api/src/domain/chatRepository.js";

test("보관함 ID로 서버 소유권 검증 RPC를 호출해 대화방을 만든다", async () => {
  const calls = [];
  const sb = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: {
          id: "s1",
          sourceArchiveId: "a1",
          title: "기본 사주 리포트",
          status: "active",
          duplicate: false,
        },
        error: null,
      };
    },
  };
  const result = await createReportChatSession(sb, { userId: "u1", archiveId: "a1" });
  assert.equal(result.id, "s1");
  assert.deepEqual(calls, [{
    name: "create_chat_session",
    args: { p_user_id: "u1", p_archive_id: "a1" },
  }]);
});

test("대화방 목록은 최신 실행 상태를 각 대화방에 합친다", async () => {
  const rows = {
    chat_sessions: [
      { id: "s1", source_archive_id: "a1", title: "첫 리포트", status: "active", created_at: "1", updated_at: "3", last_message_at: "3" },
      { id: "s2", source_archive_id: "a2", title: "둘째 리포트", status: "active", created_at: "2", updated_at: "2", last_message_at: null },
    ],
    chat_runs: [
      { id: "r2", session_id: "s1", status: "completed", credit_status: "consumed", created_at: "3" },
      { id: "r1", session_id: "s1", status: "failed", credit_status: "refunded", created_at: "1" },
    ],
  };
  const sb = listDetailSupabase(rows);
  const result = await listReportChatSessions(sb, "u1");
  assert.equal(result[0].id, "s1");
  assert.equal(result[0].latestRun.id, "r2");
  assert.equal(result[0].latestRun.status, "completed");
  assert.equal(result[0].latestRun.creditStatus, "consumed");
  assert.equal(result[0].latestRun.createdAt, "3");
  assert.equal(result[1].latestRun, null);
});

test("대화방 상세는 고정 리포트·메시지·실행·잔액을 함께 반환한다", async () => {
  const rows = {
    chat_sessions: {
      id: "s1",
      user_id: "u1",
      source_archive_id: "a1",
      report_snapshot: { productName: "기본 사주", sections: [{ title: "성향", body: "본문" }] },
      title: "기본 사주",
      status: "active",
      created_at: "1",
      updated_at: "2",
      last_message_at: "2",
    },
    chat_messages: [{ id: "m1", session_id: "s1", role: "user", content: "질문", status: "completed", created_at: "2" }],
    chat_runs: [{ id: "r1", session_id: "s1", user_message_id: "m1", assistant_message_id: "m2", status: "running", credit_status: "reserved", created_at: "2" }],
    chat_credit_accounts: { balance: 4, updated_at: "2" },
  };
  const result = await getReportChatSession(listDetailSupabase(rows), { userId: "u1", sessionId: "s1" });
  assert.equal(result.session.sourceArchiveId, "a1");
  assert.equal(result.report.productName, "기본 사주");
  assert.equal(result.messages[0].content, "질문");
  assert.equal(result.runs[0].creditStatus, "reserved");
  assert.equal(result.balance, 4);
});

function listDetailSupabase(rows) {
  return {
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        order() { return Promise.resolve({ data: rows[table] || [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: rows[table] || null, error: null }); },
      };
      return chain;
    },
  };
}
