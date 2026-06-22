// GET /api/config — 프론트 부팅 시 필요한 공개 설정.
// 토스 클라이언트 키, 카카오 사용 여부, 가맹점이 어드민에서 바꾼 상품/이미지(공개분).
import { sendJson } from "./_lib/http.js";
import { getSupabase, loadSiteConfig } from "./_lib/supabase.js";
import { fetchBalance, sajuCreds } from "./_lib/sajuApi.js";
import { LEGAL_DEFAULTS } from "./_lib/legalDefaults.js";
import { POINT_CHARGE_TIERS } from "./_lib/points.js";

// /api/health 는 /api/config?mode=health 로 통합(Vercel Hobby 함수 12개 제한 대응).
async function healthPayload() {
  const checks = {};
  const config = await loadSiteConfig().catch(() => ({}));
  const creds = sajuCreds(config);
  if (!creds.base || !creds.key) {
    checks.centralApi = { ok: false, message: "만세력 API 미설정 (어드민 '만세력 API' 탭 또는 .env)" };
  } else {
    const bal = await fetchBalance(config);
    checks.centralApi = bal.ok
      ? { ok: true, message: `연결됨 · 잔액 ${bal.balance ?? "?"}P` }
      : { ok: false, message: bal.status === 401 ? "API 키가 유효하지 않음" : `응답 오류(${bal.reason || bal.status})` };
  }
  const sb = getSupabase();
  if (!sb) {
    checks.supabase = { ok: false, message: "SUPABASE_URL / SUPABASE_SERVICE_KEY 미설정" };
  } else {
    try {
      const { error } = await sb.from("site_config").select("id").limit(1);
      checks.supabase = error
        ? { ok: false, message: `쿼리 실패: ${error.message} (schema.sql 실행했나요?)` }
        : { ok: true, message: "연결됨" };
    } catch (e) {
      checks.supabase = { ok: false, message: e.message };
    }
  }
  checks.openai = process.env.OPENCODE_API_KEY
    ? { ok: true, message: `키 설정됨 · 모델 ${process.env.OPENCODE_MODEL || "glm-5.2"}` }
    : { ok: false, message: "OPENCODE_API_KEY 미설정" };
  const tossLive = process.env.TOSS_CLIENT_KEY && !process.env.TOSS_CLIENT_KEY.startsWith("test_");
  checks.toss = { ok: true, message: tossLive ? "실결제 키" : "테스트 키(실제 결제 안 됨) — 학습용으로 OK" };
  checks.kakao = process.env.KAKAO_REST_API_KEY
    ? { ok: true, message: "설정됨" }
    : { ok: false, message: "KAKAO_REST_API_KEY 미설정 (고객 로그인 비활성)" };
  checks.admin = process.env.ADMIN_PASSWORD
    ? {
        ok: process.env.ADMIN_PASSWORD !== "changeme-1234",
        message: process.env.ADMIN_PASSWORD === "changeme-1234" ? "기본 비밀번호 그대로 — 꼭 변경하세요" : "설정됨",
      }
    : { ok: false, message: "ADMIN_PASSWORD 미설정" };
  return { ready: checks.centralApi.ok && checks.supabase.ok && checks.openai.ok, checks };
}

export default async function handler(req, res) {
  const mode = req.query?.mode || (() => { try { return new URL(req.url, "http://x").searchParams.get("mode"); } catch { return null; } })();
  if (mode === "health") return sendJson(res, 200, await healthPayload());

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
    kakaoJsKey: config?.kakaoJsKey || process.env.KAKAO_JS_KEY || "", // 카카오 공유(Kakao JS SDK) 키. 비우면 링크복사 폴백.
    pointsEnabled: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
    pointChargeTiers: POINT_CHARGE_TIERS,
    products: config?.products || {},
    images: config?.images || {},
    branding: config?.branding || {},
    business,
    legal,
  });
}
