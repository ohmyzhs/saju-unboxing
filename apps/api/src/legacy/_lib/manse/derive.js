// 자체 만세력 엔진 — Phase 2: 결정적 파생 계산.
// 표준 원국(calendar.js)만 입력받아 달력 재계산 없이 파생값을 만든다.
// 이식 원본: saju/saju_engine/calculators/quick_additions.py + 명리 표준표.
// 출력은 한글(기존 리포트 계약과 동일).

const KO_STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const KO_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

const STEM_EL = { 갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토", 경: "금", 신: "금", 임: "수", 계: "수" };
const BRANCH_EL = { 자: "수", 축: "토", 인: "목", 묘: "목", 진: "토", 사: "화", 오: "화", 미: "토", 신: "금", 유: "금", 술: "토", 해: "수" };
const STEM_YANG = new Set(["갑", "병", "무", "경", "임"]);
const BRANCH_YANG = new Set(["자", "인", "진", "오", "신", "술"]);

// 지장간(여기/중기/본기) — 표준표. 중기 없는 지지는 junggi: null.
const HIDDEN = {
  자: { yeogi: "임", junggi: null, bongi: "계" },
  축: { yeogi: "계", junggi: "신", bongi: "기" },
  인: { yeogi: "무", junggi: "병", bongi: "갑" },
  묘: { yeogi: "갑", junggi: null, bongi: "을" },
  진: { yeogi: "을", junggi: "계", bongi: "무" },
  사: { yeogi: "무", junggi: "경", bongi: "병" },
  오: { yeogi: "병", junggi: "기", bongi: "정" },
  미: { yeogi: "정", junggi: "을", bongi: "기" },
  신: { yeogi: "무", junggi: "임", bongi: "경" },
  유: { yeogi: "경", junggi: null, bongi: "신" },
  술: { yeogi: "신", junggi: "정", bongi: "무" },
  해: { yeogi: "무", junggi: "갑", bongi: "임" },
};

// 납음오행 30쌍(60갑자 순서, 갑자부터 2개씩) — 한글.
const NAPEUM30 = [
  "해중금", "노중화", "대림목", "노방토", "검봉금", "산두화", "윤하수", "성두토", "백랍금", "양류목",
  "천중수", "옥상토", "벽력화", "송백목", "장류수", "사중금", "산하화", "평지목", "벽상토", "금박금",
  "복등화", "천하수", "대역토", "채천금", "상자목", "대계수", "사중토", "천상화", "석류목", "대해수",
];
// 60갑자 간지(한글) → 순환 index
const GANZHI_INDEX = (() => {
  const map = {};
  for (let i = 0; i < 60; i++) map[KO_STEMS[i % 10] + KO_BRANCHES[i % 12]] = i;
  return map;
})();
function napeum(stem, branch) {
  const i = GANZHI_INDEX[stem + branch];
  return i === undefined ? "" : NAPEUM30[i >> 1];
}

// 십이운성(봉법: 일간 기준) — quick_additions._bong_stage 이식.
const STAGES = ["장생", "목욕", "관대", "임관", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
const BONG_START = { 갑: "해", 병: "인", 무: "인", 경: "사", 임: "신", 을: "오", 정: "유", 기: "유", 신: "자", 계: "묘" };
function twelveStage(dayStem, branch) {
  const startIdx = KO_BRANCHES.indexOf(BONG_START[dayStem]);
  const branchIdx = KO_BRANCHES.indexOf(branch);
  if (startIdx < 0 || branchIdx < 0) return "";
  const offset = STEM_YANG.has(dayStem) ? (branchIdx - startIdx + 12) % 12 : (startIdx - branchIdx + 12) % 12;
  return STAGES[offset];
}

// 십성 → 5그룹. (manseryeok 의 십신 라벨을 그룹 집계)
const TEN_GOD_GROUP = {
  비견: "bigyeop", 겁재: "bigyeop",
  식신: "siksang", 상관: "siksang",
  정재: "jaeseong", 편재: "jaeseong",
  정관: "gwanseong", 편관: "gwanseong", 칠살: "gwanseong",
  정인: "inseong", 편인: "inseong",
};

// ── 형충회합 표(표준) ─────────────────────────────────
const STEM_HAP = { 갑: "기", 기: "갑", 을: "경", 경: "을", 병: "신", 신: "병", 정: "임", 임: "정", 무: "계", 계: "무" };
const STEM_CHUNG = { 갑: "경", 경: "갑", 을: "신", 신: "을", 병: "임", 임: "병", 정: "계", 계: "정" };
const BR_YUKHAP = { 자: "축", 축: "자", 인: "해", 해: "인", 묘: "술", 술: "묘", 진: "유", 유: "진", 사: "신", 신: "사", 오: "미", 미: "오" };
const BR_CHUNG = { 자: "오", 오: "자", 축: "미", 미: "축", 인: "신", 신: "인", 묘: "유", 유: "묘", 진: "술", 술: "진", 사: "해", 해: "사" };
const BR_PA = { 자: "유", 유: "자", 오: "묘", 묘: "오", 진: "축", 축: "진", 술: "미", 미: "술", 인: "해", 해: "인", 사: "신", 신: "사" };
const BR_HAE = { 자: "미", 미: "자", 축: "오", 오: "축", 인: "사", 사: "인", 묘: "진", 진: "묘", 신: "해", 해: "신", 유: "술", 술: "유" };
const SAMHAP = [["신", "자", "진", "수"], ["해", "묘", "미", "목"], ["인", "오", "술", "화"], ["사", "유", "축", "금"]];
const BANGHAP = [["인", "묘", "진", "목"], ["사", "오", "미", "화"], ["신", "유", "술", "금"], ["해", "자", "축", "수"]];
const SAMHYUNG = [["인", "사", "신"], ["축", "술", "미"]]; // 삼형
const SANGHYUNG = [["자", "묘"]]; // 상형
const SELF_HYUNG = new Set(["진", "오", "유", "해"]); // 자형

function pairList(items, table) {
  // items: 간지 char 배열 → table 기준 쌍 추출(중복 제거, 양방향)
  const out = [];
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (table[a] === b) {
        const key = [a, b].sort().join("");
        if (!seen.has(key)) { seen.add(key); out.push(`${a}${b}`); }
      }
    }
  }
  return out;
}
function byeongjon(items) {
  // 병존: 같은 글자 2개 이상(인접 무관, 명식 내 중복)
  const cnt = {};
  for (const it of items) cnt[it] = (cnt[it] || 0) + 1;
  return Object.entries(cnt).filter(([, c]) => c >= 2).map(([k]) => `${k}${k}`);
}

/**
 * 표준 원국(calendar.js computeChart) → 결정적 파생 블록.
 * 시간 미상이면 시주를 뺀 6글자 기준으로 집계하고 countBasis 를 남긴다.
 */
export function deriveDetails(chart) {
  const P = chart.pillars;
  const order = ["year", "month", "day", "hour"];
  const present = order.filter((k) => P[k]);
  const stems = present.map((k) => P[k].stem);
  const branches = present.map((k) => P[k].branch);
  const dayStem = P.day.stem;

  // 오행 분포(존재하는 글자만)
  const elements = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const s of stems) elements[STEM_EL[s]]++;
  for (const b of branches) elements[BRANCH_EL[b]]++;

  // 음양
  let yin = 0, yang = 0;
  for (const s of stems) (STEM_YANG.has(s) ? yang++ : yin++);
  for (const b of branches) (BRANCH_YANG.has(b) ? yang++ : yin++);

  // 지장간·납음·십이운성(기둥별)
  const hidden = {}, nap = {}, stages = {};
  for (const k of order) {
    if (!P[k]) { hidden[k] = null; nap[k] = null; stages[k] = null; continue; }
    hidden[k] = HIDDEN[P[k].branch];
    nap[k] = napeum(P[k].stem, P[k].branch);
    stages[k] = twelveStage(dayStem, P[k].branch);
  }

  // 십성통계(5그룹) — manseryeok 십신을 그룹 집계. 천간 3(년·월·시, 일간 제외) + 지지 4(본기).
  const tenGodStats = { bigyeop: 0, siksang: 0, jaeseong: 0, gwanseong: 0, inseong: 0 };
  const tg = chart.tenGods || {};
  const addTG = (label) => { const g = TEN_GOD_GROUP[label]; if (g) tenGodStats[g]++; };
  for (const k of order) {
    if (!tg[k]) continue;
    if (k !== "day") addTG(tg[k].stem); // 일간 천간 제외
    addTG(tg[k].branch);
  }

  // 형충회합
  const hyungchung = {
    cheonganHap: pairList(stems, STEM_HAP),
    cheonganChung: pairList(stems, STEM_CHUNG),
    cheonganByeongjon: byeongjon(stems),
    jijiSamhap: SAMHAP.filter(([a, b, c]) => [a, b, c].every((x) => branches.includes(x))).map(([a, b, c, el]) => `${a}${b}${c}(${el})`),
    jijiBanghap: BANGHAP.filter(([a, b, c]) => [a, b, c].every((x) => branches.includes(x))).map(([a, b, c, el]) => `${a}${b}${c}(${el})`),
    jijiYukhap: pairList(branches, BR_YUKHAP),
    jijiChung: pairList(branches, BR_CHUNG),
    jijiByeongjon: byeongjon(branches),
    jijiHyung: [
      ...SAMHYUNG.filter((t) => t.every((x) => branches.includes(x))).map((t) => `${t.join("")}(삼형)`),
      ...SANGHYUNG.filter((t) => t.every((x) => branches.includes(x))).map((t) => `${t.join("")}(상형)`),
      ...[...new Set(branches)].filter((b) => SELF_HYUNG.has(b) && branches.filter((x) => x === b).length >= 2).map((b) => `${b}${b}(자형)`),
    ],
    jijiPa: pairList(branches, BR_PA),
    jijiHae: pairList(branches, BR_HAE),
    amhap: [], // 비인접 천간합 — placeholder.py 정밀판은 Phase 3에서 위치까지. 기본 stem 합쌍만.
  };

  return {
    elements,
    yinyang: { yin, yang },
    hiddenStems: hidden,
    napeum: nap,
    twelveStages: stages,
    tenGodStats,
    hyungchung,
    countBasis: chart.dataQuality.birthTimeKnown ? "8글자" : "6글자(시주 미상)",
  };
}
