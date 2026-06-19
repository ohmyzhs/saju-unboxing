// 만세력 API 응답(summary + full) → LLM 입력용 통합 컨텍스트 객체.
// 경쟁사가 못 쓰는 풍부한 근거(형충회합·용신4단계·십성통계·지장간·대운)를 한 곳에 모아 노출한다.
// 행운 색/숫자/방향은 ELEMENT_REMEDY 에서만 파생(임의 생성·하드코딩 금지).

const EL_KO = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
const elKo = (e) => EL_KO[e] || e || "";

// 오행 → 개운 속성(색/숫자/방향). 용신·희신 오행을 키로 조회한다.
export const ELEMENT_REMEDY = {
  목: { color: "초록·청록", number: "3, 8", direction: "동쪽" },
  화: { color: "빨강·분홍", number: "2, 7", direction: "남쪽" },
  토: { color: "노랑·베이지", number: "5, 0", direction: "중앙" },
  금: { color: "흰색·금색", number: "4, 9", direction: "서쪽" },
  수: { color: "검정·짙은 파랑", number: "1, 6", direction: "북쪽" },
};

// 천간 음양 — 같은 용신이라도 일간 음양으로 본명수를 갈라 개운이 사람마다 달라지게 한다.
const STEM_POLARITY = { 甲: "양", 丙: "양", 戊: "양", 庚: "양", 壬: "양", 乙: "음", 丁: "음", 己: "음", 辛: "음", 癸: "음" };
// 오행별 河圖 수리쌍(양수/음수) — 본명수는 모두 용신 오행의 수라 명리적으로 일관된다.
const ELEMENT_NUMBER = {
  목: { 양: "3", 음: "8" }, 화: { 양: "7", 음: "2" }, 토: { 양: "5", 음: "10" }, 금: { 양: "9", 음: "4" }, 수: { 양: "1", 음: "6" },
};

// 용신·희신 + 일간 음양 + 오행공백으로 '코드가 확정하는' 개운(사실값). LLM은 산문만 쓴다.
// 용신이 같아도 본명수(일간 음양 시드)·방향강조(공백 시드)·보완색이 갈려 카드가 동일해지지 않는다.
export function deriveLucky({ yongsinKo, huisinKo, dayStem, missing }) {
  const miss = Array.isArray(missing) ? missing : [];
  const pol = STEM_POLARITY[dayStem] || "양";
  const y = ELEMENT_REMEDY[yongsinKo];
  const h = ELEMENT_REMEDY[huisinKo];
  const focus = (ELEMENT_NUMBER[yongsinKo] || {})[pol] || "";
  const rootless = miss.includes(yongsinKo); // 무근 용신(타고나지 못한 기운)
  // 방향: 용신 방향. 용신 오행이 공백이면(무근) 더 강하게 의식하도록 표기 분기.
  const direction = rootless && y ? `${y.direction}(타고나지 못한 ${yongsinKo} 기운이라 특히 의식)` : (y ? y.direction : "");
  // 보완 포인트 색: 공백 오행이 용신과 다르면 그 색을 보완색으로(개인화). 같거나 없으면 빈값.
  const fillEl = miss.find((m) => m !== yongsinKo) || "";
  const fillColor = (ELEMENT_REMEDY[fillEl] || {}).color || "";
  return {
    element: yongsinKo,
    color: y ? y.color : "산출 보류",
    number: y ? y.number : "산출 보류",
    numberFocus: focus, // 일간 음양으로 고른 본명수(용신 수쌍 중 하나)
    direction: direction || "산출 보류",
    assistElement: huisinKo || "",
    assistColor: h ? h.color : "",
    fillElement: fillEl, // 보완할 결핍 오행(있으면)
    fillColor, // 결핍 오행 보완색(개인화 포인트)
    rootless, // 무근 용신
    unresolved: !y, // ELEMENT_REMEDY 미스(예외 입력) → 프롬프트가 값 창작 금지
  };
}

function pillarView(detail, full, key) {
  const d = detail || {};
  const fp = (full && full.pillar && full.pillar[key]) || {};
  const hs = fp.hiddenStems
    ? [fp.hiddenStems.yeogi, fp.hiddenStems.junggi, fp.hiddenStems.bongi].filter(Boolean)
    : [];
  return {
    간지: `${fp.stem || ""}${fp.branch || ""}`,
    천간십성: d.stemTenGod || fp.stemTenGod || "",
    지지십성: d.branchTenGod || fp.branchTenGod || "",
    십이운성: d.twelveStage || fp.twelveStage || "",
    십이신살: d.shensha || "",
    지장간: hs,
    납음: fp.napeum || "",
    주요신살: Array.isArray(d.bojoShinsal) ? d.bojoShinsal : [],
    위치강약: d.pillarStrength || fp.pillarStrength || "",
  };
}

// 형충회합 객체 → 사람이 읽는 한국어 라인 배열
function relationLines(hc) {
  if (!hc) return [];
  const lines = [];
  const push = (arr, label) => (arr || []).forEach((v) => lines.push(`${label}: ${v}`));
  push(hc.cheonganHap, "천간합");
  push(hc.cheonganChung, "천간충");
  push(hc.cheonganByeongjon, "천간병존");
  push(hc.jijiSamhap, "지지삼합");
  push(hc.jijiBanghap, "지지방합");
  push(hc.jijiYukhap, "지지육합");
  push(hc.jijiChung, "지지충");
  push(hc.jijiByeongjon, "지지병존");
  push(hc.jijiHyung, "지지형(삼형/형)");
  push(hc.jijiPa, "지지파");
  push(hc.jijiHae, "지지해");
  push(hc.amhap, "암합");
  return lines;
}

/**
 * @param {{summary?:object, full?:object}} manse 중앙 만세력 API 응답
 * @returns {object} LLM 입력용 통합 사주 컨텍스트
 */
export function buildSajuContext(manse) {
  const s = (manse && manse.summary) || {};
  const full = (manse && manse.full) || {};
  const det = s.pillarsDetail || {};

  const els = s.elements || {};
  const elementOrder = ["목", "화", "토", "금", "수"];
  const overflowing = elementOrder.filter((k) => Number(els[k] || 0) >= 3);
  const missing = elementOrder.filter((k) => Number(els[k] || 0) === 0);

  const yo = full.yongsin || {};
  const yongsinKo = elKo(yo.yongsin) || s.yongsin || "";
  const huisinKo = elKo(yo.huisin);
  const dayStem = s.dayStem || full?.pillar?.day?.stem || "";

  const tg = full.tenGodStats || {};
  const TG_KO = { bigyeop: "비겁", siksang: "식상", jaeseong: "재성", gwanseong: "관성", inseong: "인성" };
  const tenGod = {};
  for (const [k, v] of Object.entries(tg)) tenGod[TG_KO[k] || k] = v;
  const tgEntries = Object.entries(tenGod);
  const tgMax = Math.max(0, ...tgEntries.map(([, v]) => Number(v) || 0));
  const tenGodExcess = tgEntries.filter(([, v]) => Number(v) === tgMax && tgMax >= 3).map(([k]) => k);
  const tenGodAbsent = tgEntries.filter(([, v]) => Number(v) === 0).map(([k]) => k);

  return {
    대상: {
      일간: `${s.dayStem || ""}(${elKo(full?.pillar?.day?.stemElement)})`,
      일지: s.dayBranch || "",
      띠: s.yearAnimal || "",
      신강약: s.strength || full.strength || "",
    },
    원국: {
      연주: pillarView(det.year, full, "year"),
      월주: pillarView(det.month, full, "month"),
      일주: pillarView(det.day, full, "day"),
      시주: pillarView(det.hour, full, "hour"),
    },
    오행분포: els,
    오행과다: overflowing, // 3개 이상으로 치우친 기운
    오행공백: missing, // 0개 = 타고나지 못한 기운
    십성통계: tenGod,
    십성과다: tenGodExcess,
    십성공백: tenGodAbsent, // 예: 관성 0 = 통제·규범·조직 기운 부재
    용신체계: {
      용신: yongsinKo,
      희신: huisinKo,
      기신: elKo(yo.gisin),
      구신: elKo(yo.gusin),
      한신: elKo(yo.hansin),
    },
    // 개운 사실값(코드가 확정). 색/숫자/방향/본명수는 여기 값만 쓴다(LLM 창작 금지).
    개운파생근거: deriveLucky({ yongsinKo, huisinKo, dayStem, missing }),
    형충회합: relationLines(full.hyungchung),
    대운: {
      현재: s.currentDaeun || null,
      흐름: (s.daeunList || []).map((d) => ({
        나이: d.age, 간지: `${d.stem}${d.branch}`, 천간십성: d.stemTenGod, 지지십성: d.branchTenGod, 십이운성: d.twelveStage,
      })),
    },
    올해: s.thisYear || null,
    공망: s.shinsal?.gongmangDay || full.shinsal?.gongmangDay || "",
    천을귀인: s.shinsal?.tianyiGuiren || full.shinsal?.tianyiGuiren || "",
  };
}

// ── 궁합(2인 비교) ──────────────────────────────────────────────
const STEM_EL = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" };
const BRANCH_EL = { 寅: "목", 卯: "목", 巳: "화", 午: "화", 辰: "토", 戌: "토", 丑: "토", 未: "토", 申: "금", 酉: "금", 亥: "수", 子: "수" };
const STEM_HAP = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };
const STEM_CHUNG = { 甲: "庚", 庚: "甲", 乙: "辛", 辛: "乙", 丙: "壬", 壬: "丙", 丁: "癸", 癸: "丁" };
const BR_YUKHAP = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
const BR_CHUNG = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
const SAENG = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" }; // A생B
const GEUK = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" }; // A극B

// 두 오행 관계를 사람 언어로
function elementRelation(a, b) {
  if (!a || !b) return "";
  if (a === b) return "같은 기운(비화) — 닮아서 편하지만 비슷한 약점도 공유";
  if (SAENG[a] === b) return `한쪽이 다른 쪽을 살려주는 흐름(${a}→${b}) — 챙겨주는 관계`;
  if (SAENG[b] === a) return `다른 쪽이 이쪽을 살려주는 흐름(${b}→${a}) — 기대고 받는 관계`;
  if (GEUK[a] === b) return `한쪽이 다른 쪽을 누르는 긴장(${a}→${b}) — 자극이 되지만 눌릴 수 있음`;
  if (GEUK[b] === a) return `다른 쪽이 이쪽을 누르는 긴장(${b}→${a}) — 끌리지만 부딪힘`;
  return "직접 상생·상극은 약함";
}

function compactPerson(manse) {
  const s = (manse && manse.summary) || {};
  const full = (manse && manse.full) || {};
  const dayStem = s.dayStem || full?.pillar?.day?.stem || "";
  const dayBranch = s.dayBranch || full?.pillar?.day?.branch || "";
  const yo = full.yongsin || {};
  const tg = full.tenGodStats || {};
  return {
    일간: dayStem, 일간오행: STEM_EL[dayStem] || "",
    일지: dayBranch, 일지오행: BRANCH_EL[dayBranch] || "",
    신강약: s.strength || full.strength || "",
    오행: s.elements || {},
    오행공백: ["목", "화", "토", "금", "수"].filter((k) => Number((s.elements || {})[k] || 0) === 0),
    용신: elKo(yo.yongsin) || s.yongsin || "",
    십성통계: { 비겁: tg.bigyeop, 식상: tg.siksang, 재성: tg.jaeseong, 관성: tg.gwanseong, 인성: tg.inseong },
    띠: s.yearAnimal || "",
  };
}

/**
 * 궁합용 2인 비교 컨텍스트. 일간 오행관계·일지 합충·천간합·오행 상호보완을 코드로 계산.
 * @returns {object}
 */
export function buildCompatContext(manseA, manseB, nameA = "A", nameB = "B") {
  const A = compactPerson(manseA);
  const B = compactPerson(manseB);

  const stemHap = STEM_HAP[A.일간] === B.일간; // 천간합(끌림)
  const stemChung = STEM_CHUNG[A.일간] === B.일간; // 천간충(부딪힘)
  const branchHap = BR_YUKHAP[A.일지] === B.일지; // 일지 육합(배우자궁 결속)
  const branchChung = BR_CHUNG[A.일지] === B.일지; // 일지 충(배우자궁 충돌)
  const sameBranch = A.일지 && A.일지 === B.일지; // 같은 일지

  // 오행 상호보완: 한쪽 공백을 다른쪽이 많이 가졌는지
  const fill = [];
  for (const el of A.오행공백) if (Number((B.오행 || {})[el] || 0) >= 2) fill.push(`${nameA}에게 없는 ${el} 기운을 ${nameB}가 채워줌`);
  for (const el of B.오행공백) if (Number((A.오행 || {})[el] || 0) >= 2) fill.push(`${nameB}에게 없는 ${el} 기운을 ${nameA}가 채워줌`);

  return {
    A: { 이름: nameA, ...A },
    B: { 이름: nameB, ...B },
    비교: {
      일간관계: elementRelation(A.일간오행, B.일간오행),
      천간합: stemHap ? `${nameA}·${nameB} 일간이 합(서로 자연스레 끌리는 짝)` : "",
      천간충: stemChung ? `${nameA}·${nameB} 일간이 충(가치관이 정면으로 부딪히기 쉬움)` : "",
      일지관계: branchHap
        ? "두 사람의 배우자 자리가 합 — 가까이 있을수록 편하고 결속이 강함"
        : branchChung
          ? "두 사람의 배우자 자리가 충 — 한 공간에 오래 있으면 마찰이 잦을 수 있음"
          : sameBranch
            ? "배우자 자리가 같음 — 비슷한 결, 닮은 취향이나 같은 고집"
            : "배우자 자리는 강한 합·충 없이 무난",
      오행상호보완: fill.length ? fill : ["뚜렷한 보완은 약함 — 서로 비슷한 기운"],
      신강약: `${nameA} ${A.신강약} / ${nameB} ${B.신강약}`,
    },
  };
}

// ── 대운(타임라인) ─────────────────────────────────────────────
/** 대운 10주기를 사람이 읽기 좋은 타임라인으로. */
export function buildCycleContext(manse) {
  const base = buildSajuContext(manse);
  const full = (manse && manse.full) || {};
  const daeun = (full.daeun || []).map((d) => ({
    시작나이: d.age,
    간지: `${d.stem}${d.branch}`,
    천간십성: d.stemTenGod,
    지지십성: d.branchTenGod,
    십이운성: d.twelveStage,
    주요신살: Array.isArray(d.bojoShinsal) ? d.bojoShinsal : [],
    삼재: d.samjae || null,
  }));
  return {
    대상: base.대상,
    오행분포: base.오행분포,
    오행공백: base.오행공백,
    용신체계: base.용신체계,
    개운파생근거: base.개운파생근거,
    현재대운: base.대운.현재,
    대운타임라인: daeun, // 10주기
    올해: base.올해,
  };
}

// ── 연도별 운세(세운+월운) ─────────────────────────────────────
/** 다가오는 연운(세운) + 올해 월운. */
export function buildYearlyContext(manse) {
  const base = buildSajuContext(manse);
  const full = (manse && manse.full) || {};
  const yearly = (full.nyunun || []).map((y) => ({
    연도: y.year,
    나이: y.age,
    간지: `${y.stem}${y.branch}`,
    천간십성: y.stemTenGod,
    지지십성: y.branchTenGod,
    십이운성: y.twelveStage,
    주요신살: Array.isArray(y.bojoShinsal) ? y.bojoShinsal : [],
    삼재: y.samjae || null,
  }));
  const monthly = (full.wolun || []).map((m) => ({
    월: m.month,
    간지: `${m.stem}${m.branch}`,
    천간십성: m.stemTenGod,
    지지십성: m.branchTenGod,
    주요신살: Array.isArray(m.bojoShinsal) ? m.bojoShinsal : [],
    삼재: m.samjae || null,
  }));
  return {
    대상: base.대상,
    오행분포: base.오행분포,
    용신체계: base.용신체계,
    개운파생근거: base.개운파생근거,
    현재대운: base.대운.현재,
    세운: yearly, // 다가오는 ~10년
    올해월운: monthly, // 12개월
  };
}
