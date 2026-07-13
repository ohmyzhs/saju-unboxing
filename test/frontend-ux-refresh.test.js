import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("챗봇 상품 구매는 상담 선택 흐름과 분리된 레이어로 열린다", () => {
  assert.match(html, /data-chat-store-open/);
  assert.match(html, /data-chat-store[^>]*aria-hidden="true"[^>]*hidden/);
  assert.match(html, /class="chat-store-panel"[^>]*role="dialog"/);
  assert.match(app, /function openChatStore/);
  assert.match(app, /function closeChatStore/);
  assert.match(css, /\.chat-store-popover\.is-open \.chat-store-panel/);
});

test("상품 카탈로그는 상담방 목록과 독립적으로 로드하고 중복 요청을 합친다", () => {
  assert.match(app, /function loadChatCatalog\(\{ force = false \} = \{\}\)/);
  assert.match(app, /if \(chatCatalogPromise && !force\) return chatCatalogPromise/);
  assert.match(app, /loadChatCatalog\(\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(app, /Promise\.all\(\[\s*getJson\("\/api\/chat\/catalog"\)/);
  assert.match(css, /\.chat-product-skeleton/);
});

test("상담 리포트와 이전 상담은 선택 가능한 카드 목록으로 표현한다", () => {
  assert.match(html, /data-chat-report-choices/);
  assert.match(app, /class="chat-report-choice/);
  assert.match(app, /class="chat-session-card/);
  assert.match(app, /data-chat-report-choice/);
  assert.match(css, /\.chat-report-choice\.is-selected/);
});

test("결제 내역은 요약이 있는 원장형 목록이고 보관함은 서고형 카드다", () => {
  assert.match(app, /class="orders-overview"/);
  assert.match(app, /class="order-ledger"/);
  assert.match(html, /class="library-vault-intro"/);
  assert.match(app, /class="archive-card-seal"/);
  assert.match(app, /data-library-count/);
  assert.match(css, /\.library-vault-intro::after/);
});

test("무통장 계좌 설정은 한 줄 폼이고 처리 이력은 시맨틱 테이블이다", () => {
  assert.match(adminHtml, /class="deposit-bank-inline"/);
  assert.match(admin, /<table class="deposit-history-table">/);
  assert.match(admin, /<thead><tr><th scope="col">처리일/);
  assert.match(admin, /<tbody>\$\{processed\.map/);
  assert.match(css, /\.deposit-bank-inline\s*\{/);
  assert.match(css, /\.deposit-history-table-wrap/);
});
