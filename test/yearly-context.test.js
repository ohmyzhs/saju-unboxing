import test from "node:test";
import assert from "node:assert/strict";

import { buildYearlyContext } from "../apps/api/src/legacy/_lib/sajuContext.js";

function fakeManse() {
  return {
    summary: {
      dayStem: "丁",
      dayBranch: "丑",
      strength: { label: "중화" },
      yongsin: "목",
      currentDaeun: { age: 42 },
      thisYear: { year: 2026, age: 47 },
    },
    full: {
      pillar: {
        year: { stem: "庚", branch: "申", stemTenGod: "정재", branchTenGod: "정관" },
        month: { stem: "丙", branch: "戌", stemTenGod: "겁재", branchTenGod: "상관" },
        day: { stem: "丁", branch: "丑", stemTenGod: "일간", branchTenGod: "식신" },
        hour: { stem: "丙", branch: "午", stemTenGod: "겁재", branchTenGod: "비견" },
      },
      yongsin: { yongsin: "木", huisin: "火", gisin: "金" },
      tenGodStats: {},
      hyungchung: [],
      daeun: [],
      nyunun: Array.from({ length: 10 }, (_, index) => ({
        year: 2026 + index,
        age: 47 + index,
        stem: "丙",
        branch: "寅",
        stemTenGod: "겁재",
        branchTenGod: "정인",
        twelveStage: "장생",
        bojoShinsal: [],
      })),
      wolunByYear: {
        2028: [{ month: 1, stem: "甲", branch: "寅", stemTenGod: "정인", branchTenGod: "정인" }],
      },
      wolun: [{ month: 1, stem: "庚", branch: "寅", stemTenGod: "정재", branchTenGod: "정인" }],
    },
  };
}

test("연도별 운세 컨텍스트는 선택한 한 해와 그 해 월운만 보낸다", () => {
  const ctx = buildYearlyContext(fakeManse(), 2028);

  assert.equal(ctx.대상연도, 2028);
  assert.deepEqual(ctx.세운.map((item) => item.연도), [2028]);
  assert.equal(ctx.올해월운.length, 1);
  assert.equal(ctx.올해월운[0].간지, "甲寅");
});
