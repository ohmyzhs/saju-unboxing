import test from "node:test";
import assert from "node:assert/strict";
import { generatePlan } from "../apps/api/src/legacy/_lib/analysis.js";

const args = {
  productId: "yearly-fortune",
  productName: "연도별 운세",
  profile: { name: "가별", gender: "M", birthDate: "1980-10-31" },
  manse: { summary: {}, full: {} },
  model: "deepseek-v4-flash",
};

test("리포트 plan은 짧은 단일 요청으로 제한한다", async () => {
  let options;
  await generatePlan(args, {
    requestStructured: async (value) => {
      options = value;
      return {
        headline: "올해의 흐름",
        sections: Array.from({ length: 7 }, (_, index) => ({ icon: "✦", title: `제목 ${index}`, angle: `관점 ${index}` })),
        lucky: { why: "이유", whyKeywords: ["균형", "실행"], personalNote: "한 줄" },
      };
    },
  });
  assert.ok(options.maxTokens <= 2400);
  assert.ok(options.timeoutMs <= 18_000);
  assert.equal(options.maxAttempts, 1);
});

test("plan 공급자가 지연·실패하면 제품별 outline으로 즉시 폴백한다", async () => {
  const result = await generatePlan(args, {
    requestStructured: async () => { throw Object.assign(new Error("provider timeout"), { statusCode: 504 }); },
  });
  assert.equal(result.sections.length, 7);
  assert.ok(result.sections.every((section) => section.id && section.title && section.angle));
  assert.match(result.headline, /가별/);
  assert.equal(result.fallback, true);
});
