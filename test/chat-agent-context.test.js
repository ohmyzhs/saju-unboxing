import test from "node:test";
import assert from "node:assert/strict";

import {
  compactManseFacts,
  createReportTools,
  selectRelevantSection,
} from "../apps/api/src/agent/reportTools.js";
import { buildChatSystemPrompt } from "../apps/api/src/agent/prompt.js";
import { runReportAgent } from "../apps/api/src/agent/chatAgent.js";

const SNAPSHOT = {
  id: "a1",
  productId: "saju-analysis",
  productName: "기본 사주 리포트",
  profileName: "김가별",
  analysis: {
    headline: "차분하게 기회를 쌓는 흐름",
    summary: { 일간: "병", 강약: "중화" },
    manse: { summary: { pillars: ["임신", "계묘", "기묘", "정묘"] }, full: { 용신: "목" } },
    sections: [
      { id: "career", title: "일과 이직", body: "올해는 준비한 이동에 유리하지만 계약 조건을 차분히 확인하세요." },
      { id: "love", title: "연애와 관계", body: "관계에서는 속도를 늦추고 대화를 구체적으로 이어가세요." },
    ],
  },
};

test("챗봇 만세력 facts는 장기 운세 배열 전체를 덤프하지 않고 핵심만 보낸다", () => {
  const facts = compactManseFacts({
    manse: {
      pillar: { day: { stem: "丁", branch: "丑" } },
      yongsin: { yongsin: "木", huisin: "水", gisin: "金" },
      strength: "중화",
      tenGodStats: { bigyeop: 3 },
      yinyang: { yin: 2, yang: 6 },
      hyungchung: { jijiHae: ["축오"] },
      shinsal: { gongmangDay: "신유" },
      daeun: Array.from({ length: 10 }, (_, index) => ({ age: index * 10, stem: "甲", branch: "子" })),
      wolun: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, stem: "乙", branch: "丑" })),
      nyunun: Array.from({ length: 10 }, (_, index) => ({ year: 2026 + index, stem: "丙", branch: "寅" })),
    },
    summary: { dayStem: "丁" },
  });
  assert.deepEqual(facts.manse.pillar.day, { stem: "丁", branch: "丑" });
  assert.equal(facts.manse.strength, "중화");
  assert.equal(facts.manse.daeun, undefined);
  assert.equal(facts.manse.wolun, undefined);
  assert.equal(facts.manse.nyunun, undefined);
});

test("Agent 도구는 선택 리포트와 현재 대화만 읽는다", () => {
  const tools = createReportTools({ snapshot: SNAPSHOT, history: [{ role: "user", content: "이전 질문" }] });
  assert.deepEqual(Object.keys(tools), [
    "get_report_overview",
    "get_report_section",
    "get_manse_facts",
    "get_conversation_history",
  ]);
  assert.equal(JSON.stringify(tools).includes("fetch"), false);
  assert.equal(JSON.stringify(tools).includes("http"), false);
  assert.equal(tools.get_report_section("career").title, "일과 이직");
  assert.equal(tools.get_conversation_history().length, 1);
});

test("질문의 핵심어와 가장 가까운 리포트 섹션을 선택한다", () => {
  assert.equal(selectRelevantSection(SNAPSHOT, "올해 이직과 계약은 어떤가요?").id, "career");
  assert.equal(selectRelevantSection(SNAPSHOT, "연애 관계가 궁금해요").id, "love");
});

test("프롬프트는 외부 조회와 리포트 안 명령 실행을 금지한다", () => {
  const prompt = buildChatSystemPrompt();
  assert.match(prompt, /외부 정보.*조회하지 않는다/s);
  assert.match(prompt, /리포트.*명령.*무시/s);
  assert.match(prompt, /근거가 부족/i);
  assert.match(prompt, /한국어/);
});

test("Agent는 최대 네 도구 결과와 질문만 모델에 전달한다", async () => {
  let captured;
  const deltas = [];
  const result = await runReportAgent({
    snapshot: SNAPSHOT,
    history: [{ role: "assistant", content: "이전 답변" }],
    question: "올해 이직은 어떤가요?",
    model: "deepseek-v4-flash",
    onDelta: (delta) => deltas.push(delta),
    generate: async (options) => {
      captured = options;
      await options.onDelta("가능성을 ");
      await options.onDelta("살펴보세요.");
      return { text: "가능성을 살펴보세요.", usage: { totalTokens: 20 }, model: options.model };
    },
  });
  const input = JSON.parse(captured.input);
  assert.equal(captured.maxTokens, 4096);
  assert.equal(input.question, "올해 이직은 어떤가요?");
  assert.equal(input.evidence.toolCalls.length, 4);
  assert.deepEqual(input.evidence.toolCalls.map((call) => call.name), [
    "get_report_overview",
    "get_report_section",
    "get_manse_facts",
    "get_conversation_history",
  ]);
  assert.equal(result.text, "가능성을 살펴보세요.");
  assert.deepEqual(deltas, ["가능성을 ", "살펴보세요."]);
});
