// 로그인 세션 헬퍼 (Supabase sessions 테이블 + httpOnly 쿠키).
import { randomUUID } from "crypto";
import { getSupabase } from "./supabase.js";
import { readCookies } from "./http.js";

// 로그인 사용자 → 주문/분석에 저장할 '계정 식별' 필드. 게스트(미로그인)면 전부 null.
// 카카오면 닉네임, 이메일이면 이메일 주소를 라벨로 — 고객 관리는 user_id(계정) 기준으로 묶는다.
export function accountFields(user) {
  if (!user?.id) return { user_id: null, user_label: null, user_provider: null };
  const provider = user.provider === "email" ? "email" : "kakao";
  const label = provider === "email" ? user.email || "이메일 회원" : user.nickname || "카카오 회원";
  return { user_id: String(user.id), user_label: label, user_provider: provider };
}

export async function createSession(user, days = 7) {
  const sb = getSupabase();
  const id = randomUUID();
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  if (sb) await sb.from("sessions").insert({ id, kakao_user: user, expires_at: expires });
  return id;
}

export async function getSessionUser(req) {
  const sid = readCookies(req).saju_session;
  if (!sid) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("sessions")
    .select("kakao_user, expires_at")
    .eq("id", sid)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data.kakao_user || null;
}

export async function deleteSession(req) {
  const sid = readCookies(req).saju_session;
  if (!sid) return;
  const sb = getSupabase();
  if (sb) await sb.from("sessions").delete().eq("id", sid);
}
