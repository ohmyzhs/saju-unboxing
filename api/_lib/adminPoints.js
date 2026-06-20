import { readJson, sendJson } from "./http.js";
import { adjustPoints, adjustRegenTokens, getPointAccount, isInsufficientPoints } from "./points.js";

export function mergePointMembers(pointRows = [], orderRows = []) {
  const labels = new Map();
  for (const row of orderRows) {
    if (!row.user_id || labels.has(String(row.user_id))) continue;
    labels.set(String(row.user_id), {
      userLabel: row.user_label || "회원",
      userProvider: row.user_provider || "kakao",
    });
  }
  const accounts = new Map(
    pointRows.map((row) => [String(row.user_id), {
      userId: String(row.user_id),
      balance: Number(row.balance || 0),
      regenTokens: Number(row.regen_tokens || 0),
      updatedAt: row.updated_at || null,
    }]),
  );
  for (const [userId] of labels) {
    if (!accounts.has(userId)) accounts.set(userId, { userId, balance: 0, regenTokens: 0, updatedAt: null });
  }
  return [...accounts.values()]
    .map((account) => ({
      ...account,
      userLabel: labels.get(account.userId)?.userLabel || account.userId,
      userProvider: labels.get(account.userId)?.userProvider || "unknown",
    }))
    .map(({ userId, userLabel, userProvider, balance, regenTokens, updatedAt }) => ({
      userId,
      userLabel,
      userProvider,
      balance,
      regenTokens,
      updatedAt,
    }))
    .sort((a, b) => Number(b.balance) - Number(a.balance) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function normalizeAdminPointChange(body = {}) {
  const operation = body.operation === "regen" ? "regen" : "adjust";
  const userId = String(body.userId || "").trim();
  const amount = Number(body.amount);
  const memo = String(body.memo || "관리자 조정").trim().slice(0, 200) || "관리자 조정";
  if (!userId) throw new Error("회원을 선택하세요.");
  if (!Number.isInteger(amount) || amount === 0) throw new Error("조정값은 0이 아닌 정수여야 합니다.");
  if (operation === "regen" && amount < 1) throw new Error("재생성 토큰은 1 이상의 정수여야 합니다.");
  return { operation, userId, amount, memo };
}

export async function handleAdminPoints(req, res, sb) {
  if (!sb) return sendJson(res, 503, { message: "Supabase가 설정되지 않아 포인트를 관리할 수 없습니다." });
  if (req.method === "GET") {
    const [{ data: pointRows, error: pointError }, { data: orderRows, error: orderError }] = await Promise.all([
      sb.from("user_points").select("user_id, balance, regen_tokens, updated_at").order("updated_at", { ascending: false }).limit(1000),
      sb.from("orders").select("user_id, user_label, user_provider, created_at").not("user_id", "is", null).order("created_at", { ascending: false }).limit(2000),
    ]);
    if (pointError || orderError) return sendJson(res, 500, { message: (pointError || orderError).message });
    const members = mergePointMembers(pointRows || [], orderRows || []);
    const userId = String(req.query?.userId || "").trim();
    let account = null;
    if (userId) {
      try {
        account = await getPointAccount(sb, userId, 100);
      } catch (error) {
        return sendJson(res, 500, { message: error.message });
      }
    }
    return sendJson(res, 200, { members, selectedUserId: userId || null, account });
  }
  if (req.method !== "POST") return sendJson(res, 405, { message: "GET/POST only" });
  try {
    const change = normalizeAdminPointChange(await readJson(req));
    const value = change.operation === "regen"
      ? await adjustRegenTokens(sb, { userId: change.userId, delta: change.amount })
      : await adjustPoints(sb, {
          userId: change.userId,
          delta: change.amount,
          type: "admin_adjust",
          ref: change.memo,
        });
    return sendJson(res, 200, {
      ok: true,
      userId: change.userId,
      balance: change.operation === "adjust" ? value : undefined,
      regenTokens: change.operation === "regen" ? value : undefined,
    });
  } catch (error) {
    const status = isInsufficientPoints(error) || /선택|정수/.test(error.message || "") ? 400 : 500;
    const message = isInsufficientPoints(error)
      ? changeErrorMessage(error)
      : error.message || "포인트 조정에 실패했습니다.";
    return sendJson(res, status, { message });
  }
}

function changeErrorMessage(error) {
  return /regen/i.test(`${error?.message || ""} ${error?.details || ""}`)
    ? "재생성 토큰이 부족합니다."
    : "포인트가 부족합니다.";
}
