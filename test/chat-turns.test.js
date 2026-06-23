import test from "node:test";
import assert from "node:assert/strict";
import { buildChatTurns } from "../apps/api/src/domain/chatRepository.js";
import { buildChatSystemPrompt } from "../apps/api/src/agent/prompt.js";
import { createReportTools } from "../apps/api/src/agent/reportTools.js";

test("run 연결을 기준으로 질문과 답변을 하나의 대화 턴으로 조립한다", () => {
  const messages = [
    { id: "u1", role: "user", content: "첫 질문", status: "completed" },
    { id: "a1", role: "assistant", content: "첫 답변", status: "completed", replyTo: "u1" },
    { id: "u2", role: "user", content: "후속 질문", status: "completed" },
    { id: "a2", role: "assistant", content: "", status: "streaming", replyTo: "u2" },
  ];
  const runs = [
    { id: "r1", userMessageId: "u1", assistantMessageId: "a1", status: "completed" },
    { id: "r2", userMessageId: "u2", assistantMessageId: "a2", status: "running" },
  ];

  assert.deepEqual(buildChatTurns(messages, runs), [
    { id: "r1", run: runs[0], user: messages[0], assistant: messages[1] },
    { id: "r2", run: runs[1], user: messages[2], assistant: messages[3] },
  ]);
});

test("Agent 대화 이력은 완료된 질문-답변 턴만 순서대로 제공한다", () => {
  const tools = createReportTools({
    snapshot: {},
    history: [
      { role: "user", content: "첫 질문", status: "completed" },
      { role: "assistant", content: "첫 답변", status: "completed" },
      { role: "assistant", content: "작성 중", status: "streaming" },
    ],
  });
  assert.deepEqual(tools.get_conversation_history(), [
    { role: "user", content: "첫 질문" },
    { role: "assistant", content: "첫 답변" },
  ]);
});

test("챗봇 시스템 프롬프트는 명리 전문가 페르소나와 사용자 현실 우선 규칙을 가진다", () => {
  const prompt = buildChatSystemPrompt();
  assert.match(prompt, /사주 명리 전문가/);
  assert.match(prompt, /사용자가 알려준 현재 상황을 우선/);
  assert.match(prompt, /이전 대화/);
  assert.match(prompt, /선택 리포트/);
  assert.match(prompt, /외부 정보.*조회하지 않는다/s);
});
