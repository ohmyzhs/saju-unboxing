import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlanPrompt,
  buildSectionPrompt,
  generatePlan,
  generateSections,
  validateSectionBatch,
} from "../apps/api/src/legacy/_lib/analysis.js";

test("builds a compact plan-only prompt and preserves admin instructions", () => {
  const prompt = buildPlanPrompt({
    productId: "saju-analysis",
    extra: "관리자 지침: 현실적인 직장 예시를 쓴다.",
    profile: { name: "가람" },
  });
  assert.match(prompt, /현실적인 직장 예시/);
  assert.match(prompt, /headline/);
  assert.match(prompt, /7~10개/);
  assert.doesNotMatch(prompt, /각 섹션 body는 3~4문단/);
  assert.doesNotMatch(prompt, /지장간·납음·십이운성/);
  assert.ok(prompt.length < 2400, `compact plan prompt is too long: ${prompt.length}`);
});

test("keeps product focus in the compact plan prompt", () => {
  const common = { extra: "", profile: { name: "가람" } };
  assert.match(buildPlanPrompt({ ...common, productId: "cycle" }), /10년/);
  assert.match(buildPlanPrompt({ ...common, productId: "yearly-fortune" }), /계절|월별/);
  assert.match(buildPlanPrompt({
    ...common,
    productId: "compatibility",
    partner: { name: "누리" },
  }), /점수|두 사람/);
});

test("caps plan output and passes a plan-specific timeout", async () => {
  let requestOptions;
  const plan = await generatePlan({
    productId: "saju-analysis",
    productName: "기본 사주 리포트",
    profile: { name: "가람", gender: "female", birthDate: "1990-01-01" },
    manse: { 기준: "테스트" },
    model: "deepseek-v4-flash",
  }, {
    requestStructured: async (options) => {
      requestOptions = options;
      return {
        headline: "선명한 한 줄",
        sections: Array.from({ length: 7 }, (_, index) => ({
          icon: "✨",
          title: `제목 ${index}`,
          angle: `핵심 ${index}`,
        })),
        lucky: { why: "이유", whyKeywords: ["균형", "보완"], personalNote: "한 줄" },
      };
    },
  });

  assert.equal(requestOptions.maxTokens, 8192);
  assert.equal(requestOptions.timeoutMs, 70000);
  assert.equal(plan.sections.length, 7);
});

test("returns batch bodies in requested section order", () => {
  const result = validateSectionBatch(
    [{ id: "s0" }, { id: "s1" }],
    [{ id: "s1", body: "둘" }, { id: "s0", body: "하나" }],
  );
  assert.deepEqual(result, [
    { id: "s0", body: "하나" },
    { id: "s1", body: "둘" },
  ]);
});

test("rejects missing section ids", () => {
  assert.throws(
    () => validateSectionBatch(
      [{ id: "s0" }, { id: "s1" }],
      [{ id: "s0", body: "하나" }],
    ),
    /s1/,
  );
});

test("rejects duplicate and unknown section ids", () => {
  const requested = [{ id: "s0" }, { id: "s1" }];
  assert.throws(() => validateSectionBatch(requested, [
    { id: "s0", body: "하나" },
    { id: "s0", body: "중복" },
  ]), /s0/);
  assert.throws(() => validateSectionBatch(requested, [
    { id: "s0", body: "하나" },
    { id: "s2", body: "모름" },
  ]), /s2/);
});

test("rejects empty section bodies", () => {
  assert.throws(
    () => validateSectionBatch([{ id: "s0" }], [{ id: "s0", body: "  " }]),
    /본문/,
  );
});

test("builds a compact body-only prompt and preserves admin instructions", () => {
  const prompt = buildSectionPrompt({
    productId: "saju-analysis",
    extra: "관리자 지침: 현실적인 예시를 쓴다.",
    profile: { name: "가람" },
    sections: [{ id: "s0", title: "첫 제목", angle: "핵심" }],
    otherTitles: ["첫 제목", "둘째 제목"],
  });
  assert.match(prompt, /3~4문단/);
  assert.match(prompt, /관리자 지침: 현실적인 예시를 쓴다/);
  assert.match(prompt, /둘째 제목/);
  assert.doesNotMatch(prompt, /끝맺음 분산/);
  assert.doesNotMatch(prompt, /개운파생근거/);
  assert.ok(prompt.length < 1800, `compact prompt is too long: ${prompt.length}`);
});

test("keeps each product's interpretation focus in the compact prompt", () => {
  const common = {
    extra: "",
    profile: { name: "가람" },
    sections: [{ id: "s0", title: "제목", angle: "핵심" }],
    otherTitles: ["제목"],
  };
  assert.match(buildSectionPrompt({ ...common, productId: "cycle" }), /10년 단위/);
  assert.match(buildSectionPrompt({ ...common, productId: "yearly-fortune" }), /계절|월별/);
  assert.match(buildSectionPrompt({
    ...common,
    productId: "compatibility",
    partner: { name: "누리" },
  }), /어느 한쪽도 깎아내리지/);
});

test("generates two section bodies with one structured request", async () => {
  let calls = 0;
  const sections = [
    { id: "s0", title: "첫 제목", angle: "첫 핵심" },
    { id: "s1", title: "둘째 제목", angle: "둘째 핵심" },
  ];
  const result = await generateSections({
    productId: "saju-analysis",
    profile: { name: "가람" },
    context: { 기준: "테스트" },
    sections,
    otherTitles: sections.map((section) => section.title),
    model: "deepseek-v4-flash",
  }, {
    requestStructured: async ({ model, name, schema, maxTokens, timeoutMs }) => {
      calls += 1;
      assert.equal(model, "deepseek-v4-flash");
      assert.equal(name, "saju_sections");
      assert.equal(maxTokens, 8192);
      assert.equal(timeoutMs, 90000);
      assert.equal(schema.properties.sections.minItems, 2);
      return {
        sections: [
          { id: "s1", body: "둘째 본문" },
          { id: "s0", body: "첫 본문" },
        ],
      };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, [
    { id: "s0", body: "첫 본문" },
    { id: "s1", body: "둘째 본문" },
  ]);
});
