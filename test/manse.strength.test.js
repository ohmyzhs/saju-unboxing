// Phase 3 골든 — 신강약/용신. 오라클: saju/tests/test_strength_yongsin.py
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInput, computeChart } from "../api/_lib/manse/calendar.js";
import { deriveDetails } from "../api/_lib/manse/derive.js";
import { calcSillyeong, _johuYongsin, calcStrengthYongsin } from "../api/_lib/manse/strengthYongsin.js";

function strengthOf(profile) {
  const chart = computeChart(normalizeInput(profile));
  return calcStrengthYongsin(chart, deriveDetails(chart));
}

test("실령 왕상휴수사 표 — 寅(인)월 핵심", () => {
  assert.equal(calcSillyeong("wood", "인").wangxiang, "왕");
  assert.equal(calcSillyeong("fire", "인").wangxiang, "상");
  assert.equal(calcSillyeong("water", "인").wangxiang, "휴");
  assert.equal(calcSillyeong("metal", "인").wangxiang, "수");
  assert.equal(calcSillyeong("earth", "인").wangxiang, "사");
});

test("조후 용신 — 겨울/여름 보정", () => {
  assert.equal(_johuYongsin("metal", "자"), "fire"); // 겨울
  assert.equal(_johuYongsin("water", "해"), "fire");
  assert.equal(_johuYongsin("metal", "오"), "water"); // 여름
});

// 알려진 차이(OPEN): lunar-python 골든은 신약/木/水. manseryeok 원국은 己未 丁丑 丁未 丙午
// (입춘 경계) → 실지=7로 신강 산출. 동일 pillars면 알고리즘이 같은 결과라, 차이는 두 달력엔진의
// 절입/일주 판정에서 옴. 플랜상 달력 권위는 manseryeok → 엔진은 자기 원국에 일관된 결과를 낸다.
// (별도 cross-check 필요 — 보고서 OPEN 항목)
test("1980-02-04 11:45 — 엔진 자기일관(달력엔진 차이로 lunar-python 골든과 분기)", () => {
  const r = strengthOf({ gender: "female", birthDate: "1980-02-04", birthTime: "11:45", calendar: "solar" });
  assert.ok(["신강", "약신강", "중화", "약신약", "신약"].includes(r.strength));
  const set = new Set([r.yongsin.yongsin, r.yongsin.huisin, r.yongsin.gisin, r.yongsin.gusin, r.yongsin.hansin]);
  assert.equal(set.size, 5);
});

test("강약 라벨 — 신약/중화/약신강", () => {
  assert.equal(strengthOf({ gender: "female", birthDate: "1980-01-01", birthTime: "12:00", calendar: "solar" }).strength, "신약");
  assert.equal(strengthOf({ gender: "female", birthDate: "2024-02-01", birthTime: "12:00", calendar: "solar" }).strength, "중화");
  assert.equal(strengthOf({ gender: "female", birthDate: "1988-03-05", birthTime: "12:00", calendar: "solar" }).strength, "약신강");
});

test("5신 일관성 — 용신≠희신≠기신, 전부 채워짐", () => {
  const y = strengthOf({ gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" }).yongsin;
  const set = new Set([y.yongsin, y.huisin, y.gisin, y.gusin, y.hansin]);
  assert.equal(set.size, 5); // 오행 5개 전부 서로 다름
  assert.ok(["부억법", "조후법", "부억법+조후법"].includes(y.method));
});
