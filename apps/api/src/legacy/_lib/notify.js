// 문자(SMS) 발송 — Solapi. 알림은 best-effort: 실패해도 본 처리(충전 등)는 계속되고
// 결과만 { ok, error }로 돌려준다. 절대 throw하지 않는다.
// 인증: HMAC-SHA256 apiKey=.., date=<ISO>, salt=<hex>, signature=HMAC(secret, date+salt)
// 발송: POST {base}/messages/v4/send-many/detail  body { messages: [{ to, from, text }] }
// 참고: https://solapi.com/developers (알림톡 전환 시 kakaoOptions만 추가하면 됨)
import { createHmac, randomBytes } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.solapi.com";
const DEFAULT_TIMEOUT_MS = 10000;

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidKoreanMobile(value) {
  return /^01[016789]\d{7,8}$/.test(normalizePhone(value));
}

export function solapiConfiguration(env = process.env) {
  const apiKey = String(env.SOLAPI_API_KEY || "").trim();
  const apiSecret = String(env.SOLAPI_API_SECRET || "").trim();
  const sender = normalizePhone(env.SOLAPI_SENDER || "");
  return { hasKey: Boolean(apiKey && apiSecret), sender, ready: Boolean(apiKey && apiSecret && sender) };
}

export function solapiAuthHeader({ apiKey, apiSecret, date = new Date().toISOString(), salt = randomBytes(16).toString("hex") }) {
  const signature = createHmac("sha256", apiSecret).update(`${date}${salt}`).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendSms({ to, text, env = process.env, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const apiKey = String(env.SOLAPI_API_KEY || "").trim();
  const apiSecret = String(env.SOLAPI_API_SECRET || "").trim();
  const from = normalizePhone(env.SOLAPI_SENDER || "");
  const recipient = normalizePhone(to);
  if (!apiKey || !apiSecret) return { ok: false, error: "SOLAPI_API_KEY/SOLAPI_API_SECRET이 설정되지 않았습니다." };
  if (!from) return { ok: false, error: "SOLAPI_SENDER(사전 등록된 발신번호)가 설정되지 않았습니다." };
  if (!isValidKoreanMobile(recipient)) return { ok: false, error: "수신 휴대폰 번호가 올바르지 않습니다." };
  const body = String(text || "").trim();
  if (!body) return { ok: false, error: "문자 내용이 비어 있습니다." };

  const base = String(env.SOLAPI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${base}/messages/v4/send-many/detail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: solapiAuthHeader({ apiKey, apiSecret }),
      },
      body: JSON.stringify({ messages: [{ to: recipient, from, text: body }] }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.errorMessage || payload?.message || `Solapi 발송 실패(${response.status})`;
      console.error(`[notify] SMS 발송 실패: ${String(message).slice(0, 200)}`);
      return { ok: false, error: String(message) };
    }
    const failed = Number(payload?.groupInfo?.count?.registeredFailed || 0);
    if (failed > 0) {
      const reason = payload?.failedMessageList?.[0]?.statusMessage || "발송 등록 실패";
      console.error(`[notify] SMS 등록 실패: ${String(reason).slice(0, 200)}`);
      return { ok: false, error: String(reason) };
    }
    return { ok: true, groupId: payload?.groupInfo?._id || payload?.groupId || null };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Solapi 응답 지연(타임아웃)" : String(error?.message || error);
    console.error(`[notify] SMS 발송 오류: ${message.slice(0, 200)}`);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
