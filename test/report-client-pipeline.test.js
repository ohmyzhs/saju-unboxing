import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("브라우저 분석은 장기 SSE 대신 빠른 plan JSON 후 section을 병렬 요청한다", () => {
  const start = app.slice(app.indexOf("function startAnalysis"), app.indexOf("// ---------- Archive"));
  assert.doesNotMatch(start, /Accept:\s*"text\/event-stream"/);
  assert.doesNotMatch(start, /stream:\s*true/);
  assert.match(start, /AnalysisBatching\.chunkSections/);
  assert.match(start, /progressForSections/);
  assert.match(start, /해설 .*개/);
});
