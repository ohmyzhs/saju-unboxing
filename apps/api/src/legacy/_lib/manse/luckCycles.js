// 자체 만세력 엔진 — Phase 4: 대운·세운·월운.
// 대운은 manseryeok getLuckPillars(=calculateFourPillars.luckPillars, SAJULAB 일치 검증).
// 세운=연간지 공식, 월운=오호둔(五虎遁). 각 간지에 십성·십이운성·삼재 부착.
import { getTenGod, getBranchTenGod } from "manseryeok";

const KO_STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const KO_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const STAGES = ["장생", "목욕", "관대", "임관", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
const BONG_START = { 갑: "해", 병: "인", 무: "인", 경: "사", 임: "신", 을: "오", 정: "유", 기: "유", 신: "자", 계: "묘" };
const STEM_YANG = new Set(["갑", "병", "무", "경", "임"]);
function twelveStage(dayStem, branch) {
  const s = KO_BRANCHES.indexOf(BONG_START[dayStem]); const b = KO_BRANCHES.indexOf(branch);
  if (s < 0 || b < 0) return "";
  return STAGES[STEM_YANG.has(dayStem) ? (b - s + 12) % 12 : (s - b + 12) % 12];
}
function yearGanji(year) {
  return { stem: KO_STEMS[(year - 4 + 1000) % 10], branch: KO_BRANCHES[(year - 4 + 1200) % 12] };
}
// 삼재: 띠(년지) 삼합 → 3개 지지. 들/눌/날.
const SAMJAE = {
  신: ["인", "묘", "진"], 자: ["인", "묘", "진"], 진: ["인", "묘", "진"],
  인: ["신", "유", "술"], 오: ["신", "유", "술"], 술: ["신", "유", "술"],
  사: ["해", "자", "축"], 유: ["해", "자", "축"], 축: ["해", "자", "축"],
  해: ["사", "오", "미"], 묘: ["사", "오", "미"], 미: ["사", "오", "미"],
};
const SAMJAE_LABEL = ["들삼재", "눌삼재", "날삼재"];
function samjaeOf(personYearBranch, targetBranch) {
  const set = SAMJAE[personYearBranch] || [];
  const i = set.indexOf(targetBranch);
  return i >= 0 ? SAMJAE_LABEL[i] : null;
}
// 오호둔 — 연간 → 寅월 천간
const TIGER_START = { 갑: "병", 기: "병", 을: "무", 경: "무", 병: "경", 신: "경", 정: "임", 임: "임", 무: "갑", 계: "갑" };

function attach(dayStem, stem, branch, personYearBranch) {
  return {
    stem, branch,
    stemTenGod: getTenGod(dayStem, stem),
    branchTenGod: getBranchTenGod(dayStem, branch),
    twelveStage: twelveStage(dayStem, branch),
    samjae: samjaeOf(personYearBranch, branch),
    bojoShinsal: [],
  };
}

function calcMonthlyLuck(dayStem, personYearBranch, targetYear) {
  const yearStem = yearGanji(targetYear).stem;
  const monStem = KO_STEMS.indexOf(TIGER_START[yearStem]);
  const wolun = [];
  const MONTH_BRANCH_ORDER = ["인", "묘", "진", "사", "오", "미", "신", "유", "술", "해", "자", "축"];
  for (let i = 0; i < 12; i++) {
    const stem = KO_STEMS[(monStem + i) % 10];
    const branch = MONTH_BRANCH_ORDER[i];
    wolun.push({ month: i + 1, ...attach(dayStem, stem, branch, personYearBranch) });
  }
  return wolun;
}

/**
 * 대운/세운/월운. chart=computeChart, birthYear, today(KST 기준 현재).
 */
export function calcLuckCycles(chart, birthYear, today = new Date()) {
  const dayStem = chart.pillars.day.stem;
  const personYearBranch = chart.pillars.year.branch;
  const kst = new Date(today.getTime() + 9 * 3600 * 1000);
  const curYear = kst.getUTCFullYear();
  const koreanAge = curYear - birthYear + 1;

  // 대운 10주기
  const daeun = (chart.luck?.pillars || []).map((p) => ({
    age: p.age,
    year: birthYear + p.age - 1,
    ...attach(dayStem, p.pillar.heavenlyStem, p.pillar.earthlyBranch, personYearBranch),
  }));
  // 현재 대운: age <= koreanAge < nextAge
  let currentDaeun = null;
  for (let i = 0; i < daeun.length; i++) {
    const next = daeun[i + 1];
    if (daeun[i].age <= koreanAge && (!next || koreanAge < next.age)) { currentDaeun = daeun[i]; break; }
  }
  if (!currentDaeun && daeun.length) currentDaeun = koreanAge < daeun[0].age ? null : daeun[daeun.length - 1];

  // 세운 — 올해부터 10년
  const nyunun = [];
  for (let y = curYear; y < curYear + 10; y++) {
    const g = yearGanji(y);
    nyunun.push({ year: y, age: y - birthYear + 1, ...attach(dayStem, g.stem, g.branch, personYearBranch) });
  }

  // 월운 — 절기 기준 寅월=입춘~. 五虎遁으로 寅월 천간.
  const wolun = calcMonthlyLuck(dayStem, personYearBranch, curYear);
  const wolunByYear = Object.fromEntries(
    nyunun.map(({ year }) => [year, calcMonthlyLuck(dayStem, personYearBranch, year)]),
  );

  const thisYearG = yearGanji(curYear);
  return {
    daeun,
    currentDaeun: currentDaeun ? { age: currentDaeun.age, stemTenGod: currentDaeun.stemTenGod, branchTenGod: currentDaeun.branchTenGod } : null,
    nyunun,
    wolun,
    wolunByYear,
    thisYear: { year: curYear, ganzhi: `${thisYearG.stem}${thisYearG.branch}`, age: koreanAge, samjae: samjaeOf(personYearBranch, thisYearG.branch) },
  };
}
