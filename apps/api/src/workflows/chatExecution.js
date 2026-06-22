import { waitUntil } from "@vercel/functions";
import { runReportAgent } from "../agent/chatAgent.js";
import {
  claimChatRun,
  completeChatRun,
  failChatRun,
  loadChatRunContext,
  persistChatDraft,
} from "../domain/chatRepository.js";
import { getSupabase } from "../legacy/_lib/supabase.js";

export function createDraftAccumulator({ persist, threshold = 300 }) {
  let content = "";
  let pending = "";
  async function flush() {
    if (!pending) return;
    const delta = pending;
    pending = "";
    await persist(content, delta);
  }
  return {
    async push(delta) {
      const value = String(delta || "");
      if (!value) return;
      content += value;
      pending += value;
      if (Array.from(pending).length >= threshold) await flush();
    },
    async flush() {
      await flush();
    },
    async reset() {
      content = "";
      pending = "";
      await persist("", "");
    },
    get content() {
      return content;
    },
  };
}

export async function executeChatRun(runId, dependencies = {}) {
  const sb = dependencies.sb || getSupabase();
  const claim = dependencies.claim || claimChatRun;
  const load = dependencies.load || loadChatRunContext;
  const persist = dependencies.persist || persistChatDraft;
  const complete = dependencies.complete || completeChatRun;
  const fail = dependencies.fail || failChatRun;
  const agent = dependencies.agent || runReportAgent;
  const claimed = await claim(sb, runId);
  if (!claimed.claimed) return { status: claimed.status, skipped: true };

  try {
    const context = await load(sb, runId);
    const draft = createDraftAccumulator({
      persist: (content, delta) => persist(sb, { runId, content, delta }),
    });
    const result = await agent({
      snapshot: context.snapshot,
      history: context.history,
      question: context.question,
      model: context.model,
      onDelta: (delta) => draft.push(delta),
      onReset: () => draft.reset(),
    });
    await draft.flush();
    await complete(sb, {
      runId,
      content: result.text,
      model: result.model || context.model,
      usage: result.usage || {},
    });
    return { status: "completed", runId, model: result.model || context.model, usage: result.usage || {} };
  } catch (error) {
    await fail(sb, {
      userId: claimed.userId,
      runId,
      code: "provider_error",
      message: error.message,
    }).catch(() => {});
    throw error;
  }
}

// Vercel 응답 후에도 실행을 함수 최대 실행시간까지 유지한다.
function keepAlive(promise) {
  waitUntil(promise);
}

// POST /messages 의 트리거. 즉시 반환(202 빠르게)하고 실행은 백그라운드로 돌린다.
// 응답 후 종료·배포로 실행이 끊겨도 sweeper 가 재개하므로 호출부는 await 해도 블로킹되지 않는다.
export function startReportChatRun(runId, deps = {}) {
  const execute = deps.execute || executeChatRun;
  const promise = Promise.resolve().then(() => execute(runId));
  promise.catch(() => {}); // 실패는 executeChatRun 내부 fail/refund + sweeper 재개
  (deps.keepAlive || keepAlive)(promise);
}

// Hobby 플랜에서는 분 단위 Cron을 쓸 수 없으므로, 사용자가 챗 화면을 다시 조회할 때
// 중단된 실행을 비동기로 복구한다. 정상 실행은 startReportChatRun의 waitUntil이 계속 유지한다.
export function startChatRecovery(sb, deps = {}) {
  const resume = deps.resume || resumeStuckChatRuns;
  const promise = Promise.resolve().then(() => resume(sb));
  promise.catch(() => {});
  (deps.keepAlive || keepAlive)(promise);
}

// 내구 실행 복구: 시작 못 한 queued, 또는 배포·타임아웃으로 끊긴 stale running run 을 재개한다.
// claim_chat_run 은 'queued' 만 청구하므로 stale running 은 queued 로 되돌린 뒤 재실행.
export async function resumeStuckChatRuns(sb, deps = {}) {
  if (!sb) return { scanned: 0, resumed: 0, failed: 0 };
  const staleMs = deps.staleMs ?? 120000;
  const maxAttempts = deps.maxAttempts ?? 3;
  const execute = deps.execute || executeChatRun;
  const fail = deps.fail || failChatRun;
  const nowMs = deps.now ? deps.now() : Date.now();
  const cutoff = new Date(nowMs - staleMs).toISOString();
  const { data: runs, error } = await sb
    .from("chat_runs")
    .select("id, status, attempt_count, started_at, session_id")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (error || !runs?.length) return { scanned: runs?.length || 0, resumed: 0, failed: 0 };
  let resumed = 0;
  let failed = 0;
  for (const run of runs) {
    const stale = run.status === "queued" || (run.started_at && run.started_at < cutoff);
    if (!stale) continue;
    if (Number(run.attempt_count || 0) >= maxAttempts) {
      const { data: session } = await sb.from("chat_sessions").select("user_id").eq("id", run.session_id).maybeSingle();
      await fail(sb, { userId: session?.user_id, runId: run.id, code: "max_attempts", message: "답변 생성을 여러 번 시도했지만 실패했습니다." }).catch(() => {});
      failed += 1;
      continue;
    }
    if (run.status === "running") {
      await sb.from("chat_runs").update({ status: "queued" }).eq("id", run.id).eq("status", "running");
    }
    try {
      await execute(run.id);
      resumed += 1;
    } catch {
      /* 다음 sweep 에서 재시도 */
    }
  }
  return { scanned: runs.length, resumed, failed };
}
