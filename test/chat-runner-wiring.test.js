// 챗 실행기 배선·내구 복구 회귀 방지.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveRoute } from "../apps/api/src/gateway.js";
import {
  resumeStuckChatRuns,
  startChatRecovery,
  startReportChatRun,
} from "../apps/api/src/workflows/chatExecution.js";

test("Hobby 배포는 waitUntil 의존성을 포함하고 분 단위 Vercel Cron을 등록하지 않는다", async () => {
  const apiPackage = JSON.parse(await readFile(new URL("../apps/api/package.json", import.meta.url), "utf8"));
  const vercelConfig = JSON.parse(await readFile(new URL("../apps/api/vercel.json", import.meta.url), "utf8"));
  assert.equal(typeof apiPackage.dependencies["@vercel/functions"], "string");
  assert.equal(vercelConfig.crons, undefined);
});

test("gateway routes the cron sweep path", () => {
  assert.deepEqual(resolveRoute("/api/internal/chat-sweep"), { name: "chat-sweep" });
});

test("startReportChatRun triggers execution in background without blocking", async () => {
  let started = false;
  startReportChatRun("rid", { execute: async () => { started = true; }, keepAlive: () => {} });
  assert.equal(started, false); // 동기 반환 — POST 가 202 를 즉시 돌려줄 수 있다
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(started, true); // 백그라운드에서 실행됨
});

test("startChatRecovery keeps stale-run recovery alive without blocking the request", async () => {
  let recovered = false;
  let keptAlive = false;
  startChatRecovery({}, {
    resume: async () => { recovered = true; },
    keepAlive: () => { keptAlive = true; },
  });
  assert.equal(recovered, false);
  assert.equal(keptAlive, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(recovered, true);
});

test("resumeStuckChatRuns resumes queued and stale-running, skips fresh", async () => {
  const now = Date.parse("2026-06-22T00:10:00Z");
  const rows = [
    { id: "queued", status: "queued", attempt_count: 0, started_at: null, session_id: "s" },
    { id: "stale", status: "running", attempt_count: 1, started_at: "2026-06-22T00:00:00Z", session_id: "s" },
    { id: "fresh", status: "running", attempt_count: 1, started_at: "2026-06-22T00:09:40Z", session_id: "s" },
  ];
  const sb = {
    from() {
      const q = {
        select: () => q,
        in: () => q,
        order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }),
        update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      };
      return q;
    },
  };
  const executed = [];
  const result = await resumeStuckChatRuns(sb, { now: () => now, execute: async (id) => executed.push(id), fail: async () => {} });
  assert.deepEqual(executed.sort(), ["queued", "stale"]); // fresh(30초 전)는 제외
  assert.equal(result.resumed, 2);
});
