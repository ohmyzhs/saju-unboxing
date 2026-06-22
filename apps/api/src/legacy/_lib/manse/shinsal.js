// 자체 만세력 엔진 — Phase 3b: 신살.
// 이식 원본: saju/saju_engine/calculators/shinsal.py (계약 소비분 충실 이식).
// 계약 소비: 기둥별 shensha(십이신살·년지 기준), 공망, 천을귀인, bojoShinsal(주요신살 배열).
// ※ shinsal.py 전체 카탈로그(홍염·백호·괴강·태극·금여 등 20여종)는 계약 미소비 → 후속 확장.

const KO_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const idx = (b) => KO_BRANCHES.indexOf(b);

// 십이신살 — 삼합 생지(寅申巳亥) 기준 ORDER12 순환. (SAJULAB 골든으로 역산 검증)
const ORDER12 = ["지살", "년살", "월살", "망신살", "장성살", "반안살", "역마살", "육해살", "화개살", "겁살", "재살", "천살"];
const SAENGJI = { 인: "인", 오: "인", 술: "인", 신: "신", 자: "신", 진: "신", 사: "사", 유: "사", 축: "사", 해: "해", 묘: "해", 미: "해" };
function twelveShinsal(refBranch, targetBranch) {
  const saeng = SAENGJI[refBranch];
  if (!saeng || idx(targetBranch) < 0) return "";
  return ORDER12[(idx(targetBranch) - idx(saeng) + 12) % 12];
}

// 일간 기준 표(한글)
const CHEONEUL = { 갑: ["축", "미"], 무: ["축", "미"], 을: ["자", "신"], 기: ["자", "신"], 병: ["해", "유"], 정: ["해", "유"], 경: ["인", "오"], 신: ["인", "오"], 임: ["묘", "사"], 계: ["묘", "사"] };
const YANGRIN = { 갑: "묘", 을: "인", 병: "오", 정: "사", 무: "오", 기: "사", 경: "유", 신: "신", 임: "자", 계: "해" };
const GEONROK = { 갑: "인", 을: "묘", 병: "사", 정: "오", 무: "사", 기: "오", 경: "신", 신: "유", 임: "해", 계: "자" };
const MUNCHANG = { 갑: "사", 을: "오", 병: "신", 정: "유", 무: "신", 기: "유", 경: "해", 신: "자", 임: "인", 계: "묘" };

/**
 * 신살 계산. chart=calendar.computeChart.
 * @returns { gongmangDay, tianyiGuiren, byPillar:{year,month,day,hour:{shensha,bojoShinsal[]}} }
 */
export function calcShinsal(chart) {
  const P = chart.pillars;
  const order = ["year", "month", "day", "hour"];
  const dayStem = P.day.stem;
  const yearBranch = P.year.branch;
  const cheoneul = CHEONEUL[dayStem] || [];

  const byPillar = {};
  for (const k of order) {
    if (!P[k]) { byPillar[k] = null; continue; }
    const br = P[k].branch;
    const bojo = [];
    if (cheoneul.includes(br)) bojo.push("천을귀인");
    if (YANGRIN[dayStem] === br) bojo.push("양인살");
    if (GEONROK[dayStem] === br) bojo.push("건록");
    if (MUNCHANG[dayStem] === br) bojo.push("문창귀인");
    byPillar[k] = {
      shensha: twelveShinsal(yearBranch, br), // 년지 기준 십이신살
      bojoShinsal: bojo,
    };
  }

  return {
    gongmangDay: (chart.voidBranches || []).join(""), // manseryeok 공망
    tianyiGuiren: cheoneul.join(""), // 일간 기준 천을귀인 지지
    byPillar,
  };
}
