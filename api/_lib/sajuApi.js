// 중앙(대표) 만세력 API 클라이언트.
// 가맹점 API 키(SAJU_API_KEY)로 POST {SAJU_API_BASE}/api/v1/saju/compute 를 호출한다.
// 호출 1회당 가맹점 포인트가 차감된다(중앙에서 처리).

const GENDER_MAP = { M: "male", F: "female", male: "male", female: "female" };

/**
 * 만세력 API 접속 정보. 어드민 입력(site_config.saju)이 우선, 없으면 환경변수.
 * → 가맹점이 어드민 "만세력 API" 탭에서 입력하면 .env 없이도 동작.
 */
export function sajuCreds(config) {
  const s = (config && config.saju) || {};
  return {
    base: (s.base || process.env.SAJU_API_BASE || "").trim(),
    key: (s.key || process.env.SAJU_API_KEY || "").trim(),
    productCode: (s.productCode || process.env.SAJU_PRODUCT_CODE || "saju_basic").trim(),
  };
}

/** 프론트 프로필 → 중앙 API 입력으로 변환 */
export function toComputeInput(profile, productCode) {
  const gender = GENDER_MAP[profile.gender] || "female";
  const isLunar = profile.calendar === "lunar" || profile.calendar === "leap_lunar";
  const isLeapMonth = profile.calendar === "leap_lunar";
  const birthTime = profile.timeKnown === "no" ? undefined : profile.birthTime || undefined;
  return {
    productCode,
    name: profile.name,
    gender,
    birthDate: profile.birthDate,
    birthTime,
    isLunar,
    isLeapMonth,
  };
}

/** 중앙 API 호출 → { ok, cost, summary, full } */
export async function computeManse(profile, config) {
  const { base, key, productCode } = sajuCreds(config);
  if (!base || !key) {
    const err = new Error(
      "중앙 만세력 API가 설정되지 않았습니다. 어드민 '만세력 API' 탭에서 입력하거나 .env(SAJU_API_BASE/SAJU_API_KEY)를 채우세요.",
    );
    err.statusCode = 503;
    throw err;
  }
  const input = toComputeInput(profile, productCode);

  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/saju/compute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(
      response.status === 402
        ? "포인트가 부족합니다. 대표 포인트 충전이 필요합니다."
        : payload.error || payload.detail || "만세력 계산에 실패했습니다.",
    );
    err.statusCode = response.status;
    throw err;
  }
  return payload; // { ok, cost, summary, full }
}

/** 중앙 포인트 잔액 조회 (셋업 점검용 / 어드민 연결 테스트용) */
export async function fetchBalance(config) {
  const { base, key } = sajuCreds(config);
  if (!base || !key) return { ok: false, reason: "missing-config" };
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/balance`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, balance: payload.balance };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
