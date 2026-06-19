// GET /api/auth/kakao/start — 카카오 인가 시작 (state 쿠키 발급)
import { randomBytes } from "crypto";
import { cookie, cookieSecure, baseUrl, redirect } from "../../_lib/http.js";

export default async function handler(req, res) {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) return redirect(res, "/?auth=missing-kakao");

  const redirectUri = process.env.KAKAO_REDIRECT_URI || `${baseUrl(req)}/api/auth/kakao/callback`;
  const state = randomBytes(24).toString("hex");

  const authorize = new URL("https://kauth.kakao.com/oauth/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", restApiKey);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  // scope는 강제하지 않는다 — 카카오 앱마다 설정한 [동의항목]이 다르므로, 설정 안 한 항목을
  // 요청하면 KOE205로 거부된다. 동의항목은 카카오 콘솔에서 가맹점이 직접 켠다.
  // 특정 scope를 꼭 요청하려면 KAKAO_SCOPE 환경변수로 지정(예: "profile_nickname,account_email").
  const scope = (process.env.KAKAO_SCOPE || "").trim();
  if (scope) authorize.searchParams.set("scope", scope);

  return redirect(res, authorize.toString(), {
    "Set-Cookie": cookie("saju_kakao_state", state, { httpOnly: true, secure: cookieSecure(), maxAge: 600 }),
  });
}
