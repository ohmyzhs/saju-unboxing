// /api/support — 로그인 사용자의 비공개 1:1 문의 목록·상세·작성.
import { readJson, sendJson } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { getSessionUser } from "./_lib/sessions.js";

export const SUPPORT_CATEGORIES = new Set(["error", "refund", "general"]);
export const SUPPORT_STATUSES = new Set(["received", "in_progress", "answered", "closed"]);

export function normalizeSupportInput(body = {}) {
  const category = SUPPORT_CATEGORIES.has(body.category) ? body.category : "general";
  const title = String(body.title || "").trim().replace(/\s+/g, " ");
  const content = String(body.content || "").trim();
  if (title.length < 2 || title.length > 80) return { message: "제목은 2~80자로 입력하세요." };
  if (content.length < 10 || content.length > 3000) return { message: "문의 내용은 10~3000자로 입력하세요." };
  return { category, title, content };
}

export function mapSupportInquiry(row = {}) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    status: row.status,
    answer: row.answer || "",
    answeredAt: row.answered_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    userNickname: row.user_nickname || "",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
  };
}

const COLUMNS = "id, user_id, user_nickname, contact_email, contact_phone, category, title, content, status, answer, answered_at, created_at, updated_at";

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user?.id) return sendJson(res, 401, { message: "1:1 문의는 로그인 후 이용할 수 있습니다." });
  const userId = String(user.id);
  const sb = getSupabase();
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않았습니다." });

  if (req.method === "GET") {
    const id = String(req.query?.id || "").trim();
    if (id) {
      const { data, error } = await sb
        .from("support_inquiries")
        .select(COLUMNS)
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) return sendJson(res, 500, { message: error.message });
      if (!data) return sendJson(res, 404, { message: "문의를 찾을 수 없습니다." });
      return sendJson(res, 200, { inquiry: mapSupportInquiry(data) });
    }
    const { data, error } = await sb
      .from("support_inquiries")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return sendJson(res, 500, { message: error.message });
    return sendJson(res, 200, { inquiries: (data || []).map(mapSupportInquiry) });
  }

  if (req.method === "POST") {
    const input = normalizeSupportInput(await readJson(req));
    if (input.message) return sendJson(res, 400, { message: input.message });
    const { data, error } = await sb
      .from("support_inquiries")
      .insert({
        user_id: userId,
        user_nickname: String(user.nickname || "").slice(0, 80),
        contact_email: String(user.email || "").slice(0, 320),
        contact_phone: String(user.phone || "").replace(/\D/g, "").slice(0, 20),
        category: input.category,
        title: input.title,
        content: input.content,
      })
      .select(COLUMNS)
      .single();
    if (error) return sendJson(res, 500, { message: error.message });
    return sendJson(res, 201, { inquiry: mapSupportInquiry(data) });
  }

  return sendJson(res, 405, { message: "GET/POST only" });
}
