import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("보관함 결과 카드는 좌우 여백을 포함해 화면 폭을 넘지 않는다", () => {
  const matches = [...css.matchAll(/\.archive-card\[data-archive-id\]\s*\{([^}]+)\}/g)];
  assert.ok(matches.length > 0, "보관함 카드 스타일이 필요합니다.");
  const rule = matches.at(-1)[1];
  assert.match(rule, /width:\s*calc\(100%\s*-\s*32px\)/);
  assert.match(rule, /box-sizing:\s*border-box/);
});
