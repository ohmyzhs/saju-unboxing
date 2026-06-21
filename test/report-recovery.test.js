import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../public/report-recovery.js");

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("리포트 설계 응답을 즉시 보관할 초안으로 만든다", () => {
  const draft = globalThis.ReportRecovery.createDraft({
    id: "analysis-o1",
    orderId: "o1",
    productId: "saju-analysis",
    data: { headline: "제목", sections: [{ id: "s1", title: "성향" }], manse: { pillar: {} }, summary: { x: 1 } },
  });
  assert.equal(draft.generationStatus, "generating");
  assert.equal(draft.analysis.sections[0].body, "");
});

test("도착한 섹션을 같은 초안에 합치고 완료·실패 상태를 남긴다", () => {
  const draft = globalThis.ReportRecovery.createDraft({ id: "a1", data: { sections: [{ id: "s1", title: "성향" }] } });
  const updated = globalThis.ReportRecovery.mergeSection(draft, "s1", "본문");
  assert.equal(updated.analysis.sections[0].body, "본문");
  assert.equal(globalThis.ReportRecovery.finish(updated).generationStatus, "complete");
  assert.equal(globalThis.ReportRecovery.finish(updated, "failed", "시간 초과").generationError, "시간 초과");
});

test("분석 요청은 제한 시간과 초안 체크포인트를 사용한다", () => {
  assert.ok(html.indexOf("report-recovery.js") < html.indexOf("app.js"));
  assert.match(app, /REQUEST_TIMEOUT_MS/);
  assert.match(app, /AbortController/);
  assert.match(app, /saveAnalysisDraft/);
  assert.match(app, /analysisDraftSync/);
  assert.match(app, /reportStatus: "failed"/);
});
