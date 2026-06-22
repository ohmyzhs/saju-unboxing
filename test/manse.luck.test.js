// Phase 4 골든 — 대운/세운/월운. 기준 1992-03-14 여, 현재 2026-06-20. SAJULAB 대운 일치.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInput, computeChart } from "../apps/api/src/legacy/_lib/manse/calendar.js";
import { calcLuckCycles } from "../apps/api/src/legacy/_lib/manse/luckCycles.js";

const TODAY = new Date("2026-06-20T12:00:00Z");
const luck = () => {
  const norm = normalizeInput({ gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" });
  return calcLuckCycles(computeChart(norm), norm.y, TODAY);
};

test("대운 첫 주기 — SAJULAB 일치(임인, 정재/정관/사)", () => {
  const d = luck().daeun[0];
  assert.equal(d.age, 3);
  assert.equal(d.year, 1994);
  assert.equal(`${d.stem}${d.branch}`, "임인");
  assert.equal(d.stemTenGod, "정재");
  assert.equal(d.branchTenGod, "정관");
  assert.equal(d.twelveStage, "사");
});

test("현재 대운 — 35세 → 기해(비견/정재)", () => {
  const c = luck().currentDaeun;
  assert.equal(c.age, 33);
  assert.equal(c.stemTenGod, "비견");
  assert.equal(c.branchTenGod, "정재");
});

test("세운 — 2026 병오부터 10년", () => {
  const n = luck().nyunun;
  assert.equal(n.length, 10);
  assert.equal(n[0].year, 2026);
  assert.equal(`${n[0].stem}${n[0].branch}`, "병오");
});

test("월운 12개월 + 올해", () => {
  const l = luck();
  assert.equal(l.wolun.length, 12);
  assert.equal(l.wolun[0].month, 1);
  assert.equal(l.thisYear.year, 2026);
  assert.equal(l.thisYear.ganzhi, "병오");
});
