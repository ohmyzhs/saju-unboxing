export const POINT_CHARGE_TIERS = Object.freeze([
  Object.freeze({ amount: 5000, bonus: 1000, points: 6000, bonusRate: 20 }),
  Object.freeze({ amount: 10000, bonus: 3000, points: 13000, bonusRate: 30 }),
  Object.freeze({ amount: 20000, bonus: 10000, points: 30000, bonusRate: 50 }),
]);

const POINT_TYPES = new Set(["charge", "bonus", "spend", "refund", "admin_adjust"]);

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
  return number;
}

export function chargeTier(amount) {
  const value = Number(amount);
  return POINT_CHARGE_TIERS.find((tier) => tier.amount === value) || null;
}

export function paymentBreakdown(price, requestedPoints = 0, balance = 0) {
  const normalizedPrice = nonNegativeInteger(price, "상품 금액");
  const normalizedRequest = nonNegativeInteger(requestedPoints, "사용 포인트");
  const normalizedBalance = nonNegativeInteger(balance, "포인트 잔액");
  const pointsUsed = Math.min(normalizedPrice, normalizedRequest, normalizedBalance);
  const cashAmount = normalizedPrice - pointsUsed;
  return {
    price: normalizedPrice,
    pointsUsed,
    cashAmount,
    payMethod: pointsUsed === 0 ? "toss" : cashAmount === 0 ? "points" : "mixed",
  };
}

export async function adjustPoints(sb, { userId, delta, type, ref = null }) {
  if (!sb) throw new Error("포인트 기능을 사용할 수 없습니다.");
  if (!userId) throw new Error("로그인이 필요합니다.");
  const amount = Number(delta);
  if (!Number.isInteger(amount) || amount === 0) throw new Error("변경 포인트는 0이 아닌 정수여야 합니다.");
  if (!POINT_TYPES.has(type)) throw new Error("지원하지 않는 포인트 거래 유형입니다.");
  const { data, error } = await sb.rpc("adjust_points", {
    p_user_id: String(userId),
    p_delta: amount,
    p_type: type,
    p_ref: ref == null ? null : String(ref),
  });
  if (error) throw error;
  return Number(data);
}

export async function adjustRegenTokens(sb, { userId, delta }) {
  if (!sb) throw new Error("포인트 기능을 사용할 수 없습니다.");
  if (!userId) throw new Error("로그인이 필요합니다.");
  const amount = Number(delta);
  if (!Number.isInteger(amount) || amount === 0) throw new Error("변경 토큰은 0이 아닌 정수여야 합니다.");
  const { data, error } = await sb.rpc("adjust_regen_tokens", {
    p_user_id: String(userId),
    p_delta: amount,
  });
  if (error) throw error;
  return Number(data);
}

export function isInsufficientPoints(error) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return /insufficient_(points|regen_tokens)/i.test(text);
}

export async function getPointAccount(sb, userId, transactionLimit = 30) {
  if (!sb || !userId) {
    return { enabled: false, balance: 0, regenTokens: 0, updatedAt: null, transactions: [] };
  }
  const limit = Math.max(0, Math.min(100, Number(transactionLimit) || 0));
  const accountQuery = sb
    .from("user_points")
    .select("balance, regen_tokens, updated_at")
    .eq("user_id", String(userId))
    .maybeSingle();
  const transactionsQuery = limit
    ? sb
        .from("point_transactions")
        .select("id, type, amount, balance_after, ref, created_at")
        .eq("user_id", String(userId))
        .order("created_at", { ascending: false })
        .limit(limit)
    : Promise.resolve({ data: [], error: null });
  const [accountResult, transactionResult] = await Promise.all([accountQuery, transactionsQuery]);
  if (accountResult.error) throw accountResult.error;
  if (transactionResult.error) throw transactionResult.error;
  const account = accountResult.data || {};
  return {
    enabled: true,
    balance: Number(account.balance || 0),
    regenTokens: Number(account.regen_tokens || 0),
    updatedAt: account.updated_at || null,
    transactions: (transactionResult.data || []).map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount || 0),
      balanceAfter: Number(row.balance_after || 0),
      ref: row.ref || null,
      createdAt: row.created_at,
    })),
  };
}

export async function ensurePointAccount(sb, userId) {
  if (!sb || !userId) throw new Error("로그인이 필요합니다.");
  const { error } = await sb
    .from("user_points")
    .upsert({ user_id: String(userId) }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function reserveDailyRegeneration({ requested, userId, sb, tokenBalance, adjust }) {
  if (!requested || !userId || !sb || Number(tokenBalance || 0) <= 0) {
    return { regenerate: false, reserved: false, remainingTokens: Math.max(0, Number(tokenBalance || 0)) };
  }
  const apply = adjust || ((entry) => adjustRegenTokens(sb, entry));
  try {
    const remainingTokens = await apply({ userId, delta: -1 });
    return { regenerate: true, reserved: true, remainingTokens };
  } catch (error) {
    if (isInsufficientPoints(error)) return { regenerate: false, reserved: false, remainingTokens: 0 };
    throw error;
  }
}

export async function releaseDailyRegeneration({ reserved, userId, sb, adjust }) {
  if (!reserved || !userId || !sb) return null;
  const apply = adjust || ((entry) => adjustRegenTokens(sb, entry));
  return apply({ userId, delta: 1 });
}
