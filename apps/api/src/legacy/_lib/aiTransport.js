import OpenAI from "openai";
import { getSupabase } from "./supabase.js";

const DEFAULT_MODEL = process.env.OPENCODE_MODEL || "glm-5.2";
const DEFAULT_BASE_URL = process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/go/v1";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const DEFAULT_PROFILE = Object.freeze({ transport: "chat", strictJson: true });
const MODEL_PROFILES = Object.freeze({
  "deepseek-v4-flash": Object.freeze({ transport: "chat", strictJson: false, thinking: Object.freeze({ type: "disabled" }) }),
  "minimax-m3": Object.freeze({ transport: "messages", strictJson: false }),
});
// OpenRouter는 OpenAI 호환 chat 엔드포인트만 사용. response_format json_schema는
// 모델마다 지원이 갈려서 프롬프트 JSON 강제(jsonOnlySystem) 방식으로 통일한다.
const OPENROUTER_PROFILE = Object.freeze({ transport: "chat", strictJson: false });
const providerCooldownCache = new Map();

export function modelProfile(model) {
  return MODEL_PROFILES[model] || DEFAULT_PROFILE;
}

// ── 프로바이더 라우팅 ──────────────────────────────────
// 1순위 opencode-go → 실패(레이트리밋·5xx·타임아웃·키 미설정 등) 시 2순위 openrouter 자동 폴백.
// route = { provider: "opencode"|"openrouter", model, providerPin?, apiKey? }

function routeProfile(route) {
  return route.provider === "openrouter" ? OPENROUTER_PROFILE : modelProfile(route.model);
}

function providerClientConfig(route) {
  if (route.provider === "openrouter") {
    const key = route.apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      const error = new Error("OpenRouter 키가 설정되지 않았습니다 (관리자 설정 또는 OPENROUTER_API_KEY).");
      error.statusCode = 503;
      throw error;
    }
    return {
      baseURL: OPENROUTER_BASE_URL,
      apiKey: key,
      defaultHeaders: { "HTTP-Referer": "https://www.saju-unboxing.com", "X-Title": "saju-unboxing" },
    };
  }
  return { baseURL: DEFAULT_BASE_URL, apiKey: apiKey() };
}

// OpenRouter 전용 요청 필드 — 프로바이더 지정 시 캐싱 히트를 위해 고정(폴백 비활성).
function applyRouteRequestOptions(request, route) {
  if (route.provider !== "openrouter" || !route.providerPin) return request;
  return { ...request, provider: { order: [route.providerPin], allow_fallbacks: false } };
}

function routeLabel(route) {
  return route.provider === "openrouter" ? `openrouter:${route.model}` : route.model;
}

// options.model 이 문자열이면 기존(오픈코드 단독) 동작, resolveAiRouting 결과(배열)면 폴백 체인.
function toRoutes(modelOption) {
  if (Array.isArray(modelOption) && modelOption.length) return modelOption;
  const model = typeof modelOption === "string" && modelOption ? modelOption : DEFAULT_MODEL;
  return [{ provider: "opencode", model }];
}

function nowMs(dependencies = {}) {
  if (typeof dependencies.now === "function") return Number(dependencies.now());
  const value = Number(dependencies.now);
  return Number.isFinite(value) ? value : Date.now();
}

function activeCooldown(value, currentTime = Date.now()) {
  const blockedUntilMs = Date.parse(String(value?.blockedUntil || value?.cooldown_until || ""));
  if (!Number.isFinite(blockedUntilMs) || blockedUntilMs <= currentTime) return null;
  return {
    blockedUntil: new Date(blockedUntilMs).toISOString(),
    reason: String(value?.reason || value?.cooldown_reason || ""),
    statusCode: Number(value?.statusCode || value?.cooldown_status || 429),
  };
}

export function parseOpenCodeMonthlyLimit(error, currentTime = Date.now()) {
  const status = Number(error?.statusCode || error?.status || 0);
  const message = String(error?.message || "");
  if (status !== 429 || !/monthly usage limit reached/i.test(message)) return null;
  const match = /resets?\s+in\s+(\d+(?:\.\d+)?)\s*(minutes?|hours?|days?|weeks?)/i.exec(message);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitMs = unit.startsWith("minute")
    ? 60_000
    : unit.startsWith("hour")
      ? 3_600_000
      : unit.startsWith("week")
        ? 7 * 86_400_000
        : 86_400_000;
  const blockedUntilMs = Number(currentTime) + Math.ceil(amount * unitMs);
  if (!Number.isFinite(blockedUntilMs)) return null;
  return {
    blockedUntil: new Date(blockedUntilMs).toISOString(),
    reason: message.replace(/https?:\/\/\S+/gi, "").trim().slice(0, 240),
    statusCode: 429,
  };
}

async function storedProviderCooldown(provider, dependencies = {}) {
  if (provider !== "opencode") return null;
  const currentTime = nowMs(dependencies);
  const cached = providerCooldownCache.get(provider);
  if (cached) {
    const active = activeCooldown(cached.value, currentTime);
    if (active) return active;
    providerCooldownCache.delete(provider);
  }

  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("site_config").select("ai_routing").eq("id", 1).maybeSingle();
    if (error) throw error;
    const value = activeCooldown(data?.ai_routing?.[provider], currentTime);
    if (value) providerCooldownCache.set(provider, { value });
    return value;
  } catch (error) {
    console.error(`[ai-circuit] ${provider} 상태 조회 실패: ${String(error?.message || error).slice(0, 160)}`);
    return null;
  }
}

async function persistProviderCooldown(provider, cooldown) {
  providerCooldownCache.set(provider, {
    value: cooldown,
  });
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data, error: readError } = await sb.from("site_config").select("ai_routing").eq("id", 1).maybeSingle();
    if (readError) throw readError;
    const routing = data?.ai_routing || {};
    const current = routing[provider] || {};
    const currentUntil = Date.parse(String(current.cooldown_until || ""));
    const nextUntil = Math.max(Number.isFinite(currentUntil) ? currentUntil : 0, Date.parse(cooldown.blockedUntil));
    const nextRouting = {
      ...routing,
      [provider]: {
        ...current,
        cooldown_until: new Date(nextUntil).toISOString(),
        cooldown_reason: cooldown.reason,
        cooldown_status: cooldown.statusCode,
      },
    };
    const { error: updateError } = await sb
      .from("site_config")
      .update({ ai_routing: nextRouting, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`[ai-circuit] ${provider} 쿨다운 저장 실패: ${String(error?.message || error).slice(0, 160)}`);
  }
}

const defaultProviderStatus = Object.freeze({
  get: storedProviderCooldown,
  block: persistProviderCooldown,
});

async function routeCooldown(route, dependencies = {}) {
  if (route.provider !== "opencode") return null;
  const currentTime = nowMs(dependencies);
  const configured = activeCooldown({
    blockedUntil: route.cooldownUntil,
    reason: route.cooldownReason,
    statusCode: route.cooldownStatus,
  }, currentTime);
  if (configured) return configured;
  const store = dependencies.providerStatus || defaultProviderStatus;
  return store.get ? store.get(route.provider, { now: currentTime }) : null;
}

async function blockForMonthlyLimit(route, error, dependencies = {}) {
  if (route.provider !== "opencode") return null;
  const cooldown = parseOpenCodeMonthlyLimit(error, nowMs(dependencies));
  if (!cooldown) return null;
  const store = dependencies.providerStatus || defaultProviderStatus;
  if (store.block) await store.block(route.provider, cooldown);
  console.error(`[ai-circuit] opencode 월간 한도 감지 · ${cooldown.blockedUntil}까지 호출 차단`);
  return cooldown;
}

function retryAfterMs(error, attempt, baseMs = 250) {
  const headers = error?.headers;
  const getHeader = (name) => {
    if (typeof headers?.get === "function") return headers.get(name);
    return headers?.[name] ?? headers?.[name.toLowerCase()];
  };
  const retryAfterMsHeader = Number(getHeader("retry-after-ms"));
  if (Number.isFinite(retryAfterMsHeader) && retryAfterMsHeader > 0) return Math.min(retryAfterMsHeader, 5_000);
  const retryAfter = getHeader("retry-after");
  if (retryAfter !== undefined && retryAfter !== null && retryAfter !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 5_000);
    const at = Date.parse(String(retryAfter));
    if (Number.isFinite(at)) return Math.max(0, Math.min(at - Date.now(), 5_000));
  }
  return Math.min(Math.max(0, Number(baseMs) || 250) * (2 ** attempt), 2_000);
}

async function waitBeforeRetry(error, attempt, options, dependencies) {
  // 주입 request를 쓰는 단위 테스트는 실제 대기하지 않는다. 운영 전송에서만 짧게 백오프한다.
  if (dependencies.request && !dependencies.sleep) return;
  const sleep = dependencies.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  await sleep(retryAfterMs(error, attempt, options.retryBaseMs));
}

function providerExhaustedError(lastError) {
  const error = new Error("AI 해설 생성이 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
  error.statusCode = Number(lastError?.statusCode || lastError?.status) === 504 ? 504 : 503;
  error.code = "AI_PROVIDERS_UNAVAILABLE";
  error.cause = lastError;
  return error;
}

// site_config → 우선순위 라우팅 체인. kind: "report"(AI해설) | "chat"(챗봇상담)
export function resolveAiRouting(config = {}, kind = "report") {
  const routing = config.ai_routing || {};
  const oc = routing.opencode || {};
  const or = routing.openrouter || {};
  const legacyModel = kind === "chat"
    ? (config.chat_model || config.ai_model || process.env.CHAT_MODEL || process.env.OPENCODE_MODEL || "deepseek-v4-flash")
    : (config.ai_model || DEFAULT_MODEL);
  const opencodeRoute = {
    provider: "opencode",
    model: (kind === "chat" ? oc.chat_model : oc.report_model) || legacyModel,
  };
  if (oc.cooldown_until) {
    opencodeRoute.cooldownUntil = String(oc.cooldown_until);
    opencodeRoute.cooldownReason = String(oc.cooldown_reason || "");
    opencodeRoute.cooldownStatus = Number(oc.cooldown_status || 429);
  }
  const orModel = kind === "chat" ? (or.chat_model || or.report_model) : or.report_model;
  const orKey = or.api_key || process.env.OPENROUTER_API_KEY || "";
  const openrouterRoutes = [];
  if (orModel && orKey) {
    const providerPin = String((kind === "chat" ? or.chat_provider : or.report_provider) || "").trim();
    const base = { provider: "openrouter", model: orModel, providerPin, apiKey: or.api_key || "" };
    openrouterRoutes.push(base);
    // 핀 고정 실패(계정 정책으로 해당 엔드포인트 제외, 프로바이더 순간 장애 등)가
    // openrouter 전체 실패가 되지 않도록 핀 없는(auto) 시도를 한 단계 더 둔다.
    if (providerPin) openrouterRoutes.push({ ...base, providerPin: "" });
  }
  if (routing.primary === "openrouter" && openrouterRoutes.length) return [...openrouterRoutes, opencodeRoute];
  return [opencodeRoute, ...openrouterRoutes];
}

export function chatMessageText(message = {}) {
  return String(message.content || "");
}

export function chatDeltaText(delta = {}) {
  return String(delta.content || "");
}

export function applyChatModelOptions(request, profile = {}) {
  if (!profile?.thinking) return request;
  return { ...request, thinking: profile.thinking };
}

export function extractJsonObject(text) {
  const clean = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("AI 응답에 JSON 객체가 없습니다.");
  }
  return JSON.parse(clean.slice(start, end + 1));
}

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

export function validateSchema(value, schema, path = "$") {
  if (!schema || typeof schema !== "object") return value;

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    fail(path, `허용되지 않은 값 ${JSON.stringify(value)}`);
  }

  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(path, "객체가 필요합니다.");
    }
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        fail(`${path}.${key}`, "필수 값이 없습니다.");
      }
    }
    const properties = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          fail(`${path}.${key}`, "허용되지 않은 필드입니다.");
        }
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateSchema(value[key], childSchema, `${path}.${key}`);
      }
    }
    return value;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) fail(path, "배열이 필요합니다.");
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(path, `항목이 최소 ${schema.minItems}개 필요합니다.`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      fail(path, `항목은 최대 ${schema.maxItems}개입니다.`);
    }
    value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`));
    return value;
  }

  if (schema.type === "string" && typeof value !== "string") {
    fail(path, "문자열이 필요합니다.");
  }
  if (schema.type === "integer" && !Number.isInteger(value)) {
    fail(path, "정수가 필요합니다.");
  }
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    fail(path, "숫자가 필요합니다.");
  }
  return value;
}

function apiKey() {
  const value = process.env.OPENCODE_API_KEY;
  if (value) return value;
  const error = new Error("OpenCode 키가 설정되지 않았습니다 (OPENCODE_API_KEY).");
  error.statusCode = 503;
  throw error;
}

function jsonOnlySystem(system, schema) {
  return `${system}\n\n[출력 형식]\n설명이나 마크다운 없이 아래 JSON Schema를 만족하는 JSON 객체 하나만 출력한다.\n${JSON.stringify(schema)}`;
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 70000));
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function normalizeTransportError(error) {
  if (error?.name !== "AbortError") return error;
  const timeout = new Error("AI 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
  timeout.statusCode = 504;
  timeout.retryable = true;
  return timeout;
}

function isRetryableTransport(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  return error?.retryable === true || status === 429 || status >= 500;
}

async function requestChat({ route, system, input, name, schema, profile, maxTokens = 8192, timeoutMs = 70000 }) {
  const client = new OpenAI(providerClientConfig(route));
  const request = applyRouteRequestOptions(applyChatModelOptions({
    model: route.model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: profile.strictJson ? system : jsonOnlySystem(system, schema) },
      { role: "user", content: input },
    ],
  }, profile), route);
  if (profile.strictJson) {
    request.response_format = {
      type: "json_schema",
      json_schema: { name, strict: true, schema },
    };
  }
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await client.chat.completions.create(request, { signal: timeout.signal });
    const text = chatMessageText(response.choices?.[0]?.message);
    if (!text) throw new Error("AI 응답이 비어 있습니다.");
    return text;
  } catch (error) {
    throw normalizeTransportError(timeout.signal.aborted ? Object.assign(error, { name: "AbortError" }) : error);
  } finally {
    timeout.clear();
  }
}

async function requestMessages({ route, system, input, schema, maxTokens = 8192, timeoutMs = 70000 }) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(`${DEFAULT_BASE_URL.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
        "anthropic-version": "2023-06-01",
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: route.model,
        max_tokens: maxTokens,
        system: jsonOnlySystem(system, schema),
        messages: [{ role: "user", content: input }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.message || `OpenCode 요청 실패 (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }
    const text = Array.isArray(payload.content)
      ? payload.content.filter((part) => part?.type === "text").map((part) => part.text).join("\n")
      : "";
    if (!text) throw new Error("AI 응답이 비어 있습니다.");
    return text;
  } catch (error) {
    throw normalizeTransportError(timeout.signal.aborted ? Object.assign(error, { name: "AbortError" }) : error);
  } finally {
    timeout.clear();
  }
}

function normalizeUsage(usage = {}) {
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0);
  return {
    promptTokens,
    completionTokens,
    totalTokens: Number(usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens),
  };
}

async function requestPlainChat({ route, system, input, profile = routeProfile(route), maxTokens = 1600, timeoutMs = 70000, onDelta }) {
  const client = new OpenAI(providerClientConfig(route));
  const request = applyRouteRequestOptions(applyChatModelOptions({
    model: route.model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
  }, profile), route);
  const timeout = timeoutSignal(timeoutMs);
  try {
    if (onDelta) {
      const stream = await client.chat.completions.create({
        ...request,
        stream: true,
        stream_options: { include_usage: true },
      }, { signal: timeout.signal });
      let text = "";
      let usage = {};
      for await (const chunk of stream) {
        const delta = chatDeltaText(chunk.choices?.[0]?.delta);
        if (delta) {
          text += delta;
          await onDelta(delta);
        }
        if (chunk.usage) usage = chunk.usage;
      }
      if (!text) throw new Error("AI 응답이 비어 있습니다.");
      return { text, usage: normalizeUsage(usage) };
    }
    const response = await client.chat.completions.create(request, { signal: timeout.signal });
    const text = chatMessageText(response.choices?.[0]?.message);
    if (!text) throw new Error("AI 응답이 비어 있습니다.");
    return { text, usage: normalizeUsage(response.usage) };
  } catch (error) {
    throw normalizeTransportError(timeout.signal.aborted ? Object.assign(error, { name: "AbortError" }) : error);
  } finally {
    timeout.clear();
  }
}

async function requestPlainMessages({ route, system, input, maxTokens = 1600, timeoutMs = 70000, onDelta }) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(`${DEFAULT_BASE_URL.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
        "anthropic-version": "2023-06-01",
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: route.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: input }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.message || `OpenCode 요청 실패 (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }
    const text = Array.isArray(payload.content)
      ? payload.content.filter((part) => part?.type === "text").map((part) => part.text).join("\n")
      : "";
    if (!text) throw new Error("AI 응답이 비어 있습니다.");
    if (onDelta) await onDelta(text);
    return { text, usage: normalizeUsage(payload.usage) };
  } catch (error) {
    throw normalizeTransportError(timeout.signal.aborted ? Object.assign(error, { name: "AbortError" }) : error);
  } finally {
    timeout.clear();
  }
}

export async function requestText(options, dependencies = {}) {
  const routes = toRoutes(options.model);
  let lastError;
  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex];
    const cooldown = await routeCooldown(route, dependencies);
    if (cooldown) {
      console.error(`[ai-circuit] ${routeLabel(route)} 건너뜀 · ${cooldown.blockedUntil}까지 차단`);
      continue;
    }
    const profile = routeProfile(route);
    const request = dependencies.request || (profile.transport === "messages" ? requestPlainMessages : requestPlainChat);
    const requestOptions = { ...options, route, model: route.model, profile };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await request(requestOptions);
        const result = typeof response === "string" ? { text: response, usage: {} } : response;
        if (!String(result?.text || "").trim()) throw new Error("AI 응답이 비어 있습니다.");
        return { text: result.text, usage: normalizeUsage(result.usage), model: routeLabel(route) };
      } catch (error) {
        lastError = normalizeTransportError(error);
        // Vercel 함수 로그에서 폴백 여부를 추적할 수 있게 프로바이더별 실패를 남긴다.
        console.error(`[ai-fallback] ${routeLabel(route)} 실패 (${lastError.statusCode || lastError.status || "-"}): ${String(lastError.message || "").slice(0, 200)}`);
        const monthlyLimit = await blockForMonthlyLimit(route, lastError, dependencies);
        if (monthlyLimit) {
          if (options.onReset) await options.onReset();
          break;
        }
        // 같은 프로바이더 1회 재시도(재시도 가능 오류) → 소진하면 다음 프로바이더로 폴백
        const hasNextAttempt = attempt === 0 && isRetryableTransport(lastError);
        const hasNextRoute = routeIndex + 1 < routes.length;
        if (!hasNextAttempt && !hasNextRoute) break;
        if (options.onReset) await options.onReset();
        if (!hasNextAttempt) break;
        await waitBeforeRetry(lastError, attempt, options, dependencies);
      }
    }
  }
  throw providerExhaustedError(lastError);
}

export async function requestStructured(options, dependencies = {}) {
  const routes = toRoutes(options.model);
  let lastError;
  const maxAttempts = Math.max(1, Math.min(3, Number(options.maxAttempts) || 2));
  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex];
    const cooldown = await routeCooldown(route, dependencies);
    if (cooldown) {
      console.error(`[ai-circuit] ${routeLabel(route)} 건너뜀 · ${cooldown.blockedUntil}까지 차단`);
      continue;
    }
    const profile = routeProfile(route);
    const request = dependencies.request || (profile.transport === "messages" ? requestMessages : requestChat);
    const requestOptions = { ...options, route, model: route.model, profile };
    const routeAttempts = route.provider === "openrouter" ? maxAttempts : Math.min(2, maxAttempts);
    for (let attempt = 0; attempt < routeAttempts; attempt += 1) {
      let text;
      try {
        text = await request(requestOptions);
      } catch (error) {
        lastError = normalizeTransportError(error);
        console.error(`[ai-fallback] ${routeLabel(route)} 실패 (${lastError.statusCode || lastError.status || "-"}): ${String(lastError.message || "").slice(0, 200)}`);
        const monthlyLimit = await blockForMonthlyLimit(route, lastError, dependencies);
        if (monthlyLimit) break;
        if (attempt + 1 < routeAttempts && isRetryableTransport(lastError)) {
          await waitBeforeRetry(lastError, attempt, options, dependencies);
          continue;
        }
        break; // 이 프로바이더 포기 → 다음 프로바이더 폴백
      }
      try {
        const value = extractJsonObject(text);
        validateSchema(value, options.schema);
        return value;
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw providerExhaustedError(lastError);
}
