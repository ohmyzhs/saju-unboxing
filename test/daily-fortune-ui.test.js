import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../public/daily-fortune-ui.js");

const { normalizePillar } = globalThis.DailyFortuneUI;
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("normalizes Korean and Hanja pillar strings", () => {
  assert.deepEqual(normalizePillar("임신"), {
    stemKo: "임",
    stemHanja: "壬",
    branchKo: "신",
    branchHanja: "申",
    unknown: false,
  });
  assert.deepEqual(normalizePillar("壬申"), {
    stemKo: "임",
    stemHanja: "壬",
    branchKo: "신",
    branchHanja: "申",
    unknown: false,
  });
});

test("normalizes object pillars and marks missing birth hour as unknown", () => {
  assert.deepEqual(normalizePillar({ stem: "임", branch: "신" }), {
    stemKo: "임",
    stemHanja: "壬",
    branchKo: "신",
    branchHanja: "申",
    unknown: false,
  });
  assert.deepEqual(normalizePillar(null), {
    stemKo: "",
    stemHanja: "",
    branchKo: "",
    branchHanja: "",
    unknown: true,
  });
});

test("daily result uses the normalizer before rendering pillars", () => {
  assert.ok(html.indexOf("daily-fortune-ui.js") >= 0);
  assert.ok(html.indexOf("daily-fortune-ui.js") < html.indexOf("app.js"));
  assert.match(app, /DailyFortuneUI\.normalizePillar/);
  assert.match(app, /mcell-unknown/);
});

test("daily hero reserves a grid column for the score", () => {
  assert.match(css, /\.daily-hero\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.daily-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
  assert.match(css, /\.daily-score\s*\{[^}]*position:\s*static/s);
  assert.match(css, /@media\s*\(max-width:\s*420px\)[\s\S]*\.daily-hero/);
});
