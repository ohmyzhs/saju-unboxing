import { CHAT_CREDIT_PRODUCTS } from "@saju/contracts/chat";
import { getChatCreditAccount } from "../domain/chatCredits.js";
import {
  createReportChatSession,
  enqueueReportChatMessage,
  failChatRun,
  getReportChatSession,
  listReportChatSessions,
} from "../domain/chatRepository.js";
import { readJson, sendJson } from "../legacy/_lib/http.js";
import { getSessionUser } from "../legacy/_lib/sessions.js";
import { getSupabase } from "../legacy/_lib/supabase.js";

function chatHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function chatCatalogPayload(sb, user) {
  if (!user?.id) throw chatHttpError("로그인이 필요합니다.", 401);
  if (!sb) throw chatHttpError("챗봇 상담 데이터베이스를 사용할 수 없습니다.", 503);
  const account = await getChatCreditAccount(sb, user.id);
  return {
    products: CHAT_CREDIT_PRODUCTS,
    balance: account.balance,
    updatedAt: account.updatedAt,
  };
}

export function createChatHandler({
  getUser = getSessionUser,
  getDb = getSupabase,
  startRun = null,
  recoverRuns = null,
} = {}) {
  return async function chatHandler(req, res) {
    const path = String(req.query?.chatPath || "").replace(/^\/+|\/+$/g, "");
    try {
      const user = await getUser(req);
      const sb = getDb();
      if (user?.id && recoverRuns) recoverRuns(sb);
      if (path === "catalog") {
        if (req.method !== "GET") return sendJson(res, 405, { message: "GET only" });
        return sendJson(res, 200, await chatCatalogPayload(sb, user));
      }
      if (path === "sessions") {
        if (!user?.id) throw chatHttpError("로그인이 필요합니다.", 401);
        if (req.method === "GET") {
          return sendJson(res, 200, { sessions: await listReportChatSessions(sb, user.id) });
        }
        if (req.method === "POST") {
          const body = await readJson(req);
          const session = await createReportChatSession(sb, { userId: user.id, archiveId: body.archiveId });
          return sendJson(res, session.duplicate ? 200 : 201, { session });
        }
        return sendJson(res, 405, { message: "GET/POST only" });
      }
      const messageMatch = /^sessions\/([^/]+)\/messages$/.exec(path);
      if (messageMatch) {
        if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
        if (!user?.id) throw chatHttpError("로그인이 필요합니다.", 401);
        if (!startRun) throw chatHttpError("챗봇 실행기가 아직 설정되지 않았습니다.", 503);
        const body = await readJson(req);
        const run = await enqueueReportChatMessage(sb, {
          userId: user.id,
          sessionId: messageMatch[1],
          clientRequestId: body.clientRequestId,
          question: body.question,
        });
        if (!run.duplicate) {
          try {
            await startRun(run.runId);
          } catch (error) {
            await failChatRun(sb, {
              userId: user.id,
              runId: run.runId,
              code: "workflow_start_failed",
              message: error.message,
            }).catch(() => {});
            throw chatHttpError("답변 생성 작업을 시작하지 못했습니다. 질의응답권은 자동 환원됩니다.", 503);
          }
        }
        return sendJson(res, 202, run);
      }
      const sessionMatch = /^sessions\/([^/]+)$/.exec(path);
      if (sessionMatch) {
        if (req.method !== "GET") return sendJson(res, 405, { message: "GET only" });
        if (!user?.id) throw chatHttpError("로그인이 필요합니다.", 401);
        return sendJson(res, 200, await getReportChatSession(sb, {
          userId: user.id,
          sessionId: sessionMatch[1],
        }));
      }
      return sendJson(res, 404, { message: "챗봇 API 경로를 찾지 못했습니다." });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { message: error.message, code: error.code || undefined });
    }
  };
}

export default createChatHandler();
