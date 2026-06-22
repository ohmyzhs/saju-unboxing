// 관리자 API 통합 라우터 (Hobby 함수 12개 제한 대응)
// /api/admin/login | /api/admin/config | /api/admin/upload | /api/admin/analytics
import { readJson, sendJson, cookie, cookieSecure } from "../_lib/http.js";
import { isAdmin, sha256, effectiveAdminHash, sessionTokenFor } from "../_lib/adminAuth.js";
import { getSupabase, loadSiteConfig } from "../_lib/supabase.js";
import { summarizeAnalytics } from "../_lib/analytics.js";
import { LEGAL_DEFAULTS } from "../_lib/legalDefaults.js";
import { fetchBalance } from "../_lib/sajuApi.js";
import { handleAdminPoints } from "../_lib/adminPoints.js";

const BUCKET = "site-images";

export default async function handler(req, res) {
  const action = req.query?.action || (req.url || "").split("?")[0].split("/").pop();

  if (action === "login") return login(req, res);

  if (!(await isAdmin(req))) return sendJson(res, 401, { message: "관리자 로그인이 필요합니다." });
  if (action === "config") return config(req, res);
  if (action === "upload") return upload(req, res);
  if (action === "analytics") return analytics(req, res);
  if (action === "password") return changePassword(req, res);
  if (action === "saju-test") return sajuTest(req, res);
  if (action === "points") return handleAdminPoints(req, res, getSupabase());
  return sendJson(res, 404, { message: "관리자 경로를 찾지 못했습니다." });
}

// ── 로그인 ──
async function login(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  const { password } = await readJson(req);
  const hash = await effectiveAdminHash();
  if (!password || sha256(password) !== hash) {
    return sendJson(res, 401, { message: "비밀번호가 올바르지 않습니다." });
  }
  res.setHeader(
    "Set-Cookie",
    cookie("saju_admin", sessionTokenFor(hash), { httpOnly: true, secure: cookieSecure(), maxAge: 60 * 60 * 12 }),
  );
  return sendJson(res, 200, { ok: true });
}

// 어드민 페이지에서 비밀번호 변경 → site_config.admin_password_hash 저장
async function changePassword(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  const sb = getSupabase();
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않아 비밀번호를 저장할 수 없습니다." });
  const { newPassword } = await readJson(req);
  if (!newPassword || String(newPassword).length < 4) {
    return sendJson(res, 400, { message: "비밀번호는 4자 이상이어야 합니다." });
  }
  const newHash = sha256(newPassword);
  const { error } = await sb
    .from("site_config")
    .update({ admin_password_hash: newHash, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return sendJson(res, 500, { message: error.message });
  // 새 비밀번호 기준 세션 재발급(현재 로그인 유지)
  res.setHeader(
    "Set-Cookie",
    cookie("saju_admin", sessionTokenFor(newHash), { httpOnly: true, secure: cookieSecure(), maxAge: 60 * 60 * 12 }),
  );
  return sendJson(res, 200, { ok: true });
}

// 만세력 API 연결 테스트 — 폼에 입력한 값(또는 저장된 값)으로 본사 잔액 조회
async function sajuTest(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  const { base, key } = await readJson(req);
  // 폼 값이 비어 있으면 저장된 설정/환경변수로 폴백
  const config = base && key ? { saju: { base, key } } : await loadSiteConfig();
  const bal = await fetchBalance(config);
  if (bal.ok) return sendJson(res, 200, { ok: true, balance: bal.balance });
  if (bal.reason === "missing-config") {
    return sendJson(res, 400, { ok: false, message: "API 주소와 키를 먼저 입력하세요." });
  }
  return sendJson(res, 200, {
    ok: false,
    message: bal.status === 401 ? "API 키가 유효하지 않습니다." : `연결 실패 (${bal.reason || bal.status})`,
  });
}

// ── 상품/프롬프트/이미지/모델 설정 ──
async function config(req, res) {
  if (req.method === "GET") {
    const c = await loadSiteConfig();
    return sendJson(res, 200, {
      products: c.products || {},
      prompts: c.prompts || {},
      images: c.images || {},
      branding: c.branding || {},
      ai_model: c.ai_model || "glm-5.2",
      chat_model: c.chat_model || "",
      legal: c.legal || {},
      legalDefaults: LEGAL_DEFAULTS,
      business: c.business || {},
      saju: c.saju || {}, // { base, key, productCode } — 어드민 인증 뒤에서만 노출(/api/config 에는 없음)
    });
  }
  if (req.method === "POST") {
    const sb = getSupabase();
    if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않았습니다." });
    const body = await readJson(req);
    const patch = { updated_at: new Date().toISOString() };
    ["products", "prompts", "images", "branding", "ai_model", "chat_model", "legal", "business", "saju"].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    const { error } = await sb.from("site_config").update(patch).eq("id", 1);
    if (error) return sendJson(res, 500, { message: error.message });
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { message: "GET/POST only" });
}

// ── 이미지 업로드 ──
async function upload(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  const sb = getSupabase();
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않았습니다." });

  const { key, dataUrl } = await readJson(req);
  if (!key || !dataUrl) return sendJson(res, 400, { message: "key와 이미지가 필요합니다." });

  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!match) return sendJson(res, 400, { message: "이미지 형식 오류 (base64 dataURL 필요)." });
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = (contentType.split("/")[1] || "png").replace("jpeg", "jpg");
  const safeKey = String(key).replace(/[^a-z0-9._-]/gi, "_");
  const path = `${safeKey}-${Date.now()}.${ext}`;

  await sb.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const up = await sb.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
  if (up.error) return sendJson(res, 500, { message: up.error.message });

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;

  const cur = await sb.from("site_config").select("images").eq("id", 1).maybeSingle();
  const images = cur.data?.images || {};
  images[key] = url;
  await sb.from("site_config").update({ images, updated_at: new Date().toISOString() }).eq("id", 1);

  return sendJson(res, 200, { ok: true, url, images });
}

// ── 통계 ──
function mapEvent(row) {
  return {
    id: row.id,
    at: row.at ? new Date(row.at).getTime() : Date.now(),
    event: row.event,
    page: row.page,
    view: row.view,
    visitorId: row.visitor_id,
    sessionId: row.session_id,
    referrer: row.referrer,
    utm: row.utm || {},
    device: row.device || {},
    metadata: row.metadata || {},
    durationMs: row.duration_ms,
    landingPage: row.metadata?.landingPage,
    ip: row.ip,
  };
}
export function mapOrder(row) {
  return {
    orderId: row.id,
    productId: row.product_id,
    productName: row.product_id,
    profileName: row.profile_name,
    amount: row.amount,
    cashAmount: Number(row.amount || 0),
    pointsUsed: Number(row.points_used || 0),
    payMethod: row.pay_method || "toss",
    totalAmount: Number(row.amount || 0) + Number(row.points_used || 0),
    status: row.status,
    visitorId: row.visitor_id,
    userId: row.user_id || null,
    userLabel: row.user_label || null,
    userProvider: row.user_provider || null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    approvedAt: row.approved_at ? new Date(row.approved_at).getTime() : undefined,
  };
}
async function analytics(req, res) {
  const sb = getSupabase();
  if (!sb) return sendJson(res, 200, summarizeAnalytics([], []));
  // 분석 작업 목록 — 큰 컬럼(manse/sections)은 빼고 메타만. 계정 컬럼이 아직 없으면(미마이그레이션) 라이트로 폴백.
  const ANALYSIS_COLS = "id, product_id, profile_name, order_id, visitor_id, created_at, user_id, user_label, user_provider";
  const ANALYSIS_COLS_LITE = "id, product_id, profile_name, order_id, visitor_id, created_at";
  const [{ data: evRows }, { data: orderRows }] = await Promise.all([
    sb.from("events").select("*").order("at", { ascending: false }).limit(3000),
    sb.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  let aq = await sb.from("analyses").select(ANALYSIS_COLS).order("created_at", { ascending: false }).limit(500);
  if (aq.error) aq = await sb.from("analyses").select(ANALYSIS_COLS_LITE).order("created_at", { ascending: false }).limit(500);
  const events = (evRows || []).map(mapEvent).reverse();
  const orders = (orderRows || []).map(mapOrder);
  const summary = summarizeAnalytics(events, orders);
  summary.analyses = (aq.data || []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    profileName: r.profile_name,
    orderId: r.order_id,
    visitorId: r.visitor_id,
    userId: r.user_id || null,
    userLabel: r.user_label || null,
    userProvider: r.user_provider || null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
  return sendJson(res, 200, summary);
}
