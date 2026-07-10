import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("앱 shell은 기기 가로폭 전체를 사용하고 고정 최대폭을 다시 적용하지 않는다", () => {
  assert.match(css, /\.app-shell\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none/);
  assert.doesNotMatch(css, /\.app-shell\s*\{[^}]*max-width:\s*(?:430|760|1180)px/);
  assert.doesNotMatch(css, /--shell-max/);
  assert.match(css, /\.bottom-nav\s*\{[\s\S]*?width:\s*100%/);
});

test("태블릿 이상에서는 상품·목록·채팅 로비가 넓은 화면을 활용한다", () => {
  assert.match(css, /@media \(min-width:\s*760px\)/);
  assert.match(css, /\.product-grid\s*\{[\s\S]*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\)/);
  assert.match(css, /\.wide-content\s*\{[\s\S]*max-width:\s*var\(--content-max\)/);
  assert.match(css, /\.chat-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(320px,\s*0\.82fr\)/);
});
