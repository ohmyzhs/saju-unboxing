import test from "node:test";
import assert from "node:assert/strict";

import {
  enqueueReportChatMessage,
  failChatRun,
} from "../apps/api/src/domain/chatRepository.js";
import { createChatHandler } from "../apps/api/src/http/chat.js";

test("질문 enqueue는 정규화한 요청 ID와 질문을 원자 RPC에 전달한다", async () => {
  const calls = [];
  const sb = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: { runId: "r1", userMessageId: "m1", assistantMessageId: "m2", balance: 2, duplicate: false },
        error: null,
      };
    },
  };
  const result = await enqueueReportChatMessage(sb, {
    userId: "u1",
    sessionId: "s1",
    clientRequestId: " request-1 ",
    question: "  올해 이직운은 어떤가요?  ",
  });
  assert.equal(result.runId, "r1");
  assert.deepEqual(calls[0], {
    name: "enqueue_chat_message",
    args: {
      p_user_id: "u1",
      p_session_id: "s1",
      p_client_request_id: "request-1",
      p_question: "올해 이직운은 어떤가요?",
    },
  });
});

test("질문 길이와 질의권 부족 오류를 HTTP 계약으로 변환한다", async () => {
  await assert.rejects(
    () => enqueueReportChatMessage({ rpc: async () => ({}) }, { userId: "u1", sessionId: "s1", clientRequestId: "c1", question: "" }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    () => enqueueReportChatMessage({
      rpc: async () => ({ data: null, error: { message: "insufficient_chat_credits" } }),
    }, { userId: "u1", sessionId: "s1", clientRequestId: "c1", question: "질문" }),
    (error) => error.statusCode === 409 && error.code === "insufficient_chat_credits",
  );
});

test("영구 실패 처리는 환원 포함 단일 RPC를 사용한다", async () => {
  const calls = [];
  const sb = { async rpc(name, args) { calls.push({ name, args }); return { data: { refunded: true }, error: null }; } };
  await failChatRun(sb, { userId: "u1", runId: "r1", code: "workflow_start_failed", message: "start failed" });
  assert.deepEqual(calls[0], {
    name: "fail_chat_run",
    args: {
      p_user_id: "u1",
      p_run_id: "r1",
      p_error_code: "workflow_start_failed",
      p_error_message: "start failed",
    },
  });
});

test("메시지 API는 enqueue 후 Workflow 시작을 요청하고 202를 반환한다", async () => {
  const started = [];
  const handler = createChatHandler({
    getUser: async () => ({ id: "u1" }),
    getDb: () => ({
      async rpc(name) {
        assert.equal(name, "enqueue_chat_message");
        return { data: { runId: "r1", userMessageId: "m1", assistantMessageId: "m2", balance: 0, duplicate: false }, error: null };
      },
    }),
    startRun: async (runId) => { started.push(runId); },
  });
  const response = await invoke(handler, {
    method: "POST",
    query: { chatPath: "sessions/s1/messages" },
    body: { clientRequestId: "c1", question: "질문" },
  });
  assert.equal(response.status, 202);
  assert.equal(response.body.runId, "r1");
  assert.deepEqual(started, ["r1"]);
});

async function invoke(handler, req) {
  let text = "";
  const res = { statusCode: 200, setHeader() {}, end(value = "") { text = value; } };
  await handler({ headers: {}, url: "/api/gateway", ...req }, res);
  return { status: res.statusCode, body: text ? JSON.parse(text) : null };
}
