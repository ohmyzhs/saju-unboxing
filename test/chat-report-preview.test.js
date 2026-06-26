import test from "node:test";
import assert from "node:assert/strict";

let previewApi = null;
try {
  await import("../apps/web/public/chat-report-preview.js");
  previewApi = globalThis.ChatReportPreview;
} catch {
  // The first TDD run intentionally reaches this path before the module exists.
}

test("리포트 미리보기는 중첩된 분석 스냅샷을 화면용 데이터로 정규화한다", () => {
  assert.ok(previewApi);
  const normalized = previewApi.normalizeReport({
    productName: "대운의 흐름",
    profileName: "변유나",
    analysis: {
      headline: "변유나님의 대운",
      summary: "핵심 요약",
      sections: [{ title: "좋은 시기", body: "41세부터 50세" }],
    },
  });

  assert.equal(normalized.productName, "대운의 흐름");
  assert.equal(normalized.profileName, "변유나");
  assert.equal(normalized.headline, "변유나님의 대운");
  assert.equal(normalized.summary, "핵심 요약");
  assert.deepEqual(normalized.sections, [{ title: "좋은 시기", body: "41세부터 50세" }]);
});

test("리포트 미리보기는 평면 스냅샷도 지원하고 사용자 HTML을 이스케이프한다", () => {
  assert.ok(previewApi);
  const html = previewApi.render({
    productName: "택일 리포트",
    headline: "좋은 날",
    sections: [{ title: "<script>제목</script>", body: "첫 문단\n\n둘째 <b>문단</b>" }],
  });

  assert.match(html, /택일 리포트/);
  assert.match(html, /좋은 날/);
  assert.match(html, /&lt;script&gt;제목&lt;\/script&gt;/);
  assert.match(html, /첫 문단/);
  assert.match(html, /둘째 &lt;b&gt;문단&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
