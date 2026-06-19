// 서버리스 함수 공용 HTTP 헬퍼 (Vercel Node 런타임 + `vercel dev` 양쪽 호환)

/** 요청 본문을 JSON으로 읽는다. Vercel이 이미 파싱한 req.body가 있으면 그대로 사용. */
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/** 쿠키 문자열 파싱 */
export function readCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name]) => name)
      .map(([name, ...rest]) => [name, decodeURIComponent(rest.join("="))]),
  );
}

export function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/** 현재 요청 기준 사이트 베이스 URL (프록시 헤더 → BASE_URL env 순) */
export function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return `${Array.isArray(proto) ? proto[0] : proto}://${host}`;
  return process.env.BASE_URL || "http://localhost:3000";
}

export function redirect(res, location, headers = {}) {
  res.statusCode = 302;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader("Location", location);
  res.end();
}

export function cookieSecure() {
  return String(process.env.BASE_URL || "").startsWith("https://");
}
