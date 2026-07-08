import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultPrompt,
  composePromptForTest,
} from "../apps/api/src/legacy/_lib/analysis.js";

test("리포트 기본 프롬프트는 정중한 사극 하오체를 강제한다", () => {
  const prompt = defaultPrompt("saju-analysis");
  assert.match(prompt, /하오체|하오/);
  assert.match(prompt, /사극/);
  assert.match(prompt, /궁궐|조선|흑야/);
  assert.match(prompt, /~하오|~소서|~이다/);
  assert.doesNotMatch(prompt, /~네요\/~거예요\/~하시죠\/~해보세요/);
});

test("상품별 프롬프트를 조합해도 하오체 규칙이 유지된다", () => {
  const prompt = composePromptForTest("compatibility", "조금 더 현실적으로");
  assert.match(prompt, /하오체|하오/);
  assert.match(prompt, /사극/);
  assert.match(prompt, /위 규칙은 반드시 지킨다/);
});
