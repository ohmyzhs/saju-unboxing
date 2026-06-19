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

async function requestChat({ model, system, input, name, schema, profile }) {
  const client = new OpenAI({ apiKey: apiKey(), baseURL: DEFAULT_BASE_URL });
  const request = {
    model,
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
  const response = await client.chat.completions.create(request);
  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI 응답이 비어 있습니다.");
  return text;
}

async function requestMessages({ model, system, input, schema }) {
  const response = await fetch(`${DEFAULT_BASE_URL.replace(/\/+$/, "")}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
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
}

export async function requestStructured(options, dependencies = {}) {
  const model = options.model || DEFAULT_MODEL;
  const profile = modelProfile(model);
  const request = dependencies.request || (profile.transport === "messages" ? requestMessages : requestChat);
  const requestOptions = { ...options, model, profile };

  let text = await request(requestOptions);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const value = extractJsonObject(text);
      validateSchema(value, options.schema);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt === 0) text = await request(requestOptions);
    }
  }
  throw lastError;
}
