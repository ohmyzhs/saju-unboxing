import { getChatCreditAccount } from "./chatCredits.js";

function repositoryError(message, statusCode = 400, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requiredId(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw repositoryError(`${name}이 필요합니다.`, 400, `invalid_${name}`);
  return normalized;
}

function throwDatabase(error) {
  const text = String(error?.message || error || "");
  if (text.includes("archive_not_found")) throw repositoryError("선택한 보관함 리포트를 찾지 못했습니다.", 404, "archive_not_found");
  if (text.includes("report_snapshot_too_large")) throw repositoryError("리포트 데이터가 너무 커서 대화를 열 수 없습니다.", 413, "report_snapshot_too_large");
  throw error;
}

function mapSession(row) {
  const session = {
    id: row.id,
    sourceArchiveId: row.source_archive_id ?? row.sourceArchiveId,
    title: row.title,
    status: row.status,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    lastMessageAt: row.last_message_at ?? row.lastMessageAt ?? null,
  };
  if (row.duplicate !== undefined) session.duplicate = Boolean(row.duplicate);
  return session;
}

function mapRun(row) {
  return {
    id: row.id,
    sessionId: row.session_id ?? row.sessionId,
    userMessageId: row.user_message_id ?? row.userMessageId,
    assistantMessageId: row.assistant_message_id ?? row.assistantMessageId,
    workflowRunId: row.workflow_run_id ?? row.workflowRunId ?? null,
    status: row.status,
    creditStatus: row.credit_status ?? row.creditStatus,
    model: row.model || null,
    usage: row.usage || {},
    createdAt: row.created_at ?? row.createdAt ?? null,
    startedAt: row.started_at ?? row.startedAt ?? null,
    completedAt: row.completed_at ?? row.completedAt ?? null,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    sessionId: row.session_id ?? row.sessionId,
    role: row.role,
    content: row.content || "",
    status: row.status,
    replyTo: row.reply_to ?? row.replyTo ?? null,
    clientRequestId: row.client_request_id ?? row.clientRequestId ?? null,
    errorCode: row.error_code ?? row.errorCode ?? null,
    errorMessage: row.error_message ?? row.errorMessage ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    completedAt: row.completed_at ?? row.completedAt ?? null,
  };
}

export async function createReportChatSession(sb, { userId, archiveId }) {
  if (!sb) throw repositoryError("챗봇 상담 데이터베이스를 사용할 수 없습니다.", 503);
  const { data, error } = await sb.rpc("create_chat_session", {
    p_user_id: requiredId(userId, "user_id"),
    p_archive_id: requiredId(archiveId, "archive_id"),
  });
  if (error) throwDatabase(error);
  return mapSession(data || {});
}

export async function listReportChatSessions(sb, userId) {
  if (!sb) throw repositoryError("챗봇 상담 데이터베이스를 사용할 수 없습니다.", 503);
  const user = requiredId(userId, "user_id");
  const { data: sessions, error } = await sb
    .from("chat_sessions")
    .select("id, source_archive_id, title, status, created_at, updated_at, last_message_at")
    .eq("user_id", user)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  if (!sessions?.length) return [];

  const { data: runs, error: runError } = await sb
    .from("chat_runs")
    .select("id, session_id, status, credit_status, created_at")
    .in("session_id", sessions.map((session) => session.id))
    .order("created_at", { ascending: false });
  if (runError) throw runError;

  const latestBySession = new Map();
  for (const run of runs || []) {
    if (!latestBySession.has(run.session_id)) latestBySession.set(run.session_id, mapRun(run));
  }
  return sessions.map((session) => ({
    ...mapSession(session),
    latestRun: latestBySession.get(session.id) || null,
  }));
}

export async function getReportChatSession(sb, { userId, sessionId }) {
  if (!sb) throw repositoryError("챗봇 상담 데이터베이스를 사용할 수 없습니다.", 503);
  const user = requiredId(userId, "user_id");
  const id = requiredId(sessionId, "session_id");
  const { data: session, error } = await sb
    .from("chat_sessions")
    .select("id, user_id, source_archive_id, report_snapshot, title, status, created_at, updated_at, last_message_at")
    .eq("id", id)
    .eq("user_id", user)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw repositoryError("대화방을 찾지 못했습니다.", 404, "chat_session_not_found");

  const [{ data: messages, error: messageError }, { data: runs, error: runError }, account] = await Promise.all([
    sb.from("chat_messages").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    sb.from("chat_runs").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    getChatCreditAccount(sb, user),
  ]);
  if (messageError) throw messageError;
  if (runError) throw runError;

  return {
    session: mapSession(session),
    report: session.report_snapshot,
    messages: (messages || []).map(mapMessage),
    runs: (runs || []).map(mapRun),
    balance: account.balance,
  };
}

function normalizeQuestion(value) {
  const question = String(value || "").trim();
  const length = Array.from(question).length;
  if (length < 1 || length > 1000) {
    throw repositoryError("질문은 1자 이상 1,000자 이하로 입력해주세요.", 400, "invalid_chat_question");
  }
  return question;
}

function normalizeClientRequestId(value) {
  const requestId = String(value || "").trim();
  if (requestId.length < 1 || requestId.length > 100) {
    throw repositoryError("질문 요청 ID가 올바르지 않습니다.", 400, "invalid_client_request_id");
  }
  return requestId;
}

export async function enqueueReportChatMessage(sb, {
  userId,
  sessionId,
  clientRequestId,
  question,
}) {
  if (!sb) throw repositoryError("챗봇 상담 데이터베이스를 사용할 수 없습니다.", 503);
  const { data, error } = await sb.rpc("enqueue_chat_message", {
    p_user_id: requiredId(userId, "user_id"),
    p_session_id: requiredId(sessionId, "session_id"),
    p_client_request_id: normalizeClientRequestId(clientRequestId),
    p_question: normalizeQuestion(question),
  });
  if (error) {
    const message = String(error.message || error);
    if (message.includes("insufficient_chat_credits")) {
      throw repositoryError("남은 질의응답권이 없습니다.", 409, "insufficient_chat_credits");
    }
    if (message.includes("chat_session_not_found")) {
      throw repositoryError("대화방을 찾지 못했습니다.", 404, "chat_session_not_found");
    }
    throw error;
  }
  return {
    runId: data?.runId,
    userMessageId: data?.userMessageId,
    assistantMessageId: data?.assistantMessageId,
    balance: Number(data?.balance || 0),
    duplicate: Boolean(data?.duplicate),
  };
}

export async function failChatRun(sb, { userId, runId, code, message }) {
  if (!sb) throw repositoryError("챗봇 상담 데이터베이스를 사용할 수 없습니다.", 503);
  const { data, error } = await sb.rpc("fail_chat_run", {
    p_user_id: requiredId(userId, "user_id"),
    p_run_id: requiredId(runId, "run_id"),
    p_error_code: String(code || "chat_run_failed").slice(0, 100),
    p_error_message: String(message || "답변 생성에 실패했습니다.").slice(0, 500),
  });
  if (error) throw error;
  return data;
}
