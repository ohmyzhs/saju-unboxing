// POST /api/saju/section
// 2단계: /api/saju/analyze 가 준 설계와 만세력 컨텍스트로 섹션 본문을 1~2개 생성.
// 만세력 포인트 차감 없음(컨텍스트 재사용). 프론트가 2개 단위로 병렬 호출 → 점진적 렌더.
import { readJson, sendJson } from "../_lib/http.js";
import { generateSection, generateSections, generateFollowup } from "../_lib/analysis.js";
import { loadSiteConfig } from "../_lib/supabase.js";

export function validateSectionBatchInput(sections) {
  if (!Array.isArray(sections) || sections.length < 1 || sections.length > 2) {
    const error = new Error("섹션 배치는 1~2개여야 합니다.");
    error.statusCode = 400;
    throw error;
  }
  for (const section of sections) {
    if (![section?.id, section?.title, section?.angle].every((value) => typeof value === "string" && value.trim())) {
      const error = new Error("각 섹션에는 id, title, angle이 필요합니다.");
      error.statusCode = 400;
      throw error;
    }
  }
  return sections;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  try {
    const body = await readJson(req);

    // 추가 질문 상담(결제형): 보관함에 저장된 만세력을 재사용해 후속 질문 1건에 답한다.
    // 함수 수(Vercel Hobby 12개) 절약 위해 별도 엔드포인트 대신 여기에 통합.
    if (body.mode === "followup") {
      const { profile, manse, summary, question, history = [] } = body;
      if (!profile || !profile.name) return sendJson(res, 400, { message: "프로필이 필요합니다." });
      if (!question || !String(question).trim()) return sendJson(res, 400, { message: "질문을 입력해주세요." });
      const config = await loadSiteConfig();
      const extra = config?.prompts?.["followup"]; // 어드민이 추가 질문 톤을 따로 줄 수 있음
      const model = config?.ai_model || undefined;
      const { answer } = await generateFollowup({ profile, manse, summary, question, history, model, extra });
      return sendJson(res, 200, { ok: true, answer });
    }

    const { productId = "saju-analysis", profile, partner, context, section, sections, otherTitles = [] } = body;
    if (!profile || !profile.name) return sendJson(res, 400, { message: "프로필이 필요합니다." });
    if (!context) return sendJson(res, 400, { message: "설계(섹션) 정보가 필요합니다." });

    const config = await loadSiteConfig();
    const extra = config?.prompts?.[productId]; // 어드민 추가 지침
    const model = config?.ai_model || undefined;

    if (Array.isArray(sections)) {
      const requested = validateSectionBatchInput(sections);
      const generated = await generateSections({
        productId,
        extra,
        profile,
        partner,
        context,
        sections: requested,
        otherTitles,
        model,
      });
      return sendJson(res, 200, { ok: true, sections: generated });
    }

    if (!section || !section.title) return sendJson(res, 400, { message: "설계(섹션) 정보가 필요합니다." });

    const { body: sectionBody } = await generateSection({ productId, extra, profile, partner, context, section, otherTitles, model });
    return sendJson(res, 200, { ok: true, id: section.id || null, body: sectionBody });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      message: error.message || "섹션 생성 중 오류가 발생했습니다.",
    });
  }
}
