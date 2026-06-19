// 카카오 OAuth 헬퍼 (가맹점 자기 앱 키 사용).

export async function kakaoToken(code, { restApiKey, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: restApiKey,
    redirect_uri: redirectUri,
    code,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "카카오 토큰 발급 실패");
  }
  return payload;
}

export async function kakaoUser(accessToken) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.msg || "카카오 사용자 조회 실패");
  return {
    id: payload.id,
    nickname:
      payload.kakao_account?.profile?.nickname || payload.properties?.nickname || "카카오 사용자",
    email: payload.kakao_account?.email || "",
    profileImage: payload.kakao_account?.profile?.thumbnail_image_url || "",
  };
}
