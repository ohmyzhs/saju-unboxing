import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("강무영 상담각은 흑야 문답과 분리된 화면과 진입점을 가진다", () => {
  assert.match(html, /data-view="chat"/);
  assert.match(html, /data-view-target="chat"[^>]*>[\s\S]*?강무영 상담각/);
  assert.match(html, /data-view-target="followup"[^>]*>[\s\S]*?흑야 문답/);
  assert.match(html, /data-category="consult"[\s\S]*?data-view-target="chat"/);
  assert.match(html, /data-chat-products/);
  assert.match(html, /data-chat-report-select/);
  assert.match(html, /data-chat-messages/);
  assert.match(html, /data-chat-composer/);
});

test("챗봇 스트림 모듈은 앱보다 먼저 로드된다", () => {
  assert.ok(html.indexOf("chat-stream.js") >= 0);
  assert.ok(html.indexOf("chat-stream.js") < html.indexOf("app.js"));
});

test("챗봇 Markdown 렌더러는 앱보다 먼저 로드되고 assistant 응답에만 사용된다", () => {
  assert.ok(html.indexOf("chat-markdown.js") >= 0);
  assert.ok(html.indexOf("chat-markdown.js") < html.indexOf("app.js"));
  assert.match(app, /renderChatAssistantContent/);
  assert.match(app, /ChatMarkdown\.render/);
  assert.match(css, /\.chat-markdown/);
});

test("선택한 리포트 원문은 대화방 안에서 70% 플로팅 미리보기로 다시 볼 수 있다", () => {
  assert.match(html, /data-chat-report-preview-open/);
  assert.match(html, /data-chat-report-preview/);
  assert.match(html, /role="dialog"/);
  assert.ok(html.indexOf("chat-report-preview.js") >= 0);
  assert.ok(html.indexOf("chat-report-preview.js") < html.indexOf("app.js"));
  assert.match(app, /openChatReportPreview/);
  assert.match(app, /closeChatReportPreview/);
  assert.match(app, /chatState\.detail\.report/);
  assert.match(css, /\.chat-report-preview-panel[\s\S]*width:\s*min\(70vw,/);
  assert.match(css, /\.chat-report-preview-panel[\s\S]*height:\s*70dvh/);
  assert.match(css, /\.chat-report-preview\.is-open[\s\S]*transform:\s*translateY\(0\)\s*scale\(1\)/);
});

test("챗봇 UI는 상품·대화방·질문 API와 결제 완료 복귀를 연결한다", () => {
  assert.match(app, /\/api\/chat\/catalog/);
  assert.match(app, /\/api\/chat\/sessions/);
  assert.match(app, /\/messages`/);
  assert.match(app, /isChatCreditProductId/);
  assert.match(app, /completeChatCreditPurchase/);
});

test("비로그인 상태에서는 챗봇 작업영역의 hidden 속성이 레이아웃보다 우선한다", () => {
  assert.match(css, /\.chat-workspace\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
});
