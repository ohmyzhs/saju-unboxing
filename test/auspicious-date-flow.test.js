import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildPlanPrompt } from "../apps/api/src/legacy/_lib/analysis.js";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
const analyze = readFileSync(new URL("../apps/api/src/legacy/saju/analyze.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("택일 캘린더는 기본 사주가 아닌 유료 택일 상품으로 결제한다", () => {
  assert.match(app, /"auspicious-date":\s*\{[\s\S]*?planId:\s*"fortune"/);
  assert.match(admin, /"auspicious-date":\s*\{/);
  assert.match(app, /openMemberModal\("auspicious-date"\)/);
  assert.doesNotMatch(
    app.slice(app.indexOf("function bindCalendar"), app.indexOf("// ---------- Fortune mood chips")),
    /openMemberModal\("saju-analysis"\)/,
  );
});

test("택일 목적과 후보 날짜는 결제 복구를 거쳐 분석 API까지 전달된다", () => {
  assert.match(app, /currentCheckout\s*=\s*\{[\s\S]*?calendarPick/);
  assert.match(app, /calendarPick:\s*context\.calendarPick/);
  assert.match(app, /calendarPick:\s*purchase\.calendarPick/);
  assert.match(app, /calendarPick:\s*meta\.calendarPick/);
  assert.match(analyze, /calendarPick/);
});

test("택일 리포트 프롬프트는 선택 목적과 후보 날짜만 비교 대상으로 포함한다", () => {
  const prompt = buildPlanPrompt({
    productId: "auspicious-date",
    profile: { name: "가별" },
    calendarPick: { purpose: "이사", dates: ["2026-07-03", "2026-07-11"] },
  });

  assert.match(prompt, /이사/);
  assert.match(prompt, /2026-07-03/);
  assert.match(prompt, /2026-07-11/);
  assert.match(prompt, /후보 날짜/);
});

test("흰 배경의 중립 헤더는 어두운 제목과 뒤로 버튼을 사용한다", () => {
  assert.match(css, /\.view-title\s*\{[\s\S]*?color:\s*var\(--ink\)/);
  assert.match(css, /\.view-title button\s*\{[\s\S]*?color:\s*currentColor/);
  assert.match(css, /\.view-title\.emerald[\s\S]*?\.view-title\.rose[\s\S]*?color:\s*#fff/);
});
