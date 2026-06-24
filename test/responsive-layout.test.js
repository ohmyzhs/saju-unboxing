import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("앱 shell과 하단 nav는 모바일 430px 고정폭 대신 반응형 최대폭을 사용한다", () => {
  assert.match(css, /--shell-max:\s*1180px/);
  assert.match(css, /\.app-shell\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--shell-max\)\)/);
  assert.match(css, /\.bottom-nav\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--shell-max\)\)/);
  assert.doesNotMatch(css, /\.app-shell\s*\{[\s\S]*width:\s*min\(100%,\s*430px\)/);
  assert.doesNotMatch(css, /\.bottom-nav\s*\{[\s\S]*width:\s*min\(100%,\s*430px\)/);
});

test("태블릿 이상에서는 상품·목록·채팅 로비가 넓은 화면을 활용한다", () => {
  assert.match(css, /@media \(min-width:\s*760px\)/);
  assert.match(css, /\.product-grid\s*\{[\s\S]*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\)/);
  assert.match(css, /\.wide-content\s*\{[\s\S]*max-width:\s*var\(--content-max\)/);
  assert.match(css, /\.chat-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(320px,\s*0\.82fr\)/);
});
