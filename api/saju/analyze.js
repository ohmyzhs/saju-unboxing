// POST /api/saju/analyze
// 1) 중앙 만세력 API 호출(포인트 차감) → 2) OpenAI 해설 생성 → 3) 보관함 저장 → 결과 반환
import { createHash } from "crypto";
import { readJson, sendJson } from "../_lib/http.js";
import { computeManse } from "../_lib/sajuApi.js";
import { generateAnalysis, generateDailyFortune, generatePlan } from "../_lib/analysis.js";
import { getSupabase, loadSiteConfig } from "../_lib/supabase.js";
import { dayPillar, todayKST } from "../_lib/ganzhi.js";
import { getSessionUser, accountFields } from "../_lib/sessions.js";

const PRODUCT_NAMES = {
  "saju-analysis": "기본 사주 리포트",
  compatibility: "관계 궁합 분석",
  cycle: "대운의 흐름",
  "yearly-fortune": "연도별 운세",
  "daily-fortune": "오늘의 무료운세",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });

  try {
    const { productId = "saju-analysis", profile, partner, orderId, visitorId } = await readJson(req);

    if (!profile || !profile.name || !profile.birthDate) {
      return sendJson(res, 400, { message: "이름과 생년월일이 필요합니다." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(profile.birthDate))) {
      return sendJson(res, 400, { message: "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD)." });
    }

    const productName = PRODUCT_NAMES[productId] || PRODUCT_NAMES["saju-analysis"];
    const config = await loadSiteConfig();
    const extra = config?.prompts?.[productId]; // 어드민 추가 지침(코드 base 위에 append)
    const model = config?.ai_model || undefined;
    const acct = accountFields(await getSessionUser(req)); // 로그인 계정(카카오/이메일) — 고객 관리 기준

    // 보관 정책: 1개월(30일) 지난 분석은 서버에서 자동 삭제(개인정보 최소보관·PG 부담 완화). 베스트에포트.
    {
      const rsb = getSupabase();
      if (rsb) {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        rsb.from("analyses").delete().lt("created_at", cutoff).then(() => {}, () => {});
      }
    }

    // 오늘의 무료운세 → 같은 사람·같은 날(KST)이면 저장 결과 재사용(만세력 포인트/AI 절약)
    if (productId === "daily-fortune") {
      return handleDaily({ res, profile, config, prompt: extra, model, visitorId, orderId, acct });
    }

    // 1) 중앙 만세력 (포인트 차감) — 접속정보는 어드민 입력(config.saju) 우선, 없으면 env
    const manse = await computeManse(profile, config);

    const sbInsert = (row) => {
      const sb = getSupabase();
      if (!sb) return;
      // 계정 식별(acct)을 함께 저장. lucky/계정 컬럼이 아직 없으면(미마이그레이션) 기본 컬럼만으로 폴백.
      sb.from("analyses")
        .insert({ ...row, lucky: row.lucky || null, ...acct })
        .then(({ error } = {}) => { if (error) { const { lucky, ...base } = row; sb.from("analyses").insert(base).then(() => {}, () => {}); } }, () => { const { lucky, ...base } = row; sb.from("analyses").insert(base).then(() => {}, () => {}); });
    };

    // 2) 궁합: 두 사람 만세력(2회 차감) → 2단계 설계(점수·해시태그·섹션). 본문은 프론트가 섹션별로.
    if (productId === "compatibility") {
      if (!partner || !partner.name || !partner.birthDate) {
        return sendJson(res, 400, { message: "궁합은 두 사람의 정보가 필요합니다." });
      }
      const manseB = await computeManse(partner, config);
      const plan = await generatePlan({ productId, productName, extra, profile, partner, manse, manseB, model });
      sbInsert({
        product_id: productId,
        profile_name: `${profile.name} × ${partner.name}`,
        manse: manse.full,
        summary: manse.summary,
        headline: plan.headline,
        sections: plan.sections,
        lucky: { score: plan.score, scoreLabel: plan.scoreLabel, hashtags: plan.hashtags },
        visitor_id: visitorId || null,
        order_id: orderId || null,
      });
      return sendJson(res, 200, {
        ok: true,
        mode: "plan",
        productId,
        headline: plan.headline,
        score: plan.score,
        scoreLabel: plan.scoreLabel,
        hashtags: plan.hashtags,
        sections: plan.sections,
        context: plan.context,
        summary: manse.summary,
        manse: manse.full,
        partnerSummary: manseB.summary,
        cost: (manse.cost || 0) + (manseB.cost || 0),
      });
    }

    // 2') 단일 인물 2단계 상품(기본 사주·대운·연도운): '설계'만 빠르게. 본문은 /api/saju/section 병렬.
    if (productId === "saju-analysis" || productId === "cycle" || productId === "yearly-fortune") {
      const plan = await generatePlan({ productId, productName, extra, profile, manse, model });
      sbInsert({
        product_id: productId,
        profile_name: profile.name,
        manse: manse.full,
        summary: manse.summary,
        headline: plan.headline,
        sections: plan.sections,
        lucky: plan.lucky,
        visitor_id: visitorId || null,
        order_id: orderId || null,
      });
      return sendJson(res, 200, {
        ok: true,
        mode: "plan",
        productId,
        headline: plan.headline,
        sections: plan.sections,
        lucky: plan.lucky,
        context: plan.context,
        summary: manse.summary,
        manse: manse.full,
        cost: manse.cost,
      });
    }

    // 2'') 아직 2단계로 전환 전인 상품(대운/연도운)은 기존 1샷 해설(다음 단계에서 전환 예정).
    const report = await generateAnalysis({ productId, productName, prompt: extra, profile, manse, model });
    sbInsert({
      product_id: productId,
      profile_name: profile.name,
      manse: manse.full,
      summary: manse.summary,
      headline: report.headline,
      sections: report.sections,
      lucky: report.lucky,
      visitor_id: visitorId || null,
      order_id: orderId || null,
    });
    return sendJson(res, 200, {
      ok: true,
      headline: report.headline,
      sections: report.sections,
      lucky: report.lucky || null,
      summary: manse.summary,
      manse: manse.full,
      cost: manse.cost,
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      message: error.message || "분석 처리 중 오류가 발생했습니다.",
    });
  }
}

// 사람 식별키(이름+생년월일+시각+성별) — 같은 사람의 같은 날 중복 계산을 막는 서버 캐시 키
function personKey(profile) {
  return createHash("sha256")
    .update(`${profile.name}|${profile.birthDate}|${profile.birthTime || ""}|${profile.gender || ""}`)
    .digest("hex")
    .slice(0, 32);
}

async function handleDaily({ res, profile, config, prompt, model, visitorId, orderId, acct = {} }) {
  const today = todayKST();
  const todayPillar = dayPillar(today.y, today.m, today.d);
  const pk = personKey(profile);
  const sb = getSupabase();
  const tp = { ganzhi: todayPillar.ganzhi, ko: todayPillar.ko };
  const td = { iso: today.iso, label: today.label };

  // 1) 서버 캐시: 오늘(KST) 같은 사람의 결과가 이미 있으면 그대로 반환 → 포인트/AI 과금 없음
  if (sb) {
    try {
      const startIso = new Date(`${today.iso}T00:00:00+09:00`).toISOString();
      const { data: rows } = await sb
        .from("analyses")
        .select("sections, summary")
        .eq("product_id", "daily-fortune")
        .eq("summary->>pk", pk)
        .gte("created_at", startIso)
        .order("created_at", { ascending: false })
        .limit(1);
      const cached = rows && rows[0];
      if (cached && cached.sections) {
        const summary = { ...(cached.summary || {}) };
        delete summary.pk;
        return sendJson(res, 200, { ok: true, kind: "daily", cached: true, daily: cached.sections, summary, today: td, todayPillar: tp, cost: 0 });
      }
    } catch {
      // 캐시 조회 실패 시 그냥 새로 계산(안전 폴백)
    }
  }

  // 2) 캐시 미스 → 만세력(포인트 차감) + AI 생성
  const manse = await computeManse(profile, config);
  const daily = await generateDailyFortune({ profile, summary: manse.summary, model, prompt, today: td, todayPillar: tp });
  if (sb) {
    const dailyRow = {
      product_id: "daily-fortune",
      profile_name: profile.name,
      manse: manse.full,
      summary: { ...manse.summary, pk }, // pk 포함(서버 캐시 조회용, 사용자 응답에는 미포함)
      headline: daily.headline,
      sections: daily,
      visitor_id: visitorId || null,
      order_id: orderId || null,
    };
    // 계정 식별 함께 저장. 계정 컬럼 미마이그레이션이면 기본 행으로 폴백(캐시 누락 방지).
    sb.from("analyses").insert({ ...dailyRow, ...acct }).then(
      ({ error } = {}) => { if (error) sb.from("analyses").insert(dailyRow).then(() => {}, () => {}); },
      () => { sb.from("analyses").insert(dailyRow).then(() => {}, () => {}); },
    );
  }
  return sendJson(res, 200, { ok: true, kind: "daily", daily, summary: manse.summary, today: td, todayPillar: tp, cost: manse.cost });
}
