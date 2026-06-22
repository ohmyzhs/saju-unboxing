// 관리자 인증 — 비밀번호 해시(어드민에서 변경한 DB 우선 → env → 기본값) 기반 세션 쿠키.
// 비밀번호가 바뀌면 기존 세션 쿠키는 자동으로 무효화됨.
import { createHash } from "crypto";
import { readCookies } from "./http.js";
import { loadSiteConfig } from "./supabase.js";

const DEFAULT_PASSWORD = "admin1004";

export function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

// 현재 유효한 비밀번호 해시: ① 어드민에서 변경(site_config) → ② env ADMIN_PASSWORD → ③ 기본값(admin1004)
export async function effectiveAdminHash() {
  try {
    const c = await loadSiteConfig();
    if (c?.admin_password_hash) return c.admin_password_hash;
  } catch {
    // DB 못 읽으면 env/기본값으로
  }
  return sha256(process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD);
}

// 세션 쿠키 값 (비밀번호 해시 기반 → 비번 바뀌면 기존 쿠키 자동 무효)
export function sessionTokenFor(hash) {
  return sha256(`saju-admin-session:${hash}`);
}

export async function isAdmin(req) {
  const token = readCookies(req).saju_admin;
  if (!token) return false;
  return token === sessionTokenFor(await effectiveAdminHash());
}
