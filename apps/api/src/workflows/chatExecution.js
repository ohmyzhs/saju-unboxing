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
