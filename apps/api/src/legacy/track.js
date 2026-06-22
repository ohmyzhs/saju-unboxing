// POST /api/track — 방문/행동 이벤트 수집 → Supabase events. 실패해도 조용히 200.
import { randomUUID } from "crypto";
import { readJson, sendJson } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";

function requestIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw?.split(",")[0] || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  try {
    const p = await readJson(req);
    const id = randomUUID();
    const sb = getSupabase();
    if (sb) {
      await sb.from("events").insert({
        id,
        event: p.event,
        page: p.page,
        view: p.view,
        visitor_id: p.visitorId,
        session_id: p.sessionId,
        referrer: p.referrer,
        utm: p.utm || null,
        device: p.device || null,
        metadata: { ...(p.metadata || {}), landingPage: p.landingPage },
        duration_ms: p.durationMs ?? null,
        ip: requestIp(req),
        user_agent: req.headers["user-agent"] || "",
        at: new Date().toISOString(),
      });
    }
    return sendJson(res, 201, { ok: true, id });
  } catch {
    return sendJson(res, 200, { ok: false });
  }
}
