import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  chunkSections,
  formatSse,
  runReportStream,
} from "../apps/api/src/legacy/_lib/reportStream.js";

const analyzeApi = readFileSync(new URL("../apps/api/src/legacy/saju/analyze.js", import.meta.url), "utf8");

test("analyze API exposes opt-in event streaming without replacing JSON mode", () => {
  assert.match(analyzeApi, /runReportStream/);
  assert.match(analyzeApi, /openSse/);
  assert.match(analyzeApi, /text\/event-stream/);
  assert.match(analyzeApi, /sendJson\(res, 200/);
});

test("formats named SSE events as one JSON data record", () => {
  assert.equal(
    formatSse("started", { progress: 5 }),
    'event: started\ndata: {"progress":5}\n\n',
  );
});

test("chunks sections without mutating their order", () => {
  const sections = ["a", "b", "c"];
  assert.deepEqual(chunkSections(sections, 2), [["a", "b"], ["c"]]);
  assert.deepEqual(sections, ["a", "b", "c"]);
});

test("SSE는 plan까지만 반환해 section 생성을 별도 함수 요청으로 분리한다", async () => {
  const events = [];
  const calls = [];
  const sections = [
    { id: "s0", icon: "1", title: "첫째", angle: "첫 핵심" },
    { id: "s1", icon: "2", title: "둘째", angle: "둘 핵심" },
    { id: "s2", icon: "3", title: "셋째", angle: "셋 핵심" },
  ];

  const result = await runReportStream({
    productId: "saju-analysis",
    productName: "기본 사주 리포트",
    profile: { name: "가람" },
    model: "deepseek-v4-flash",
  }, {
    emit: async (event, data) => events.push({ event, data }),
    computeManse: async () => ({
      full: { pillars: {} },
      summary: { dayMaster: "임" },
      cost: 1,
    }),
    generatePlan: async () => ({
      headline: "선명한 제목",
      sections,
      lucky: { color: "초록" },
      context: { 기준: "테스트" },
    }),
    generateSections: async ({ sections: requested }) => { calls.push(requested); throw new Error("호출되면 안 됨"); },
    heartbeatMs: 0,
  });

  assert.deepEqual(calls, []);
  assert.deepEqual(
    events.filter(({ event }) => event !== "section_ready").map(({ event }) => event),
    ["started", "manse_ready", "plan_started", "plan_ready", "complete"],
  );
  assert.equal(events.filter(({ event }) => event === "section_ready").length, 0);
  assert.equal(events.at(-1).data.planOnly, true);
  assert.ok(result.sections.every((section) => !section.body));
});

test("streams compatibility metadata with the shared pipeline", async () => {
  const events = [];
  await runReportStream({
    productId: "compatibility",
    productName: "관계 궁합 분석",
    profile: { name: "가람" },
    partner: { name: "누리" },
  }, {
    emit: async (event, data) => events.push({ event, data }),
    computeManse: async (profile) => ({ full: { name: profile.name }, summary: {}, cost: 1 }),
    generatePlan: async () => ({
      headline: "함께 자라는 사이",
      score: 82,
      scoreLabel: "다름이 힘이 되는 관계",
      hashtags: ["대화", "성장", "균형"],
      sections: [{ id: "s0", icon: "💞", title: "첫 장면", angle: "핵심" }],
      context: {},
    }),
    generateSections: async ({ sections }) => sections.map(({ id }) => ({ id, body: "본문" })),
    heartbeatMs: 0,
  });

  const plan = events.find(({ event }) => event === "plan_ready").data.data;
  assert.equal(plan.score, 82);
  assert.deepEqual(plan.partnerSummary, {});
});
