// AI 프로바이더 폴백 (opencode-go 1순위 → openrouter 2순위) 회귀 테스트
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  parseOpenCodeMonthlyLimit,
  requestText,
  requestStructured,
  resolveAiRouting,
} from "../apps/api/src/legacy/_lib/aiTransport.js";
import { loadChatRunContext } from "../apps/api/src/domain/chatRepository.js";

const adminHtml = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260710150000_ai_routing.sql", import.meta.url), "utf8");

const ROUTED_CONFIG = {
  ai_routing: {
    primary: "opencode",
    opencode: { report_model: "glm-5.2", chat_model: "deepseek-v4-flash" },
    openrouter: {
      api_key: "sk-or-test",
      report_model: "anthropic/claude-sonnet-4.5",
      report_provider: "anthropic",
      chat_model: "deepseek/deepseek-chat-v3-0324",
      chat_provider: "deepseek",
    },
  },
};

test("resolveAiRouting — opencode 1순위, openrouter 폴백 체인을 만든다", () => {
  assert.deepEqual(resolveAiRouting(ROUTED_CONFIG, "report"), [
    { provider: "opencode", model: "glm-5.2" },
    { provider: "openrouter", model: "anthropic/claude-sonnet-4.5", providerPin: "anthropic", apiKey: "sk-or-test" },
    // 핀 고정 실패(엔드포인트 제외·프로바이더 429)가 openrouter 전체 실패가 되지 않게 auto 시도 추가
    { provider: "openrouter", model: "anthropic/claude-sonnet-4.5", providerPin: "", apiKey: "sk-or-test" },
  ]);
  assert.deepEqual(resolveAiRouting(ROUTED_CONFIG, "chat")[1], {
    provider: "openrouter",
    model: "deepseek/deepseek-chat-v3-0324",
    providerPin: "deepseek",
    apiKey: "sk-or-test",
  });
});

test("resolveAiRouting — openrouter 미설정이면 opencode 단독, 레거시 모델 승계", () => {
  const routes = resolveAiRouting({ ai_model: "kimi-k2.7-code", chat_model: "" }, "report");
  assert.deepEqual(routes, [{ provider: "opencode", model: "kimi-k2.7-code" }]);
  const chatRoutes = resolveAiRouting({ ai_model: "kimi-k2.7-code" }, "chat");
  assert.equal(chatRoutes[0].model, "kimi-k2.7-code"); // chat_model 없으면 ai_model 따름
});

test("resolveAiRouting — primary=openrouter면 순서가 뒤집힌다", () => {
  const routes = resolveAiRouting({
    ai_routing: { ...ROUTED_CONFIG.ai_routing, primary: "openrouter" },
  }, "report");
  assert.equal(routes[0].provider, "openrouter");
  assert.equal(routes[0].providerPin, "anthropic");
  assert.equal(routes[1].provider, "openrouter");
  assert.equal(routes[1].providerPin, ""); // 핀 해제(auto) 폴백
  assert.equal(routes[2].provider, "opencode");
});

test("resolveAiRouting — 저장된 OpenCode Go 쿨다운 상태를 폴백 경로에 포함한다", () => {
  const routes = resolveAiRouting({
    ai_routing: {
      ...ROUTED_CONFIG.ai_routing,
      primary: "openrouter",
      opencode: {
        ...ROUTED_CONFIG.ai_routing.opencode,
        cooldown_until: "2026-07-15T11:20:00.000Z",
        cooldown_reason: "monthly limit",
        cooldown_status: 429,
      },
    },
  }, "report");
  assert.deepEqual(routes.at(-1), {
    provider: "opencode",
    model: "glm-5.2",
    cooldownUntil: "2026-07-15T11:20:00.000Z",
    cooldownReason: "monthly limit",
    cooldownStatus: 429,
  });
});

test("OpenCode Go 월간 한도 응답에서 reset 기간을 쿨다운 만료시각으로 변환한다", () => {
  const now = Date.parse("2026-07-10T11:20:00.000Z");
  const error = Object.assign(new Error(
    "429 Monthly usage limit reached. Resets in 5 days. To continue: https://opencode.ai/workspace/example/go",
  ), { statusCode: 429 });
  const cooldown = parseOpenCodeMonthlyLimit(error, now);
  assert.deepEqual(cooldown, {
    blockedUntil: "2026-07-15T11:20:00.000Z",
    reason: "429 Monthly usage limit reached. Resets in 5 days. To continue:",
    statusCode: 429,
  });
  assert.equal(parseOpenCodeMonthlyLimit(Object.assign(new Error("burst limit"), { statusCode: 429 }), now), null);
});

test("requestStructured — OpenCode Go 쿨다운 중에는 폴백 호출을 생략하고 OpenRouter만 재시도한다", async () => {
  const attempts = [];
  const now = Date.parse("2026-07-10T11:20:00.000Z");
  await assert.rejects(
    requestStructured({
      model: [
        { provider: "openrouter", model: "deepseek/deepseek-v4-flash" },
        { provider: "opencode", model: "deepseek-v4-flash" },
      ],
      system: "s",
      input: "q",
      name: "t",
      schema: { type: "object" },
      maxAttempts: 3,
    }, {
      now: () => now,
      providerStatus: {
        get: async (provider) => provider === "opencode"
          ? { blockedUntil: "2026-07-15T11:20:00.000Z", statusCode: 429 }
          : null,
      },
      request: async ({ route }) => {
        attempts.push(route.provider);
        throw Object.assign(new Error("upstream timeout detail"), { statusCode: 504 });
      },
    }),
    (error) => error.code === "AI_PROVIDERS_UNAVAILABLE"
      && error.statusCode === 504
      && !error.message.includes("upstream timeout detail"),
  );
  assert.deepEqual(attempts, ["openrouter", "openrouter", "openrouter"]);
});

test("requestStructured — OpenCode Go 월간 한도는 한 번만 호출하고 만료시각을 저장한다", async () => {
  const attempts = [];
  const blocks = [];
  const result = await requestStructured({
    model: [
      { provider: "opencode", model: "deepseek-v4-flash" },
      { provider: "openrouter", model: "deepseek/deepseek-v4-flash" },
    ],
    system: "s",
    input: "q",
    name: "t",
    schema: { type: "object", required: ["body"], properties: { body: { type: "string" } } },
    maxAttempts: 3,
  }, {
    now: () => Date.parse("2026-07-10T11:20:00.000Z"),
    providerStatus: {
      get: async () => null,
      block: async (provider, cooldown) => blocks.push({ provider, cooldown }),
    },
    request: async ({ route }) => {
      attempts.push(route.provider);
      if (route.provider === "opencode") {
        throw Object.assign(new Error("429 Monthly usage limit reached. Resets in 5 days."), { statusCode: 429 });
      }
      return '{"body":"OpenRouter 응답"}';
    },
  });
  assert.deepEqual(result, { body: "OpenRouter 응답" });
  assert.deepEqual(attempts, ["opencode", "openrouter"]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].provider, "opencode");
  assert.equal(blocks[0].cooldown.blockedUntil, "2026-07-15T11:20:00.000Z");
});

test("requestText — 1순위 레이트리밋이면 2순위 프로바이더로 폴백하고 모델 라벨을 남긴다", async () => {
  const attempts = [];
  let resets = 0;
  const result = await requestText({
    model: resolveAiRouting(ROUTED_CONFIG, "chat"),
    system: "s",
    input: "q",
    onReset: () => { resets += 1; },
  }, {
    request: async (options) => {
      attempts.push(options.route.provider);
      if (options.route.provider === "opencode") {
        const error = new Error("rate limited");
        error.statusCode = 429;
        throw error;
      }
      assert.equal(options.route.providerPin, "deepseek");
      return { text: "폴백 답변", usage: {} };
    },
  });
  // opencode 재시도 1회 포함 2번 → openrouter 1번
  assert.deepEqual(attempts, ["opencode", "opencode", "openrouter"]);
  assert.equal(result.text, "폴백 답변");
  assert.equal(result.model, "openrouter:deepseek/deepseek-chat-v3-0324");
  assert.ok(resets >= 1); // 폴백 전 스트림 초안 리셋
});

test("requestStructured — 두 프로바이더 모두 실패하면 마지막 오류를 던진다", async () => {
  const attempts = [];
  await assert.rejects(
    requestStructured({
      model: resolveAiRouting(ROUTED_CONFIG, "report"),
      system: "s",
      input: "q",
      name: "t",
      schema: { type: "object" },
    }, {
      request: async (options) => {
        attempts.push(options.route.provider);
        const error = new Error(`${options.route.provider} down`);
        error.statusCode = 500;
        throw error;
      },
    }),
    (error) => error.code === "AI_PROVIDERS_UNAVAILABLE"
      && /일시적으로 지연/.test(error.message)
      && !error.message.includes("openrouter down"),
  );
  // opencode 2회 → openrouter(핀) 2회 → openrouter(auto) 2회
  assert.deepEqual(attempts, ["opencode", "opencode", "openrouter", "openrouter", "openrouter", "openrouter"]);
});

test("requestText — 문자열 model은 기존(오픈코드 단독) 동작 그대로", async () => {
  const result = await requestText({ model: "glm-5.2", system: "s", input: "q" }, {
    request: async (options) => {
      assert.equal(options.route.provider, "opencode");
      return { text: "ok", usage: {} };
    },
  });
  assert.equal(result.model, "glm-5.2");
});

test("관리자 화면 — 프로바이더 연결 테스트 버튼과 진단 엔드포인트가 있다", () => {
  const action = readFileSync(new URL("../apps/api/src/legacy/admin/[action].js", import.meta.url), "utf8");
  assert.match(adminHtml, /data-ai-test/);
  assert.match(admin, /\/api\/admin\/ai-test/);
  assert.match(action, /action === "ai-test"/);
  assert.match(action, /aiRoutingColumnVisible/);
  assert.match(action, /currentOpencode/); // 이전 관리자 화면 저장도 서버 쿨다운을 지우지 않음
});

test("관리자 화면 — AI 모델 탭 분리 + 프로바이더별 2모델 + 캐싱 안내", () => {
  assert.match(adminHtml, /data-admin-tab="ai"/);
  assert.match(adminHtml, /data-ai-routing-form/);
  assert.match(adminHtml, /or_report_provider/);
  assert.match(adminHtml, /or_chat_provider/);
  assert.match(adminHtml, /캐싱/);
  // 만세력 API 패널에서 모델 설정 분리됨
  assert.doesNotMatch(adminHtml, /data-model-form/);
  assert.doesNotMatch(adminHtml, /data-chat-model-form/);
  assert.match(admin, /saveAiRouting/);
  assert.match(admin, /ai_routing/);
  assert.match(admin, /serverConfig\.ai_routing\?\.opencode/); // 서버 쿨다운 상태 보존
});

// ai_routing 마이그레이션 전 DB(컬럼 없음)에서도 챗봇 컨텍스트 로드가 죽지 않아야 한다.
test("loadChatRunContext — ai_routing 컬럼이 없으면 라이트 셀렉트로 폴백한다", async () => {
  const messageCalls = { count: 0 };
  const resolved = (result) => {
    const chain = {
      select: () => chain, eq: () => chain, lt: () => chain, order: () => chain,
      maybeSingle: () => Promise.resolve(result),
      limit: () => Promise.resolve(result),
    };
    return chain;
  };
  const sb = {
    from(table) {
      if (table === "chat_runs") return resolved({ data: { id: "r1", session_id: "s1", user_message_id: "m1" } });
      if (table === "chat_sessions") return resolved({ data: { id: "s1", user_id: "u1", report_snapshot: {} } });
      if (table === "chat_messages") {
        messageCalls.count += 1;
        return messageCalls.count === 1
          ? resolved({ data: { id: "m1", content: "질문", created_at: "2026-07-10T00:00:00Z" } })
          : resolved({ data: [] });
      }
      if (table === "site_config") {
        return {
          select: (cols) => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(
                cols.includes("ai_routing")
                  ? { data: null, error: { message: "column site_config.ai_routing does not exist" } }
                  : { data: { ai_model: "glm-5.2", chat_model: "deepseek-v4-flash" } },
              ),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const context = await loadChatRunContext(sb, "r1");
  assert.equal(context.question, "질문");
  assert.deepEqual(context.model, [{ provider: "opencode", model: "deepseek-v4-flash" }]);
});

test("site_config에 ai_routing 컬럼이 추가된다", () => {
  assert.match(schema, /ai_routing jsonb/);
  assert.match(migration, /ai_routing jsonb/);
  assert.match(migration, /notify pgrst,\s*'reload schema'/i);
});
