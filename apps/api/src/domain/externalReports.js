const DEFAULT_TIMEOUT_MS = 15000;

export const EXTERNAL_REPORT_PRODUCTS = Object.freeze({
  "mz-dark-mudang-online": Object.freeze({
    id: "mz-dark-mudang-online",
    provider: "saju-web",
    name: "운명 완전개봉 · 흑야 프리미엄",
    productType: "general_saju",
    reportTemplate: "tight-v3",
    reportEngine: "default",
  }),
});

export function externalReportProduct(productId) {
  return EXTERNAL_REPORT_PRODUCTS[String(productId || "")] || null;
}

export function isExternalReportProduct(productId) {
  return Boolean(externalReportProduct(productId));
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeGender(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["m", "male", "남", "남성"].includes(normalized)) return "male";
  if (["f", "female", "여", "여성"].includes(normalized)) return "female";
  return "other";
}

function normalizeCalendar(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["lunar", "음력"].includes(normalized) ? "lunar" : "solar";
}

function baseUrl(env = process.env) {
  return String(env.SAJU_WEB_API_BASE_URL || env.SAJU_WEB_API_BASE || "").trim().replace(/\/+$/, "");
}

function apiKey(env = process.env) {
  return String(env.SAJU_WEB_API_KEY || env.SAJU_LAB_API_KEY || "").trim();
}

export function buildExternalReportOrderPayload(order, product = externalReportProduct(order?.product_id)) {
  const snapshot = parseJson(order?.purchase_snapshot);
  const profile = snapshot.profile || {};
  if (!profile.name && !order?.profile_name) throw new Error("외부 리포트 주문에 필요한 프로필 이름이 없습니다.");
  if (!profile.birthDate) throw new Error("외부 리포트 주문에 필요한 생년월일이 없습니다.");

  return {
    customer_name: profile.name || order.profile_name || "고객",
    email: snapshot.customer?.email || "",
    phone: snapshot.customer?.phone || "",
    product_type: product?.productType || "general_saju",
    birth_date: profile.birthDate,
    birth_time: profile.birthTime || "",
    calendar_type: normalizeCalendar(profile.calendar),
    is_leap_month: Boolean(profile.isLeapMonth),
    birth_place: profile.birthPlace || profile.birth_place || "서울",
    gender: normalizeGender(profile.gender),
    question_text: snapshot.questionText || "",
    report_template: product?.reportTemplate || "tight-v3",
    report_engine: product?.reportEngine || "default",
    report_model: product?.reportModel || "",
    use_true_solar_time: Boolean(snapshot.useTrueSolarTime),
    auto_queue: true,
  };
}

async function requestJson(url, { method = "GET", key, body, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        ...(key ? { "X-API-Key": key } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.detail || payload.message || `saju-web API 오류(${response.status})`);
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function createSajuWebReportOrder({ order, product = externalReportProduct(order?.product_id), env = process.env, fetchImpl = fetch } = {}) {
  const base = baseUrl(env);
  const key = apiKey(env);
  if (!base) throw new Error("SAJU_WEB_API_BASE_URL이 설정되지 않았습니다.");
  if (!key) throw new Error("SAJU_WEB_API_KEY가 설정되지 않았습니다.");
  if (!product) throw new Error("외부 리포트 상품 설정을 찾지 못했습니다.");

  const payload = buildExternalReportOrderPayload(order, product);
  const created = await requestJson(`${base}/api/v1/orders`, {
    method: "POST",
    key,
    body: payload,
    fetchImpl,
  });
  const externalOrderId = created.order_id;
  const shareToken = created.share_token || "";
  return {
    provider: product.provider,
    productId: product.id,
    externalOrderId,
    shareToken,
    shareUrl: created.share_url || (shareToken ? `${base}/share/${encodeURIComponent(shareToken)}` : ""),
    status: created.status || "queued",
    submittedAt: new Date().toISOString(),
  };
}

export async function getSajuWebReport({ externalOrderId, env = process.env, fetchImpl = fetch } = {}) {
  const base = baseUrl(env);
  const key = apiKey(env);
  if (!base) throw new Error("SAJU_WEB_API_BASE_URL이 설정되지 않았습니다.");
  if (!key) throw new Error("SAJU_WEB_API_KEY가 설정되지 않았습니다.");
  if (!externalOrderId) throw new Error("외부 주문번호가 없습니다.");
  return requestJson(`${base}/api/v1/orders/${encodeURIComponent(externalOrderId)}/report`, { key, fetchImpl });
}

export function splitMarkdownReport(markdown) {
  const source = String(markdown || "").trim();
  if (!source) return [];
  const matches = [...source.matchAll(/^##\s+(.+)$/gm)];
  if (!matches.length) return [{ icon: "🔮", title: "리포트 본문", body: source }];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    return {
      icon: "🔮",
      title: match[1].trim(),
      body: source.slice(start, end).trim(),
    };
  }).filter((section) => section.title || section.body);
}
