import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyFortuneInput } from "../apps/api/src/legacy/_lib/analysis.js";
import { personKey } from "../apps/api/src/legacy/saju/analyze.js";

test("오늘운세 모델 입력에 사용자가 고른 현재 마음을 포함한다", () => {
  const input = buildDailyFortuneInput({
    profile: { name: "가별", gender: "M", birthDate: "1980-10-31" },
    summary: { dayMaster: "경" },
    today: { iso: "2026-06-23" },
    todayPillar: { ganzhi: "무진" },
    mood: "배우자와의 관계가 고민됨",
  });
  assert.equal(input.currentMood, "배우자와의 관계가 고민됨");
});

test("오늘운세 서버 캐시는 마음 입력이 다르면 분리한다", () => {
  const profile = { name: "가별", birthDate: "1980-10-31", birthTime: "12:00", gender: "M" };
  assert.notEqual(personKey(profile, "일에 몰입"), personKey(profile, "관계가 신경 쓰임"));
});
