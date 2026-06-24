import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../apps/web/public/analysis-stream.js");

const { createParser, progressForPlanWait, progressForSections } = globalThis.AnalysisStream;

test("parses an SSE event split across arbitrary chunks", () => {
  const events = [];
  const parser = createParser((event) => events.push(event));
  parser.feed("event: plan_");
  parser.feed('ready\ndata: {"total":8,"message":"준비"}\n');
  parser.feed("\n");
  parser.end();

  assert.deepEqual(events, [{
    event: "plan_ready",
    data: { total: 8, message: "준비" },
  }]);
});

test("parses multiple events and joins multiline data", () => {
  const events = [];
  const parser = createParser((event) => events.push(event));
  parser.feed('event: started\r\ndata: {"progress":5}\r\n\r\nevent: heartbeat\n');
  parser.feed('data: {"stage":\n');
  parser.feed('data: "plan"}\n\n');
  parser.end();

  assert.deepEqual(events, [
    { event: "started", data: { progress: 5 } },
    { event: "heartbeat", data: { stage: "plan" } },
  ]);
});

test("maps completed section counts to the real 40-95 range", () => {
  assert.equal(progressForSections(0, 8), 40);
  assert.equal(progressForSections(4, 8), 68);
  assert.equal(progressForSections(8, 8), 95);
  assert.equal(progressForSections(99, 0), 40);
});

test("plan 응답 대기 중 진행률은 5%에서 움직이되 35%를 넘지 않는다", () => {
  assert.equal(progressForPlanWait(0), 5);
  assert.equal(progressForPlanWait(1), 8);
  assert.equal(progressForPlanWait(5), 20);
  assert.equal(progressForPlanWait(99), 35);
});

test("loads stream helper before app", () => {
  const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("analysis-stream.js") >= 0);
  assert.ok(html.indexOf("analysis-stream.js") < html.indexOf("app.js"));
});
