import OpenAI from "openai";

const DEFAULT_MODEL = process.env.OPENCODE_MODEL || "glm-5.2";
const DEFAULT_BASE_URL = process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/go/v1";
const DEFAULT_PROFILE = Object.freeze({ transport: "chat", strictJson: true });
const MODEL_PROFILES = Object.freeze({
  "deepseek-v4-flash": Object.freeze({ transport: "chat", strictJson: false }),
  "minimax-m3": Object.freeze({ transport: "messages", strictJson: false }),
});

export function modelProfile(model) {
  return MODEL_PROFILES[model] || DEFAULT_PROFILE;
}

export function chatMessageText(message = {}) {
  return String(message.content || "");
}

export function chatDeltaText(delta = {}) {
  return String(delta.content || "");
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

async function requestChat({ model, system, input, name, schema, profile, maxTokens = 8192, timeoutMs = 70000 }) {
  const client = new OpenAI({ apiKey: apiKey(), baseURL: DEFAULT_BASE_URL });
  const request = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: profile.strictJson ? system : jsonOnlySystem(system, schema) },
      { role: "user", content: input },
    ],
  };
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

async function requestMessages({ model, system, input, schema, maxTokens = 8192, timeoutMs = 70000 }) {
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
        model,
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

async function requestPlainChat({ model, system, input, maxTokens = 1600, timeoutMs = 70000, onDelta }) {
  const client = new OpenAI({ apiKey: apiKey(), baseURL: DEFAULT_BASE_URL });
  const request = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
  };
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

async function requestPlainMessages({ model, system, input, maxTokens = 1600, timeoutMs = 70000, onDelta }) {
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
        model,
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
  const model = options.model || DEFAULT_MODEL;
  const profile = modelProfile(model);
  const request = dependencies.request || (profile.transport === "messages" ? requestPlainMessages : requestPlainChat);
  const requestOptions = { ...options, model, profile };
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request(requestOptions);
      const result = typeof response === "string" ? { text: response, usage: {} } : response;
      if (!String(result?.text || "").trim()) throw new Error("AI 응답이 비어 있습니다.");
      return { text: result.text, usage: normalizeUsage(result.usage), model };
    } catch (error) {
      lastError = normalizeTransportError(error);
      if (attempt === 0 && isRetryableTransport(lastError)) {
        if (options.onReset) await options.onReset();
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

export async function requestStructured(options, dependencies = {}) {
  const model = options.model || DEFAULT_MODEL;
  const profile = modelProfile(model);
  const request = dependencies.request || (profile.transport === "messages" ? requestMessages : requestChat);
  const requestOptions = { ...options, model, profile };

  let lastError;
  const maxAttempts = Math.max(1, Math.min(2, Number(options.maxAttempts) || 2));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let text;
    try {
      text = await request(requestOptions);
    } catch (error) {
      lastError = normalizeTransportError(error);
      if (attempt + 1 < maxAttempts && isRetryableTransport(lastError)) continue;
      throw lastError;
    }
    try {
      const value = extractJsonObject(text);
      validateSchema(value, options.schema);
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
