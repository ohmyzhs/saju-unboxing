import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin exposes supported fast models", async () => {
  const html = await readFile(new URL("../public/admin.html", import.meta.url), "utf8");
  assert.match(html, /value="deepseek-v4-flash"/);
  assert.match(html, /value="minimax-m3"/);
  assert.doesNotMatch(html, /deepseek·minimax 등은 분석이 실패합니다/);
});
