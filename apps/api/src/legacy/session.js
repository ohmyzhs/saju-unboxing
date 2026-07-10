// GET  /api/session — 현재 로그인 사용자(카카오/이메일) 반환.
// POST /api/session — 이메일+비밀번호 로그인/회원가입 (Hobby 함수 수 절약 위해 세션 조회와 통합).
//   body: { action: "login" | "signup", email, password, passwordConfirm?, nickname?, phone? }
import { readJson, sendJson, cookie, cookieSecure } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { getSessionUser, createSession, deleteSession } from "./_lib/sessions.js";
import { hashPassword, verifyPassword } from "./_lib/password.js";
import { ensurePointAccount, getPointAccount } from "./_lib/points.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^01[016789]\d{7,8}$/;

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateEmailSignup(body = {}) {
  const nickname = String(body.nickname || "").trim().replace(/\s+/g, " ");
  const phone = normalizePhone(body.phone);
  const password = String(body.password || "");
  const passwordConfirm = String(body.passwordConfirm || "");
  if (nickname.length < 2 || nickname.length > 20) return { message: "닉네임은 2~20자로 입력하세요." };
  if (!PHONE_RE.test(phone)) return { message: "휴대폰 번호를 정확히 입력하세요." };
  if (password.length < 8) return { message: "가입 비밀번호는 8자 이상이어야 합니다." };
  if (password !== passwordConfirm) return { message: "비밀번호 확인이 일치하지 않습니다." };
  if (body.consent !== true) return { message: "이용약관과 개인정보처리방침 동의가 필요합니다." };
  return { nickname, phone, password };
}

function setSessionCookie(res, sid) {
  res.setHeader(
    "Set-Cookie",
    cookie("saju_session", sid, { httpOnly: true, secure: cookieSecure(), maxAge: 60 * 60 * 24 * 7 }),
  );
}

async function pointPayload(sb, user) {
  if (!sb || !user?.id) return { enabled: false, balance: 0, regenTokens: 0, updatedAt: null, transactions: [] };
  try {
    await ensurePointAccount(sb, user.id);
    return await getPointAccount(sb, user.id, 30);
  } catch {
    return { enabled: false, balance: 0, regenTokens: 0, updatedAt: null, transactions: [] };
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const user = await getSessionUser(req);
    return sendJson(res, 200, { user: user || null, points: await pointPayload(getSupabase(), user) });
  }
  if (req.method !== "POST") return sendJson(res, 405, { message: "GET/POST only" });

  const body = await readJson(req);
  const action = body.action || "login";

  // ── 로그아웃 (카카오/이메일 공통) ──
  if (action === "logout") {
    await deleteSession(req);
    res.setHeader("Set-Cookie", cookie("saju_session", "", { httpOnly: true, secure: cookieSecure(), maxAge: 0 }));
    return sendJson(res, 200, { ok: true });
  }

  // ── 이메일 로그인/회원가입 ──
  const sb = getSupabase();
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않아 이메일 로그인을 쓸 수 없습니다." });

  const { email, password } = body;
  const em = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(em)) return sendJson(res, 400, { message: "올바른 이메일을 입력하세요." });

  if (action === "signup") {
    const signup = validateEmailSignup(body);
    if (signup.message) return sendJson(res, 400, { message: signup.message });
    const [emailExists, phoneExists] = await Promise.all([
      sb.from("users").select("id").eq("email", em).maybeSingle(),
      sb.from("users").select("id").eq("phone", signup.phone).maybeSingle(),
    ]);
    if (emailExists.error || phoneExists.error) {
      return sendJson(res, 500, { message: emailExists.error?.message || phoneExists.error?.message });
    }
    if (emailExists.data) return sendJson(res, 409, { message: "이미 가입된 이메일입니다. 로그인해 주세요." });
    if (phoneExists.data) return sendJson(res, 409, { message: "이미 가입에 사용된 휴대폰 번호입니다." });
    const { data, error } = await sb
      .from("users")
      .insert({
        email: em,
        password_hash: hashPassword(signup.password),
        nickname: signup.nickname,
        phone: signup.phone,
        terms_accepted_at: new Date().toISOString(),
      })
      .select("id, email, nickname, phone")
      .single();
    if (error) return sendJson(res, 500, { message: error.message });
    const user = { id: data.id, email: data.email, nickname: data.nickname, phone: data.phone, provider: "email" };
    setSessionCookie(res, await createSession(user));
    return sendJson(res, 200, { ok: true, user, points: await pointPayload(sb, user) });
  }

  if (action !== "login") return sendJson(res, 400, { message: "지원하지 않는 인증 요청입니다." });
  if (!password || String(password).length < 6) {
    return sendJson(res, 400, { message: "비밀번호는 6자 이상이어야 합니다." });
  }

  // 기본: 로그인
  const { data: u } = await sb
    .from("users")
    .select("id, email, nickname, phone, password_hash")
    .eq("email", em)
    .maybeSingle();
  if (!u || !verifyPassword(password, u.password_hash)) {
    return sendJson(res, 401, { message: "이메일 또는 비밀번호가 올바르지 않습니다." });
  }
  const user = { id: u.id, email: u.email, nickname: u.nickname, phone: u.phone || "", provider: "email" };
  setSessionCookie(res, await createSession(user));
  return sendJson(res, 200, { ok: true, user, points: await pointPayload(sb, user) });
}
