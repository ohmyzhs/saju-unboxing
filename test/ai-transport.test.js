import test from "node:test";
import assert from "node:assert/strict";

import {
  extractJsonObject,
  modelProfile,
  requestStructured,
  validateSchema,
} from "../api/_lib/aiTransport.js";

test("routes DeepSeek to chat completions without strict schema", () => {
  assert.deepEqual(modelProfile("deepseek-v4-flash"), {
    transport: "chat",
    strictJson: false,
  });
});

test("routes MiniMax to messages without strict schema", () => {
  assert.deepEqual(modelProfile("minimax-m3"), {
    transport: "messages",
    strictJson: false,
  });
});

test("keeps existing and unknown models on strict chat completions", () => {
  assert.deepEqual(modelProfile("glm-5.2"), {
    transport: "chat",
    strictJson: true,
  });
  assert.deepEqual(modelProfile("saved-custom-model"), {
    transport: "chat",
    strictJson: true,
  });
});

test("extracts fenced JSON and validates required fields", () => {
  const value = extractJsonObject('```json\n{"body":"본문"}\n```');
  assert.deepEqual(value, { body: "본문" });
  assert.doesNotThrow(() => validateSchema(value, {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: { body: { type: "string" } },
  }));
});

test("validates array length, enum, and integer constraints", () => {
  const schema = {
    type: "object",
    required: ["score", "items"],
    properties: {
      score: { type: "integer" },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: { type: "string", enum: ["a", "b"] },
      },
    },
  };
  assert.doesNotThrow(() => validateSchema({ score: 1, items: ["a"] }, schema));
  assert.throws(() => validateSchema({ score: 1.5, items: ["a"] }, schema), /score/);
  assert.throws(() => validateSchema({ score: 1, items: ["c"] }, schema), /items/);
});

test("rejects malformed JSON and invalid required fields", () => {
  assert.throws(() => extractJsonObject("not json"), /JSON/);
  assert.throws(() => validateSchema({}, {
    type: "object",
    required: ["body"],
    properties: { body: { type: "string" } },
  }), /body/);
});

test("retries one invalid structured response and returns validated data", async () => {
  let attempts = 0;
  const value = await requestStructured({
    model: "minimax-m3",
    system: "system",
    input: "input",
    name: "section",
    schema: {
      type: "object",
      required: ["body"],
      properties: { body: { type: "string" } },
    },
  }, {
    request: async ({ profile }) => {
      attempts += 1;
      assert.equal(profile.transport, "messages");
      return attempts === 1 ? "invalid" : '{"body":"정상"}';
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(value, { body: "정상" });
});

test("does not retry transport failures", async () => {
  let attempts = 0;
  await assert.rejects(
    requestStructured({
      model: "deepseek-v4-flash",
      system: "system",
      input: "input",
      name: "section",
      schema: { type: "object", properties: {} },
    }, {
      request: async () => {
        attempts += 1;
        throw new Error("network down");
      },
    }),
    /network down/,
  );
  assert.equal(attempts, 1);
});

test("retries one retryable transport failure", async () => {
  let attempts = 0;
  const value = await requestStructured({
    model: "deepseek-v4-flash",
    system: "system",
    input: "input",
    name: "section",
    maxTokens: 2048,
    timeoutMs: 1234,
    schema: {
      type: "object",
      required: ["body"],
      properties: { body: { type: "string" } },
    },
  }, {
    request: async ({ maxTokens, timeoutMs }) => {
      attempts += 1;
      assert.equal(maxTokens, 2048);
      assert.equal(timeoutMs, 1234);
      if (attempts === 1) {
        throw Object.assign(new Error("provider busy"), { statusCode: 503 });
      }
      return '{"body":"정상"}';
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(value, { body: "정상" });
});

test("converts repeated aborts into a Korean 504 timeout", async () => {
  let attempts = 0;
  await assert.rejects(
    requestStructured({
      model: "deepseek-v4-flash",
      system: "system",
      input: "input",
      name: "section",
      schema: { type: "object", properties: {} },
    }, {
      request: async () => {
        attempts += 1;
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
    }),
    (error) => error.statusCode === 504 && /시간이 초과/.test(error.message),
  );
  assert.equal(attempts, 2);
});
