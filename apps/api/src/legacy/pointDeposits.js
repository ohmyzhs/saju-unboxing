// /api/points/deposit — 무통장입금 포인트 충전 신청/조회/취소.
// 흐름: 신청(입금 안내 SMS) → 사용자가 계좌 이체 → 관리자 승인(_lib/adminDeposits.js) → 포인트 지급 + 완료 SMS.
import { readJson, sendJson } from "./_lib/http.js";
import { getSupabase, loadSiteConfig } from "./_lib/supabase.js";
import { getSessionUser } from "./_lib/sessions.js";
import { chargeTier } from "./_lib/points.js";
import { isValidKoreanMobile, normalizePhone, sendSms } from "./_lib/notify.js";

export const DEPOSIT_EXPIRE_HOURS = 72;

export const DEFAULT_BANK_TRANSFER = Object.freeze({
  bank: "카카오뱅크",
  account: "3333-26-3204251",
  holder: "에스랩",
});

export function resolveBankTransfer(config = {}) {
  const saved = config?.bank_transfer && typeof config.bank_transfer === "object" ? config.bank_transfer : {};
  return {
    bank: String(saved.bank || "").trim() || DEFAULT_BANK_TRANSFER.bank,
    account: String(saved.account || "").trim() || DEFAULT_BANK_TRANSFER.account,
    holder: String(saved.holder || "").trim() || DEFAULT_BANK_TRANSFER.holder,
  };
}

// 주문번호와 동일한 16자리 형식(한국시각 YYMMDDHHmmss + 랜덤 4자리).
export function makeDepositId(now = Date.now()) {
  const kst = new Date(now + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  const stamp =
    String(kst.getUTCFullYear()).slice(2) +
    p(kst.getUTCMonth() + 1) +
    p(kst.getUTCDate()) +
    p(kst.getUTCHours()) +
    p(kst.getUTCMinutes()) +
    p(kst.getUTCSeconds());
  return stamp + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

// 입금자명 매칭 코드: 닉네임 앞 2자 + 랜덤 4자리 (관리자가 은행 입금내역과 눈으로 매칭).
export function makeDepositorCode(nickname = "") {
  const name = String(nickname || "").replace(/\s/g, "").slice(0, 2) || "고객";
  return `${name}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}

function kstLabel(iso) {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`;
}

export function depositRequestSmsText({ bank, amount, depositorCode, points, expiresAt }) {
  return [
    "[사주언박싱] 무통장입금 안내",
    `${bank.bank} ${bank.account} (${bank.holder})`,
    `금액 ${Number(amount).toLocaleString("ko-KR")}원`,
    `입금자명 "${depositorCode}" (꼭 이 이름으로!)`,
    `${kstLabel(expiresAt)}까지 입금해주세요.`,
    `확인 후 ${Number(points).toLocaleString("ko-KR")}pt가 충전됩니다.`,
  ].join("\n");
}

export function depositConfirmedSmsText({ points, bonus, balance }) {
  return [
    "[사주언박싱] 입금 확인 완료",
    `${Number(points).toLocaleString("ko-KR")}pt 충전되었습니다. (보너스 ${Number(bonus).toLocaleString("ko-KR")}pt 포함)`,
    balance === null || balance === undefined ? null : `현재 잔액 ${Number(balance).toLocaleString("ko-KR")}pt`,
    "사주언박싱에서 바로 사용해보세요.",
  ].filter(Boolean).join("\n");
}

export function depositRejectedSmsText({ amount }) {
  return [
    "[사주언박싱] 무통장입금 신청 취소 안내",
    `${Number(amount).toLocaleString("ko-KR")}원 입금이 확인되지 않아 신청이 취소되었습니다.`,
    "이미 입금하셨다면 앱의 1:1 문의로 알려주세요. 확인 후 처리해드립니다.",
  ].join("\n");
}

export function publicDepositRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    amount: Number(row.amount),
    points: Number(row.points),
    bonus: Number(row.bonus),
    depositorCode: row.depositor_code,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at || null,
  };
}

async function appendNotifyLog(sb, id, entry) {
  const { data } = await sb.from("point_deposit_requests").select("notify_log").eq("id", id).maybeSingle();
  const log = Array.isArray(data?.notify_log) ? data.notify_log : [];
  log.push(entry);
  await sb.from("point_deposit_requests").update({ notify_log: log.slice(-20), updated_at: new Date().toISOString() }).eq("id", id);
}

export async function notifyDeposit(sb, row, template, vars, dependencies = {}) {
  const send = dependencies.sendSms || sendSms;
  const result = await send({ to: row.phone, text: template(vars) });
  await appendNotifyLog(sb, row.id, {
    kind: vars.kind,
    ok: result.ok,
    error: result.ok ? null : String(result.error || "").slice(0, 200),
    at: new Date().toISOString(),
  }).catch(() => {});
  return result;
}

export default async function handler(req, res, dependencies = {}) {
  if (!["GET", "POST"].includes(req.method)) return sendJson(res, 405, { message: "GET/POST only" });
  try {
    const sb = (dependencies.getSupabase || getSupabase)();
    if (!sb) return sendJson(res, 503, { message: "데이터베이스를 사용할 수 없습니다." });
    const user = await (dependencies.getSessionUser || getSessionUser)(req);
    if (!user?.id) return sendJson(res, 401, { message: "무통장입금 충전은 로그인이 필요합니다." });
    const config = await (dependencies.loadSiteConfig || loadSiteConfig)();
    const bank = resolveBankTransfer(config);

    if (req.method === "GET") {
      const { data, error } = await sb
        .from("point_deposit_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      // 만료 지난 대기 건은 조회 시점에 정리한다(별도 크론 없이도 안전).
      const now = Date.now();
      const rows = data || [];
      for (const row of rows) {
        if (row.status === "awaiting_deposit" && new Date(row.expires_at).getTime() < now) {
          await sb.from("point_deposit_requests")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("status", "awaiting_deposit");
          row.status = "expired";
        }
      }
      return sendJson(res, 200, {
        ok: true,
        bank,
        phone: rows[0]?.phone || "",
        requests: rows.map(publicDepositRequest),
      });
    }

    const body = await readJson(req);

    if (body.action === "cancel") {
      const id = String(body.id || "").trim();
      if (!id) return sendJson(res, 400, { message: "신청 번호가 필요합니다." });
      const { data: cancelled, error } = await sb
        .from("point_deposit_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "awaiting_deposit")
        .select("*");
      if (error) throw error;
      if (!cancelled?.length) return sendJson(res, 409, { message: "취소할 수 있는 입금 대기 신청이 없습니다." });
      return sendJson(res, 200, { ok: true, request: publicDepositRequest(cancelled[0]) });
    }

    // ── 신규 입금 신청 ──
    const tier = chargeTier(body.amount);
    if (!tier) return sendJson(res, 400, { message: "선택할 수 없는 충전 금액입니다." });
    const phone = normalizePhone(body.phone);
    if (!isValidKoreanMobile(phone)) return sendJson(res, 400, { message: "입금 안내를 받을 휴대폰 번호를 정확히 입력해주세요." });

    const { data: pending, error: pendingError } = await sb
      .from("point_deposit_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "awaiting_deposit")
      .limit(1);
    if (pendingError) throw pendingError;
    const active = (pending || []).find((row) => new Date(row.expires_at).getTime() >= Date.now());
    if (active) {
      return sendJson(res, 409, {
        message: "이미 입금 대기 중인 신청이 있습니다. 먼저 입금하거나 취소한 뒤 다시 신청해주세요.",
        request: publicDepositRequest(active),
        bank,
      });
    }

    const now = new Date();
    const row = {
      id: makeDepositId(now.getTime()),
      user_id: user.id,
      amount: tier.amount,
      points: tier.points,
      bonus: tier.bonus,
      depositor_code: makeDepositorCode(user.nickname),
      phone,
      status: "awaiting_deposit",
      expires_at: new Date(now.getTime() + DEPOSIT_EXPIRE_HOURS * 3600 * 1000).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const inserted = await sb.from("point_deposit_requests").insert(row);
    if (inserted.error) throw inserted.error;
    // 다음 신청 때 프리필 + 알림톡 전환 대비용으로 계정에도 저장.
    await sb.from("users").update({ phone }).eq("id", user.id).then(() => {}, () => {});

    const notify = await notifyDeposit(sb, row, depositRequestSmsText, {
      kind: "deposit_requested",
      bank,
      amount: row.amount,
      depositorCode: row.depositor_code,
      points: row.points,
      expiresAt: row.expires_at,
    }, dependencies);

    return sendJson(res, 201, {
      ok: true,
      bank,
      request: publicDepositRequest(row),
      sms: notify.ok ? "sent" : "failed",
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { message: error.message });
  }
}
