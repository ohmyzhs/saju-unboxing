// /api/profiles — 로그인 사용자의 계정별 데이터(서버 보관). 기기 무관 동기화용.
//   기본(프로필): GET → 목록 / POST { profile } → upsert / POST { action:"delete", id } → 삭제
//   보관함·주문 : GET ?kind=archive|order → 목록 / POST { kind, item } → upsert
//                 POST { action:"delete", kind, id } → 삭제
// 비로그인(게스트)은 호출하지 않고 프론트가 localStorage만 사용한다.
import { readJson, sendJson } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { getSessionUser } from "./_lib/sessions.js";

const KINDS = new Set(["archive", "order"]);

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user?.id) return sendJson(res, 401, { message: "로그인이 필요합니다." });
  const userId = String(user.id);

  const sb = getSupabase();
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않았습니다." });

  if (req.method === "GET") {
    const kind = req.query?.kind || "";
    if (KINDS.has(kind)) {
      // 보관 정책: 보관함(분석 결과)은 1개월만 보관 → 1개월 지난 항목은 삭제 후 반환.
      if (kind === "archive") {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        await sb.from("user_data").delete().eq("user_id", userId).eq("kind", "archive").lt("updated_at", cutoff);
      }
      const { data } = await sb
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .eq("kind", kind)
        .order("updated_at", { ascending: false });
      return sendJson(res, 200, { items: (data || []).map((r) => r.data) });
    }
    const { data } = await sb
      .from("profiles")
      .select("profile")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return sendJson(res, 200, { profiles: (data || []).map((r) => r.profile) });
  }

  if (req.method === "POST") {
    const body = await readJson(req);

    if (body.action === "delete") {
      if (KINDS.has(body.kind)) {
        await sb.from("user_data").delete().eq("user_id", userId).eq("kind", body.kind).eq("id", String(body.id));
      } else {
        await sb.from("profiles").delete().eq("user_id", userId).eq("id", String(body.id));
      }
      return sendJson(res, 200, { ok: true });
    }

    // 보관함·주문 항목 저장
    if (KINDS.has(body.kind)) {
      const item = body.item;
      const id = String(item?.id || item?.orderId || "");
      if (!id) return sendJson(res, 400, { message: "항목 id가 필요합니다." });
      const { error } = await sb
        .from("user_data")
        .upsert({ user_id: userId, kind: body.kind, id, data: item, updated_at: new Date().toISOString() });
      if (error) return sendJson(res, 500, { message: error.message });
      return sendJson(res, 200, { ok: true });
    }

    // 프로필 저장
    const profile = body.profile;
    if (!profile?.id || !profile?.name) return sendJson(res, 400, { message: "프로필이 올바르지 않습니다." });
    const { error } = await sb.from("profiles").upsert({ id: String(profile.id), user_id: userId, profile });
    if (error) return sendJson(res, 500, { message: error.message });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { message: "GET/POST only" });
}
