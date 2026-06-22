// 자체 만세력 엔진 — Phase 3: 신강약(3축) + 용신 5신.
// 이식 원본: saju/saju_engine/calculators/strength_yongsin.py (충실 이식).
// 학파의존 결과 → method/confidence/reasons 포함. 출력 오행은 한자(木火土金水, 기존 계약).

const STEM_EL = { 갑: "wood", 을: "wood", 병: "fire", 정: "fire", 무: "earth", 기: "earth", 경: "metal", 신: "metal", 임: "water", 계: "water" };
const EL_HANJA = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const EL_KO_FROM_HANJA = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
const GENERATES = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" };
const CONTROLS = { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" };
const generatesMe = (el) => Object.keys(GENERATES).find((k) => GENERATES[k] === el);
const controlsMe = (el) => Object.keys(CONTROLS).find((k) => CONTROLS[k] === el);

// 계절 왕기 오행(월지 기준)
const SEASON_WANG = [
  [new Set(["인", "묘"]), "wood", "봄"],
  [new Set(["사", "오"]), "fire", "여름"],
  [new Set(["진", "술", "축", "미"]), "earth", "사계절"],
  [new Set(["신", "유"]), "metal", "가을"],
  [new Set(["해", "자"]), "water", "겨울"],
];
function seasonWang(monthBranch) {
  for (const [set, el, kr] of SEASON_WANG) if (set.has(monthBranch)) return { el, kr };
  throw new Error(`알 수 없는 월지: ${monthBranch}`);
}
// 왕상휴수사 — 계절 왕기원소 → {오행:(등급,점수)}
const WANGXIANG = {
  wood: { wood: ["왕", 4], fire: ["상", 3], water: ["휴", 2], metal: ["수", 1], earth: ["사", 0] },
  fire: { fire: ["왕", 4], earth: ["상", 3], wood: ["휴", 2], water: ["수", 1], metal: ["사", 0] },
  earth: { earth: ["왕", 4], metal: ["상", 3], fire: ["휴", 2], wood: ["수", 1], water: ["사", 0] },
  metal: { metal: ["왕", 4], water: ["상", 3], earth: ["휴", 2], fire: ["수", 1], wood: ["사", 0] },
  water: { water: ["왕", 4], wood: ["상", 3], metal: ["휴", 2], earth: ["수", 1], fire: ["사", 0] },
};
// 지장간(본기3/중기2/여기1 순) — 실지 뿌리 점수용
const HIDDEN_SCORED = {
  자: [["계", 3]], 축: [["기", 3], ["계", 2], ["신", 1]], 인: [["갑", 3], ["병", 2], ["무", 1]], 묘: [["을", 3]],
  진: [["무", 3], ["을", 2], ["계", 1]], 사: [["병", 3], ["경", 2], ["무", 1]], 오: [["정", 3], ["기", 2]], 미: [["기", 3], ["정", 2], ["을", 1]],
  신: [["경", 3], ["임", 2], ["무", 1]], 유: [["신", 3]], 술: [["무", 3], ["신", 2], ["정", 1]], 해: [["임", 3], ["갑", 2]],
};
const SUPPORT_GODS = new Set(["비견", "겁재", "정인", "편인"]);
const DRAIN_GODS = new Set(["식신", "상관", "정재", "편재", "정관", "편관", "칠살"]);
const WINTER = new Set(["해", "자", "축"]);
const SUMMER = new Set(["사", "오", "미"]);
const AUTUMN = new Set(["신", "유", "술"]);
const SPRING = new Set(["인", "묘", "진"]);
const JOHU_WEAK = new Set(["휴", "수", "사"]);

export function calcSillyeong(dayEl, monthBranch) {
  const { el: wangEl, kr } = seasonWang(monthBranch);
  const [label, score] = WANGXIANG[wangEl][dayEl];
  return { verdict: score >= 3 ? "득령" : "실령", season: kr, wangxiang: label, score };
}

function calcSilji(dayEl, branches) {
  const names = ["년지", "월지", "일지", "시지"];
  const details = [];
  let total = 0;
  branches.forEach((b, i) => {
    if (!b) return;
    for (const [stem, pts] of HIDDEN_SCORED[b] || []) {
      if (STEM_EL[stem] === dayEl) { details.push({ pillar: names[i], branch: b, hidden_stem: stem, score: pts }); total += pts; break; }
    }
  });
  return { verdict: total >= 3 ? "득지" : "실지", details, total_score: total };
}

function calcDeukse(tenGods) {
  // 천간 3(년·월·시, 일간 제외) + 지지 본기 3(년·월·시지, 일지 제외)
  const labels = [];
  for (const k of ["year", "month", "hour"]) { if (tenGods[k]) labels.push(tenGods[k].stem); }
  for (const k of ["year", "month", "hour"]) { if (tenGods[k]) labels.push(tenGods[k].branch); }
  let support = 0, drain = 0;
  for (const g of labels) { if (SUPPORT_GODS.has(g)) support++; else if (DRAIN_GODS.has(g)) drain++; }
  return { verdict: support - drain > 0 ? "득세" : "실세", support_count: support, drain_count: drain, score: support - drain };
}

function composite(sillyeong, silji, deukse) {
  let sillyeongVote = (sillyeong.score - 2) * 2;
  const siljiVote = silji.total_score - 3;
  const deukseVote = deukse.score;
  let score = sillyeongVote + siljiVote + deukseVote;
  // 설기 보정: 身旺財多 → 약으로 본다
  if (sillyeongVote > 0 && deukseVote < 0 && deukse.drain_count - deukse.support_count >= 1) {
    sillyeongVote = -sillyeongVote;
    score = sillyeongVote + siljiVote + deukseVote;
  }
  let verdict;
  if (score >= 3) verdict = "신강";
  else if (score === 2) verdict = "약신강";
  else if (score === -2) verdict = "약신약";
  else if (score <= -3) verdict = "신약";
  else verdict = "중화"; // -1..1
  const confidence = Math.abs(score) <= 1 || score === 2 || score === -2 ? "낮음" : Math.abs(score) <= 3 ? "보통" : "높음";
  return { verdict, strength_score: score, confidence, summary: `${sillyeong.verdict}·${silji.verdict}·${deukse.verdict} → ${verdict}` };
}

function johuYongsin(dayEl, monthBranch) {
  if (WINTER.has(monthBranch)) return "fire";
  if (SUMMER.has(monthBranch)) return ["fire", "earth", "wood", "metal"].includes(dayEl) ? "water" : null;
  if (AUTUMN.has(monthBranch)) return dayEl === "fire" ? "fire" : null;
  if (SPRING.has(monthBranch)) return ["metal", "water"].includes(dayEl) ? "metal" : null;
  return null;
}
export const _johuYongsin = johuYongsin;

/**
 * 신강약 + 용신. chart=calendar.computeChart, details=derive.deriveDetails(오행 카운트 재사용).
 * @returns { strength:string, strengthDetail:object, yongsin:{yongsin,huisin,gisin,gusin,hansin,...} }
 */
export function calcStrengthYongsin(chart, details) {
  const dayStem = chart.pillars.day.stem;
  const dayEl = STEM_EL[dayStem];
  const monthBranch = chart.pillars.month.branch;
  const branches = ["year", "month", "day", "hour"].map((k) => (chart.pillars[k] ? chart.pillars[k].branch : null));

  const sillyeong = calcSillyeong(dayEl, monthBranch);
  const silji = calcSilji(dayEl, branches);
  const deukse = calcDeukse(chart.tenGods);
  const comp = composite(sillyeong, silji, deukse);

  // 원국 오행 카운트(한자 키) — derive.elements(목/화/토/금/수)를 한자로
  const five = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const KO2H = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
  for (const [ko, n] of Object.entries(details.elements)) five[KO2H[ko]] += n;

  const generates = generatesMe(dayEl); // 생아
  const same = dayEl; // 동아
  const controls = controlsMe(dayEl); // 극아
  const strength = comp.verdict;

  let yongEl;
  if (["신약", "약신약", "중화"].includes(strength)) {
    yongEl = five[EL_HANJA[same]] >= 4 ? generates : same;
  } else {
    yongEl = controls; // 신강/약신강
  }
  let method = "부억법";

  const johu = johuYongsin(dayEl, monthBranch);
  if (johu != null) {
    const johuAbundant = five[EL_HANJA[johu]] >= 4;
    if (johuAbundant) { /* 부억법 유지 */ }
    else if (johu === yongEl) method = "부억법+조후법";
    else if (JOHU_WEAK.has(sillyeong.wangxiang)) { yongEl = johu; method = "조후법"; }
  }

  // 5신
  const huisin = generatesMe(yongEl);
  const gisin = controlsMe(yongEl);
  const gusin = generatesMe(gisin);
  const hansin = ["wood", "fire", "earth", "metal", "water"].find((e) => ![yongEl, huisin, gisin, gusin].includes(e));

  const score = comp.strength_score;
  const buokConf = Math.min(0.9, 0.45 + Math.min(Math.abs(score), 5) / 10);
  const johuConf = WINTER.has(monthBranch) || SUMMER.has(monthBranch) ? 0.65 : 0.35;
  const candidates = [{ yongsin: EL_HANJA[yongEl], method, confidence: Math.round((method.includes("조후") ? Math.max(buokConf, johuConf) : buokConf) * 100) / 100 }];
  if (johu != null && EL_HANJA[johu] !== EL_HANJA[yongEl] && method === "부억법") {
    candidates.push({ yongsin: EL_HANJA[johu], method: "조후법", confidence: Math.round(johuConf * 100) / 100, reason: `${monthBranch}월 한난조습 보정` });
  }
  // 종격 의심
  const dominant = Math.max(...Object.values(five));
  let specialPatternWarning = null;
  if (dominant >= 6 || (five[EL_HANJA[dayEl]] >= 3 && five[EL_HANJA[controls]] === 0 && five[EL_HANJA[CONTROLS[dayEl]]] === 0)) {
    specialPatternWarning = { type: "종격_의심", reason: "오행 편중이 강해 일반 부억법 신뢰도가 낮을 수 있음" };
  }

  return {
    strength,
    strengthDetail: { 실령: sillyeong, 실지: silji, 득세: deukse, composite: comp },
    yongsin: {
      method, confidence: comp.confidence,
      yongsin: EL_HANJA[yongEl], huisin: EL_HANJA[huisin], gisin: EL_HANJA[gisin], gusin: EL_HANJA[gusin], hansin: EL_HANJA[hansin],
      candidates, special_pattern_warning: specialPatternWarning,
      reasons: [comp.summary, `용신 ${EL_HANJA[yongEl]}(${method})`],
    },
  };
}
