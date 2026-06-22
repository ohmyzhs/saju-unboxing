// 자체 만세력 엔진 — Phase 1: 달력 커널 + 표준 원국.
// manseryeok(KASI 검증 음양력·절기·60갑자)로 4기둥·오행·음양·십신·공망·대운을 확정한다.
//
// 정책(설계서 고정): 고정 한국표준시(UTC+09:00). 진태양시·경도·균시차 보정 미적용
//   → manseryeok 의 trueSolarTime 옵션을 넘기지 않는다(입력 벽시계 시각 그대로).
//   ※ 그래서 시진 경계 근처 입력은 기존 SAJULAB(진태양시)과 시주가 다를 수 있다(의도된 정책 차이).
import {
  calculateFourPillars,
  solarToLunar,
  isValidSolarDate,
  getSolarTerm,
} from "manseryeok";

const GENDER = { M: "male", F: "female", male: "male", female: "female" };

function badInput(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/**
 * 프로필 → 표준 입력. KST 고정, 진태양시 미적용.
 * @param {object} profile { gender, birthDate 'YYYY-MM-DD', birthTime 'HH:MM'|null, calendar, timeKnown, yajasi }
 */
export function normalizeInput(profile) {
  if (!profile || !profile.birthDate) throw badInput("생년월일이 필요합니다.");
  const calendar = profile.calendar || (profile.isLunar ? "lunar" : "solar");
  const isLunar = calendar === "lunar" || calendar === "leap_lunar";
  const isLeapMonth = calendar === "leap_lunar";
  const gender = GENDER[profile.gender] || "female";

  const [y, m, d] = String(profile.birthDate).split("-").map(Number);
  if (!y || !m || !d) throw badInput("생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).");

  // 시간 미상: 정오를 실제 출생시각처럼 쓰지 않는다 → 시주는 버린다(아래 computeChart).
  const timeKnown = profile.timeKnown !== "no" && !!profile.birthTime;
  let hour = null;
  let minute = null;
  let timePrecision = "unknown";
  if (timeKnown) {
    const [hh, mm] = String(profile.birthTime).split(":").map(Number);
    if (!Number.isFinite(hh) || hh < 0 || hh > 23 || !Number.isFinite(mm) || mm < 0 || mm > 59) {
      throw badInput("출생 시각 형식이 올바르지 않습니다 (HH:MM).");
    }
    hour = hh;
    minute = mm;
    timePrecision = profile.timePrecision === "period" ? "period" : "exact";
  }

  // 야자시: yes → 자시(23:00)부터 다음날, no/기본 → 자정 경계
  const dayBoundary = profile.yajasi === "yes" ? "jasi" : "midnight";

  return { y, m, d, hour, minute, isLunar, isLeapMonth, gender, timeKnown, timePrecision, dayBoundary, calendar };
}

function pillarView(pillarKo, pillarHanja, element, yinYang) {
  return {
    stem: pillarKo.heavenlyStem,
    branch: pillarKo.earthlyBranch,
    stemHanja: pillarHanja.hanja.charAt(0),
    branchHanja: pillarHanja.hanja.charAt(1),
    ganji: pillarKo.heavenlyStem + pillarKo.earthlyBranch,
    ganjiHanja: pillarHanja.hanja,
    stemElement: element.stem,
    branchElement: element.branch,
    stemYinYang: yinYang.stem,
    branchYinYang: yinYang.branch,
  };
}

/**
 * 표준 원국 모델. 이후 상세 계산기는 이 모델만 입력으로 받는다(달력 재계산 금지).
 * @param {ReturnType<typeof normalizeInput>} norm
 */
export function computeChart(norm) {
  if (!norm.isLunar && !isValidSolarDate(norm.y, norm.m, norm.d)) {
    throw badInput("지원하지 않거나 존재하지 않는 양력 날짜입니다.");
  }

  // 시간 미상이면 연·월·일주만 쓰고 시주는 버린다. 계산용 시각은 임의(정오)지만 결과 시주는 null.
  const birthInfo = {
    year: norm.y,
    month: norm.m,
    day: norm.d,
    hour: norm.timeKnown ? norm.hour : 12,
    minute: norm.timeKnown ? norm.minute : 0,
    isLunar: norm.isLunar,
    isLeapMonth: norm.isLeapMonth,
    dayBoundary: norm.dayBoundary,
    gender: norm.gender,
    // trueSolarTime 미지정 = KST 고정(정책)
  };

  let r;
  try {
    r = calculateFourPillars(birthInfo);
  } catch (e) {
    throw badInput(e.message || "만세력 계산에 실패했습니다(입력 확인).");
  }
  const hanja = r.toHanjaObject();

  const pillars = {
    year: pillarView(r.year, hanja.year, r.yearElement, r.yearYinYang),
    month: pillarView(r.month, hanja.month, r.monthElement, r.monthYinYang),
    day: pillarView(r.day, hanja.day, r.dayElement, r.dayYinYang),
    hour: norm.timeKnown ? pillarView(r.hour, hanja.hour, r.hourElement, r.hourYinYang) : null,
  };

  // 시간 미상이면 시주 의존 항목(시주 십신)도 보류
  const tenGods = { year: r.tenGods.year, month: r.tenGods.month, day: r.tenGods.day, hour: norm.timeKnown ? r.tenGods.hour : null };

  const lunar = norm.isLunar
    ? { year: norm.y, month: norm.m, day: norm.d, isLeapMonth: norm.isLeapMonth }
    : solarToLunar(norm.y, norm.m, norm.d);

  let solarTerm = null;
  try {
    solarTerm = getSolarTerm(norm.y, norm.m, norm.d);
  } catch {
    solarTerm = null;
  }

  return {
    policy: { timezone: "Asia/Seoul fixed UTC+09:00", trueSolarTime: false, dayBoundary: norm.dayBoundary },
    pillars,
    tenGods,
    voidBranches: r.voidBranches,
    luck: r.luckPillars || null, // { forward, startAge, startYears, startMonths, pillars... }
    lunar,
    solarTerm,
    dataQuality: {
      birthTimeKnown: norm.timeKnown,
      timePrecision: norm.timePrecision,
      hourPillarOmitted: !norm.timeKnown,
    },
  };
}
