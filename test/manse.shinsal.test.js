// Phase 3b 골든 — 신살. 기준 1992-03-14(년지 申, 일간 己). SAJULAB 값과 대조(시주는 KST라 제외).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInput, computeChart } from "../apps/api/src/legacy/_lib/manse/calendar.js";
import { calcShinsal } from "../apps/api/src/legacy/_lib/manse/shinsal.js";

const sh = (p) => calcShinsal(computeChart(normalizeInput(p)));
const PROFILE = { gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" };

test("십이신살(년지 申 기준) — SAJULAB 일치", () => {
  const s = sh(PROFILE);
  assert.equal(s.byPillar.year.shensha, "지살"); // 申
  assert.equal(s.byPillar.month.shensha, "육해살"); // 卯
  assert.equal(s.byPillar.day.shensha, "반안살"); // 丑
});

test("공망·천을귀인 — SAJULAB 일치", () => {
  const s = sh(PROFILE);
  assert.equal(s.gongmangDay, "오미"); // 午未
  assert.equal(s.tianyiGuiren, "자신"); // 己 → 子申
});

test("주요신살 — 년지 申 자리에 천을귀인(申∈子申)", () => {
  const s = sh(PROFILE);
  assert.ok(s.byPillar.year.bojoShinsal.includes("천을귀인"));
});

test("시간 미상 — 시주 신살 보류", () => {
  const s = sh({ gender: "male", birthDate: "1992-03-14", timeKnown: "no", calendar: "solar" });
  assert.equal(s.byPillar.hour, null);
  assert.equal(s.byPillar.day.shensha, "반안살"); // 일주는 유지
});
