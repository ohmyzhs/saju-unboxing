import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("카드·간편결제 충전 수단은 준비 중 상태로 비활성화한다", () => {
  assert.match(app, /data-deposit-method="toss" disabled aria-disabled="true"/);
  assert.match(app, /<small>결제수단 준비중<\/small>/);
  assert.doesNotMatch(app, /토스 심사 중 — 현재는 무통장입금을 이용해주세요/);
  assert.doesNotMatch(app, /data-deposit-method='toss'[^\n]+addEventListener/);
  assert.match(css, /\.deposit-method:disabled\s*\{/);
});

test("최근 포인트 내역은 기본 닫힘 상태의 details로 제공한다", () => {
  assert.match(html, /<details class="point-history">/);
  assert.doesNotMatch(html, /<details class="point-history"[^>]*\sopen/);
  assert.match(html, /<summary><span>최근 포인트 내역<\/span>/);
  assert.match(css, /\.point-history\[open\] summary i::before\s*\{ content: "접기"/);
  assert.match(css, /\.point-history summary i::before\s*\{ content: "펼치기"/);
});
