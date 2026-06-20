// Phase 1 골든 — 달력 커널/표준 원국. 정책: 고정 KST(진태양시 미적용).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInput, computeChart } from "../api/_lib/manse/calendar.js";

const chart = (profile) => computeChart(normalizeInput(profile));

test("1992-03-14 05:30 여(양력) — 연·월·일주 KASI 일치", () => {
  const c = chart({ gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" });
  assert.equal(c.pillars.year.ganji, "임신"); // 壬申
  assert.equal(c.pillars.month.ganji, "계묘"); // 癸卯
  assert.equal(c.pillars.day.ganji, "기축"); // 己丑
  assert.equal(c.pillars.year.ganjiHanja, "壬申");
});

test("KST 정책 — 05:30 은 卯시(정묘), 진태양시(寅시 병인)로 이동하지 않음", () => {
  const c = chart({ gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" });
  assert.equal(c.pillars.hour.ganji, "정묘"); // 丁卯 (KST). SAJULAB 진태양시는 丙寅 — 정책상 다름이 정상.
  assert.equal(c.policy.trueSolarTime, false);
});

test("공망·음력변환·대운(성별 필요)", () => {
  const c = chart({ gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" });
  assert.ok(c.voidBranches.includes("오") && c.voidBranches.includes("미")); // 午未 공망
  assert.deepEqual(c.lunar, { year: 1992, month: 2, day: 11, isLeapMonth: false });
  assert.ok(c.luck && typeof c.luck.startAge === "number"); // 대운수 산출
});

test("시간 미상 — 시주/시주십신 보류, 연월일주는 유지", () => {
  const c = chart({ gender: "male", birthDate: "1992-03-14", timeKnown: "no", calendar: "solar" });
  assert.equal(c.pillars.hour, null);
  assert.equal(c.tenGods.hour, null);
  assert.equal(c.dataQuality.hourPillarOmitted, true);
  assert.equal(c.pillars.day.ganji, "기축"); // 일주는 그대로
});

test("야자시 — 23:30 은 dayBoundary jasi 로 일주 천간이 다음날 기준", () => {
  const midnight = chart({ gender: "male", birthDate: "1992-03-14", birthTime: "23:30", calendar: "solar", yajasi: "no" });
  const jasi = chart({ gender: "male", birthDate: "1992-03-14", birthTime: "23:30", calendar: "solar", yajasi: "yes" });
  assert.equal(midnight.policy.dayBoundary, "midnight");
  assert.equal(jasi.policy.dayBoundary, "jasi");
  // 자정 기준은 당일 일주(기축), 야자시는 다음날 일주로 천간이 바뀐다
  assert.equal(midnight.pillars.day.ganji, "기축");
  assert.notEqual(jasi.pillars.day.stem, midnight.pillars.day.stem);
});
