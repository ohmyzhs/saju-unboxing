import test from "node:test";
import assert from "node:assert/strict";

import {
  createDraftAccumulator,
  executeChatRun,
} from "../apps/api/src/workflows/chatExecution.js";

test("답변 델타는 누적 정본과 함께 묶어서 저장한다", async () => {
  const saved = [];
  const draft = createDraftAccumulator({
    threshold: 5,
    persist: async (content, delta) => saved.push({ content, delta }),
  });
  await draft.push("가나다");
  assert.deepEqual(saved, [
    { content: "가나다", delta: "가나다" },
  ]);
  await draft.push("라마");
  await draft.push("바사");
  await draft.flush();
  assert.deepEqual(saved, [
    { content: "가나다", delta: "가나다" },
    { content: "가나다라마바사", delta: "라마바사" },
  ]);
});

test("실행권을 선점한 Workflow만 Agent를 실행하고 완료를 확정한다", async () => {
  const calls = [];
  const result = await executeChatRun("r1", {
    sb: {},
    claim: async () => ({ claimed: true, userId: "u1" }),
    load: async () => ({ snapshot: { productName: "리포트" }, history: [], question: "질문", model: "deepseek-v4-flash" }),
    persist: async (_sb, payload) => calls.push({ kind: "persist", ...payload }),
    complete: async (_sb, payload) => calls.push({ kind: "complete", ...payload }),
    fail: async () => calls.push({ kind: "fail" }),
    agent: async ({ onDelta }) => {
      await onDelta("답변입니다.");
      return { text: "답변입니다.", model: "deepseek-v4-flash", usage: { totalTokens: 10 } };
    },
  });
  assert.equal(result.status, "completed");
  assert.equal(calls.filter((call) => call.kind === "complete").length, 1);
  assert.equal(calls.some((call) => call.kind === "fail"), false);
  assert.equal(calls.at(-1).content, "답변입니다.");
});

test("이미 다른 Workflow가 선점한 run은 모델을 다시 호출하지 않는다", async () => {
  let generated = false;
  const result = await executeChatRun("r2", {
    sb: {},
    claim: async () => ({ claimed: false, status: "running" }),
    agent: async () => { generated = true; },
  });
  assert.equal(generated, false);
  assert.deepEqual(result, { status: "running", skipped: true });
});

test("Agent 영구 실패는 run 실패와 질의권 환원 경로를 호출한다", async () => {
  const failed = [];
  await assert.rejects(() => executeChatRun("r3", {
    sb: {},
    claim: async () => ({ claimed: true, userId: "u1" }),
    load: async () => ({ snapshot: {}, history: [], question: "질문", model: "deepseek-v4-flash" }),
    persist: async () => {},
    complete: async () => {},
    fail: async (_sb, payload) => failed.push(payload),
    agent: async () => { throw Object.assign(new Error("provider failed"), { statusCode: 503 }); },
  }), /provider failed/);
  assert.equal(failed[0].userId, "u1");
  assert.equal(failed[0].runId, "r3");
  assert.equal(failed[0].code, "provider_error");
});
