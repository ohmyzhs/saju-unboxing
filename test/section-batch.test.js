import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSectionPrompt,
  generateSections,
  validateSectionBatch,
} from "../api/_lib/analysis.js";

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
    requestStructured: async ({ model, name, schema }) => {
      calls += 1;
      assert.equal(model, "deepseek-v4-flash");
      assert.equal(name, "saju_sections");
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
