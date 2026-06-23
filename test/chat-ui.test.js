import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("AI 챗봇 상담은 기존 추가 질문과 분리된 화면과 진입점을 가진다", () => {
  assert.match(html, /data-view="chat"/);
  assert.match(html, /data-view-target="chat"[^>]*>[\s\S]*?AI 챗봇 상담/);
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
