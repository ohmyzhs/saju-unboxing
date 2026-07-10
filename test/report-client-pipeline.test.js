import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("브라우저 분석은 장기 SSE 대신 빠른 plan JSON 후 section을 병렬 요청한다", () => {
  const start = app.slice(app.indexOf("function startAnalysis"), app.indexOf("// ---------- Archive"));
  assert.doesNotMatch(start, /Accept:\s*"text\/event-stream"/);
  assert.doesNotMatch(start, /stream:\s*true/);
  assert.match(start, /AnalysisBatching\.chunkSections/);
  assert.match(start, /progressForSections/);
  assert.match(start, /해설 .*개/);
});

test("리포트 placeholder를 그린 뒤에도 진행률을 유지하고 전체 완료 후에만 숨긴다", () => {
  const start = app.slice(app.indexOf("function startAnalysis"), app.indexOf("// ---------- Archive"));
  const planBranch = start.slice(start.indexOf('if (data.mode === "plan"'), start.indexOf("// ── 기존 1샷"));
  const renderAt = planBranch.indexOf("renderAnalysisResult");
  const sectionsAt = planBranch.indexOf("await Promise.all");
  const hideAt = planBranch.indexOf("loading.hidden = true");

  assert.match(start, /progressForPlanWait/);
  assert.ok(renderAt >= 0 && sectionsAt > renderAt, "placeholder 리포트 뒤에 섹션 요청이 이어져야 한다");
  assert.ok(hideAt === -1 || hideAt > sectionsAt, "섹션 요청 전에 진행률을 숨기면 안 된다");
  assert.match(planBranch, /await Promise\.all[\s\S]*completeAnalysisLoading\(/);
});

test("연도별 운세는 선택 연도를 결제와 분석 요청까지 전달한다", () => {
  assert.match(app, /function selectedYearlyTarget/);
  assert.match(app, /targetYear:\s*productId === "yearly-fortune"/);
  assert.match(app, /targetYear:\s*context\.targetYear/);
  assert.match(app, /targetYear:\s*meta\.targetYear/);
});

test("실패한 리포트 섹션은 placeholder 저장 대신 섹션별 재생성 버튼을 제공한다", () => {
  assert.match(app, /data-section-retry/);
  assert.match(app, /function retryReportSection/);
  assert.match(app, /markSectionFailed/);
  assert.doesNotMatch(app, /s\.body = "이 부분은 잠시 후 다시 펼쳐 주세요\."/);
});

test("단일 섹션 자동 복구와 재생성은 서버의 OpenRouter 재시도를 끝까지 기다린다", () => {
  assert.match(app, /const SECTION_RETRY_TIMEOUT_MS = 145000/);
  assert.match(app, /section: s[\s\S]*SECTION_RETRY_TIMEOUT_MS/);
  assert.match(app, /retryReportSection[\s\S]*SECTION_RETRY_TIMEOUT_MS/);
});
