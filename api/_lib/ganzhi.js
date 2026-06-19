// 간지(干支) 유틸 — 오늘의 일진(日辰) 계산 + 오행 매핑.
// 일진 공식은 (JDN + 49) % 60 (甲子=0). 1988-11-03 → 壬戌(중앙 API와 일치) 검증 완료.

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

const STEM_KO = { 甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계" };
const BRANCH_KO = { 子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해" };

// 천간/지지 → 오행(목/화/토/금/수)
const STEM_EL = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" };
const BRANCH_EL = {
  寅: "목", 卯: "목", 巳: "화", 午: "화", 辰: "토", 戌: "토", 丑: "토", 未: "토", 申: "금", 酉: "금", 亥: "수", 子: "수",
};

export function elementOf(char) {
  return STEM_EL[char] || BRANCH_EL[char] || "토";
}
export function koOf(char) {
  return STEM_KO[char] || BRANCH_KO[char] || "";
}

function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** 양력 Y-M-D 의 일진(干支) → { stem, branch, ko } */
export function dayPillar(y, m, d) {
  const n = (jdn(y, m, d) + 49) % 60;
  const stem = STEMS[n % 10];
  const branch = BRANCHES[n % 12];
  return { stem, branch, ko: `${STEM_KO[stem]}${BRANCH_KO[branch]}`, ganzhi: `${stem}${branch}` };
}

/** 서버 시간(UTC) → 한국(KST, UTC+9) 기준 오늘 날짜 */
export function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][kst.getUTCDay()];
  return { y, m, d, iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, label: `${m}월 ${d}일 ${weekday}요일` };
}
