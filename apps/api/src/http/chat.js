import { CHAT_CREDIT_PRODUCTS } from "@saju/contracts/chat";
import { getChatCreditAccount } from "../domain/chatCredits.js";
import { sendJson } from "../legacy/_lib/http.js";
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

export default async function chatHandler(req, res) {
  const path = String(req.query?.chatPath || "").replace(/^\/+|\/+$/g, "");
  try {
    if (path === "catalog") {
      if (req.method !== "GET") return sendJson(res, 405, { message: "GET only" });
      return sendJson(res, 200, await chatCatalogPayload(getSupabase(), await getSessionUser(req)));
    }
    return sendJson(res, 404, { message: "챗봇 API 경로를 찾지 못했습니다." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { message: error.message });
  }
}
