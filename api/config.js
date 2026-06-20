// GET /api/config — 프론트 부팅 시 필요한 공개 설정.
// 토스 클라이언트 키, 카카오 사용 여부, 가맹점이 어드민에서 바꾼 상품/이미지(공개분).
import { sendJson } from "./_lib/http.js";
import { loadSiteConfig } from "./_lib/supabase.js";
import { LEGAL_DEFAULTS } from "./_lib/legalDefaults.js";
import { POINT_CHARGE_TIERS } from "./_lib/points.js";

export default async function handler(req, res) {
  const tossClientKey =
    process.env.TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
  let config = {};
  try {
    config = await loadSiteConfig();
  } catch {
    config = {};
  }
  // 사업자 하단정보 — 어드민 입력(site_config.business) 우선, env는 대체수단
  const savedBiz = config?.business || {};
  const business = {
    name: savedBiz.name || process.env.BUSINESS_NAME || "",
    owner: savedBiz.owner || process.env.BUSINESS_OWNER || "",
    regNo: savedBiz.regNo || process.env.BUSINESS_REG_NO || "",
    mailOrderNo: savedBiz.mailOrderNo || process.env.BUSINESS_MAILORDER_NO || "",
    address: savedBiz.address || process.env.BUSINESS_ADDRESS || "",
    tel: savedBiz.tel || process.env.BUSINESS_TEL || "",
    email: savedBiz.email || process.env.BUSINESS_EMAIL || "",
    privacyOfficer: savedBiz.privacyOfficer || process.env.BUSINESS_PRIVACY_OFFICER || "",
  };

  // 약관/개인정보/환불 — 가맹점이 어드민에서 비워두면 기본문구로 자동 노출
  const savedLegal = config?.legal || {};
  const legal = {
    terms: savedLegal.terms || LEGAL_DEFAULTS.terms,
    privacy: savedLegal.privacy || LEGAL_DEFAULTS.privacy,
    refund: savedLegal.refund || LEGAL_DEFAULTS.refund,
  };

  return sendJson(res, 200, {
    tossClientKey,
    tossMode: tossClientKey.startsWith("test_") ? "test" : "live",
    tossVariantKey: process.env.TOSS_VARIANT_KEY || "DEFAULT", // 토스 결제위젯 어드민에서 만든 결제 UI 키
    kakaoEnabled: Boolean(process.env.KAKAO_REST_API_KEY),
    pointsEnabled: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
    pointChargeTiers: POINT_CHARGE_TIERS,
    products: config?.products || {},
    images: config?.images || {},
    branding: config?.branding || {},
    business,
    legal,
  });
}
