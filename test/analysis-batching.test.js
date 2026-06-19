import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import("../public/analysis-batching.js");

const { chunkSections } = globalThis.AnalysisBatching;

test("chunks odd section counts by two without changing order", () => {
  assert.deepEqual(chunkSections(["s0", "s1", "s2", "s3", "s4"]), [
    ["s0", "s1"],
    ["s2", "s3"],
    ["s4"],
  ]);
});

test("chunks even section counts and does not mutate input", () => {
  const sections = ["s0", "s1", "s2", "s3"];
  assert.deepEqual(chunkSections(sections), [["s0", "s1"], ["s2", "s3"]]);
  assert.deepEqual(sections, ["s0", "s1", "s2", "s3"]);
});

test("rejects invalid chunk sizes", () => {
  assert.throws(() => chunkSections(["s0"], 0), /크기/);
});

test("loads batching helper before app and keeps single-request fallback", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);
  assert.ok(html.indexOf("analysis-batching.js") < html.indexOf("app.js"));
  assert.match(app, /AnalysisBatching\.chunkSections\(sections\)/);
  assert.match(app, /sections: batch/);
  assert.match(app, /section: s/);
});
