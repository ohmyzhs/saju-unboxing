// GET /api/health — 셋업 점검. 각 연동(중앙API·Supabase·OpenAI·토스·카카오) 상태를 ✅/❌로.
import { sendJson } from "./_lib/http.js";
import { getSupabase, loadSiteConfig } from "./_lib/supabase.js";
import { fetchBalance, sajuCreds } from "./_lib/sajuApi.js";

export default async function handler(req, res) {
  const checks = {};
  const config = await loadSiteConfig().catch(() => ({}));

  // 1) 중앙 만세력 API + 포인트 잔액 (어드민 입력 config.saju 우선, 없으면 env)
  const creds = sajuCreds(config);
  if (!creds.base || !creds.key) {
    checks.centralApi = { ok: false, message: "만세력 API 미설정 (어드민 '만세력 API' 탭 또는 .env)" };
  } else {
    const bal = await fetchBalance(config);
    checks.centralApi = bal.ok
      ? { ok: true, message: `연결됨 · 잔액 ${bal.balance ?? "?"}P` }
      : { ok: false, message: bal.status === 401 ? "API 키가 유효하지 않음" : `응답 오류(${bal.reason || bal.status})` };
  }

  // 2) Supabase
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

  // 3) OpenCode Go (AI 해설)
  checks.openai = process.env.OPENCODE_API_KEY
    ? { ok: true, message: `키 설정됨 · 모델 ${process.env.OPENCODE_MODEL || "glm-5.2"}` }
    : { ok: false, message: "OPENCODE_API_KEY 미설정" };

  // 4) 토스
  const tossLive = process.env.TOSS_CLIENT_KEY && !process.env.TOSS_CLIENT_KEY.startsWith("test_");
  checks.toss = {
    ok: true,
    message: tossLive ? "실결제 키" : "테스트 키(실제 결제 안 됨) — 학습용으로 OK",
  };

  // 5) 카카오
  checks.kakao = process.env.KAKAO_REST_API_KEY
    ? { ok: true, message: "설정됨" }
    : { ok: false, message: "KAKAO_REST_API_KEY 미설정 (고객 로그인 비활성)" };

  // 6) 관리자 비밀번호
  checks.admin = process.env.ADMIN_PASSWORD
    ? {
        ok: process.env.ADMIN_PASSWORD !== "changeme-1234",
        message:
          process.env.ADMIN_PASSWORD === "changeme-1234"
            ? "기본 비밀번호 그대로 — 꼭 변경하세요"
            : "설정됨",
      }
    : { ok: false, message: "ADMIN_PASSWORD 미설정" };

  const ready = checks.centralApi.ok && checks.supabase.ok && checks.openai.ok;
  return sendJson(res, 200, { ready, checks });
}
