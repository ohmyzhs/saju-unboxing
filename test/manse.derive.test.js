// Phase 2 골든 — 결정적 파생. 기준: 1992-03-14 05:30 여(KST → 임신/계묘/기축/정묘).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInput, computeChart } from "../apps/api/src/legacy/_lib/manse/calendar.js";
import { deriveDetails } from "../apps/api/src/legacy/_lib/manse/derive.js";

const PROFILE = { gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" };
const derive = (p) => deriveDetails(computeChart(normalizeInput(p)));

test("납음오행 — 60갑자 표준표", () => {
  const d = derive(PROFILE);
  assert.equal(d.napeum.year, "검봉금"); // 임신
  assert.equal(d.napeum.month, "금박금"); // 계묘
  assert.equal(d.napeum.day, "벽력화"); // 기축
  assert.equal(d.napeum.hour, "노중화"); // 정묘
});

test("십이운성 봉법 — 일간 기(己) 기준", () => {
  const d = derive(PROFILE);
  assert.equal(d.twelveStages.year, "목욕"); // 申
  assert.equal(d.twelveStages.month, "병"); // 卯
  assert.equal(d.twelveStages.day, "묘"); // 丑
  assert.equal(d.twelveStages.hour, "병"); // 卯
});

test("오행 분포 + 음양", () => {
  const d = derive(PROFILE);
  assert.deepEqual(d.elements, { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 });
  assert.deepEqual(d.yinyang, { yin: 6, yang: 2 });
});

test("십성통계 5그룹 (관살→관성 매핑)", () => {
  const d = derive(PROFILE);
  assert.deepEqual(d.tenGodStats, { bigyeop: 1, siksang: 1, jaeseong: 2, gwanseong: 2, inseong: 1 });
});

test("지장간(여기/중기/본기) + 형충(묘묘 병존)", () => {
  const d = derive(PROFILE);
  assert.deepEqual(d.hiddenStems.day, { yeogi: "계", junggi: "신", bongi: "기" }); // 축
  assert.ok(d.hyungchung.jijiByeongjon.includes("묘묘"));
});

test("시간 미상 — 6글자 집계 + 시주 파생 보류", () => {
  const d = derive({ gender: "male", birthDate: "1992-03-14", timeKnown: "no", calendar: "solar" });
  assert.equal(d.countBasis, "6글자(시주 미상)");
  assert.equal(d.napeum.hour, null);
  assert.equal(d.twelveStages.hour, null);
  assert.equal(d.hiddenStems.hour, null);
});
