// 관리자 무통장입금 처리 — /api/admin/deposits (admin/[action].js에서 isAdmin 통과 후 호출).
// 승인은 status 전이 가드(awaiting_deposit → confirmed)로 중복 지급을 막는다:
// 관리자 둘이 동시에 눌러도 update가 1행만 성공하고 나머지는 409.
import { readJson, sendJson } from "./http.js";
import { adjustPoints } from "./points.js";
import { loadSiteConfig } from "./supabase.js";
import {
  depositConfirmedSmsText,
  depositRejectedSmsText,
  notifyDeposit,
  publicDepositRequest,
  resolveBankTransfer,
} from "../pointDeposits.js";

function adminDepositView(row, userLabels = new Map()) {
  const base = publicDepositRequest(row);
  return {
    ...base,
    userId: row.user_id,
    userLabel: userLabels.get(String(row.user_id)) || "회원",
    phone: row.phone,
    memo: row.memo || "",
    confirmedBy: row.confirmed_by || null,
    notifyLog: Array.isArray(row.notify_log) ? row.notify_log.slice(-5) : [],
  };
}

export async function handleAdminDeposits(req, res, sb, dependencies = {}) {
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않았습니다." });
  try {
    if (req.method === "GET") {
      const { data, error } = await sb
        .from("point_deposit_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data || [];
      const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
      const labels = new Map();
      if (userIds.length) {
        const { data: users } = await sb.from("users").select("id, nickname, email").in("id", userIds);
        for (const u of users || []) labels.set(String(u.id), u.nickname || u.email || "회원");
      }
      const config = await (dependencies.loadSiteConfig || loadSiteConfig)();
      return sendJson(res, 200, {
        ok: true,
        bank: resolveBankTransfer(config),
        requests: rows.map((row) => adminDepositView(row, labels)),
      });
    }
    if (req.method !== "POST") return sendJson(res, 405, { message: "GET/POST only" });

    const body = await readJson(req);
    const id = String(body.id || "").trim();
    const action = String(body.action || "").trim();
    if (!id) return sendJson(res, 400, { message: "신청 번호가 필요합니다." });
    if (!["confirm", "reject"].includes(action)) return sendJson(res, 400, { message: "지원하지 않는 작업입니다." });

    const nextStatus = action === "confirm" ? "confirmed" : "rejected";
    const { data: updated, error } = await sb
      .from("point_deposit_requests")
      .update({
        status: nextStatus,
        confirmed_by: "admin",
        confirmed_at: new Date().toISOString(),
        memo: String(body.memo || "").slice(0, 300) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "awaiting_deposit")
      .select("*");
    if (error) throw error;
    const row = updated?.[0];
    if (!row) return sendJson(res, 409, { message: "이미 처리됐거나 입금 대기 상태가 아닙니다." });

    if (action === "reject") {
      await notifyDeposit(sb, row, depositRejectedSmsText, { kind: "deposit_rejected", amount: row.amount }, dependencies);
      return sendJson(res, 200, { ok: true, request: publicDepositRequest(row) });
    }

    // ── 승인: 포인트 지급 (토스 충전과 동일하게 charge + bonus 두 건으로 원장 기록) ──
    const adjust = dependencies.adjustPoints || adjustPoints;
    let balance = null;
    try {
      await adjust(sb, { userId: row.user_id, delta: Number(row.amount), type: "charge", ref: row.id });
      balance = await adjust(sb, { userId: row.user_id, delta: Number(row.bonus), type: "bonus", ref: row.id });
    } catch (pointError) {
      // 지급 실패 시 대기 상태로 되돌려 재승인 가능하게 한다(원장 파셜 여부는 ref=신청번호로 추적).
      await sb.from("point_deposit_requests")
        .update({ status: "awaiting_deposit", confirmed_by: null, confirmed_at: null, memo: `지급 오류: ${String(pointError.message || pointError).slice(0, 200)}`, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      throw pointError;
    }

    const notify = await notifyDeposit(sb, row, depositConfirmedSmsText, {
      kind: "deposit_confirmed",
      points: row.points,
      bonus: row.bonus,
      balance,
    }, dependencies);

    return sendJson(res, 200, {
      ok: true,
      request: { ...publicDepositRequest(row), status: "confirmed" },
      balance,
      sms: notify.ok ? "sent" : "failed",
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { message: error.message });
  }
}
