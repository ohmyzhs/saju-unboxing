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

test("streams real stages and falls back only the failed batch", async () => {
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
    generateSections: async ({ sections: requested }) => {
      calls.push(requested.map((section) => section.id));
      if (requested.length === 2) throw new Error("batch failed");
      return requested.map((section) => ({ id: section.id, body: `${section.id} 본문` }));
    },
    heartbeatMs: 0,
  });

  assert.deepEqual(calls, [["s0", "s1"], ["s2"], ["s0"], ["s1"]]);
  assert.deepEqual(
    events.filter(({ event }) => event !== "section_ready").map(({ event }) => event),
    ["started", "manse_ready", "plan_started", "plan_ready", "complete"],
  );
  assert.equal(events.filter(({ event }) => event === "section_ready").length, 3);
  assert.deepEqual(result.sections.map(({ id, body }) => [id, body]), [
    ["s0", "s0 본문"],
    ["s1", "s1 본문"],
    ["s2", "s2 본문"],
  ]);
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
