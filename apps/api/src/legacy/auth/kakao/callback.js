// GET /api/auth/kakao/callback — state 검증 → 토큰 교환 → 사용자 조회 → 세션 발급
import { readCookies, cookie, cookieSecure, baseUrl, redirect, webBaseUrl } from "../../_lib/http.js";
import { kakaoToken, kakaoUser } from "../../_lib/kakao.js";
import { createSession } from "../../_lib/sessions.js";

export default async function handler(req, res) {
  const url = new URL(req.url, baseUrl(req));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = readCookies(req);
  const webOrigin = webBaseUrl(req);

  if (!code || !state || state !== cookies.saju_kakao_state) {
    return redirect(res, `${webOrigin}/?auth=state-error`);
  }

  try {
    const token = await kakaoToken(code, {
      restApiKey: process.env.KAKAO_REST_API_KEY,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      redirectUri: process.env.KAKAO_REDIRECT_URI || `${baseUrl(req)}/api/auth/kakao/callback`,
    });
    const user = await kakaoUser(token.access_token);
    const sessionId = await createSession(user);

    return redirect(res, `${webOrigin}/?auth=kakao-ok`, {
      "Set-Cookie": [
        cookie("saju_session", sessionId, { httpOnly: true, secure: cookieSecure(), maxAge: 60 * 60 * 24 * 7 }),
        cookie("saju_kakao_state", "", { httpOnly: true, secure: cookieSecure(), maxAge: 0 }),
      ],
    });
  } catch (error) {
    return redirect(res, `${webOrigin}/?auth=error&reason=${encodeURIComponent(error.message)}`);
  }
}
