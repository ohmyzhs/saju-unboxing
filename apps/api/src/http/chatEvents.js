import { sendJson } from "../legacy/_lib/http.js";
import { getSessionUser } from "../legacy/_lib/sessions.js";
import { getSupabase } from "../legacy/_lib/supabase.js";

export function parseLastEventId(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function formatChatSseEvent({ id, event, data }) {
  const rows = [];
  if (Number.isInteger(id) && id > 0) rows.push(`id: ${id}`);
  rows.push(`event: ${event || "message"}`);
  rows.push(`data: ${JSON.stringify(data || {})}`);
  return `${rows.join("\n")}\n\n`;
}

async function defaultLoadSnapshot(sb, { userId, runId }) {
  const { data: run, error: runError } = await sb
    .from("chat_runs")
    .select("id, session_id, assistant_message_id, status")
    .eq("id", runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) {
    const error = new Error("답변 실행을 찾지 못했습니다.");
    error.statusCode = 404;
    throw error;
  }

  const [{ data: session, error: sessionError }, { data: message, error: messageError }] = await Promise.all([
    sb.from("chat_sessions").select("id").eq("id", run.session_id).eq("user_id", userId).maybeSingle(),
    sb.from("chat_messages").select("content, status, error_message").eq("id", run.assistant_message_id).maybeSingle(),
  ]);
  if (sessionError) throw sessionError;
  if (messageError) throw messageError;
  if (!session) {
    const error = new Error("답변 실행을 찾지 못했습니다.");
    error.statusCode = 404;
    throw error;
  }
  return {
    content: message?.content || "",
    status: run.status,
    errorMessage: message?.error_message || null,
  };
}

async function defaultLoadEvents(sb, { runId, after }) {
  const { data, error } = await sb
    .from("chat_stream_events")
    .select("seq, type, payload")
    .eq("run_id", runId)
    .gt("seq", after)
    .order("seq", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data || [];
}

function terminalEvent(status) {
  return status === "completed" ? "complete" : status === "failed" ? "error" : null;
}

export function createChatEventsHandler({
  getUser = getSessionUser,
  getDb = getSupabase,
  loadSnapshot = defaultLoadSnapshot,
  loadEvents = defaultLoadEvents,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  maxDurationMs = 55_000,
} = {}) {
  return async function chatEventsHandler(req, res) {
    if (req.method !== "GET") return sendJson(res, 405, { message: "GET only" });
    try {
      const user = await getUser(req);
      if (!user?.id) return sendJson(res, 401, { message: "로그인이 필요합니다." });
      const sb = getDb();
      if (!sb) return sendJson(res, 503, { message: "챗봇 상담 데이터베이스를 사용할 수 없습니다." });
      const runId = String(req.query?.chatRunId || "").trim();
      if (!runId) return sendJson(res, 400, { message: "답변 실행 ID가 필요합니다." });

      const snapshot = await loadSnapshot(sb, { userId: user.id, runId });
      let cursor = parseLastEventId(req.headers?.["last-event-id"]);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.write(formatChatSseEvent({
        event: "replace",
        data: { content: snapshot.content, status: snapshot.status },
      }));

      const initialTerminal = terminalEvent(snapshot.status);
      if (initialTerminal) {
        res.write(formatChatSseEvent({
          event: initialTerminal,
          data: initialTerminal === "complete"
            ? { content: snapshot.content, status: snapshot.status }
            : { message: snapshot.errorMessage || "답변 생성에 실패했습니다.", status: snapshot.status },
        }));
        res.end();
        return;
      }

      const startedAt = now();
      let lastHeartbeatAt = startedAt;
      while (now() - startedAt < maxDurationMs) {
        const events = await loadEvents(sb, { userId: user.id, runId, after: cursor });
        for (const event of events) {
          cursor = Math.max(cursor, Number(event.seq) || 0);
          res.write(formatChatSseEvent({ id: cursor, event: event.type, data: event.payload || {} }));
          if (event.type === "complete" || event.type === "error") {
            res.end();
            return;
          }
        }
        if (now() - lastHeartbeatAt >= 15_000) {
          res.write(": heartbeat\n\n");
          lastHeartbeatAt = now();
        }
        await sleep(1_000);
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) return sendJson(res, error.statusCode || 500, { message: error.message });
      res.write(formatChatSseEvent({ event: "error", data: { message: "실시간 연결이 끊겼습니다." } }));
      res.end();
    }
  };
}

export default createChatEventsHandler();
