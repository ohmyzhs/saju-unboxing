// Supabase 서비스 롤 클라이언트 (서버리스 함수 전용).
// 환경변수 미설정 시 null 을 반환해, DB 없이도 분석 기능이 동작하도록 한다(베스트에포트 저장).
import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase() {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    client = null;
    return null;
  }
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

/** site_config 단일 행 로드. 없으면 빈 객체. */
export async function loadSiteConfig() {
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.from("site_config").select("*").eq("id", 1).maybeSingle();
  return data || {};
}
