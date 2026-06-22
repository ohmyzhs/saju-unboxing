// POST /api/orders — 결제 주문 생성. Supabase orders 저장 + order_created 이벤트.
import { readJson, sendJson } from "./_lib/http.js";
import { PLANS, makeCustomerKey } from "./_lib/toss.js";
import { getSupabase, loadSiteConfig } from "./_lib/supabase.js";
import { getSessionUser, accountFields } from "./_lib/sessions.js";
import { adjustPoints, chargeTier, getPointAccount, isInsufficientPoints, paymentBreakdown } from "./_lib/points.js";
import { cancelOwnedOrder, resumeOwnedOrder } from "./_lib/orderLifecycle.js";

// 주문번호: 한국시각 YYMMDDHHmmss + 4자리 랜덤 = 16자리 숫자 (예: 2606170454239218).
// 쇼핑몰 표준식 — 시간순 정렬·식별이 쉽고, 토스 orderId 규격(6~64자 영숫자)도 충족.
function makeOrderId() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000); // UTC → KST(+9)
  const p = (n) => String(n).padStart(2, "0");
  const stamp =
    String(kst.getUTCFullYear()).slice(2) +
    p(kst.getUTCMonth() + 1) +
    p(kst.getUTCDate()) +
    p(kst.getUTCHours()) +
    p(kst.getUTCMinutes()) +
    p(kst.getUTCSeconds());
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return stamp + rand;
}

export function resolveProductPrice(config, productId, plan) {
  const configured = config?.products?.[productId]?.amount;
  const value = configured === undefined || configured === null || configured === "" ? plan?.amount : configured;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) throw new Error("상품 가격 설정이 올바르지 않습니다.");
  return amount;
}

export function resolveOrderPayment({ price, requestedPoints = 0, balance = 0 }) {
  return paymentBreakdown(price, requestedPoints, balance);
}

export async function completePointOnlyOrder({ userId, orderId, pointsUsed, adjust, markDone, markFailed }) {
  let spent = false;
  try {
    const balanceAfter = await adjust({ userId, delta: -pointsUsed, type: "spend", ref: orderId });
    spent = true;
    await markDone();
    return balanceAfter;
  } catch (error) {
    if (spent) {
      await adjust({ userId, delta: pointsUsed, type: "refund", ref: orderId }).catch(() => {});
    }
    await markFailed().catch(() => {});
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  try {
    const body = await readJson(req);
    const { planId, amount, orderName, visitorId, sessionId, productId, profileName, pointsUsed = 0 } = body;
    const user = await getSessionUser(req);
    const sb = getSupabase();
    if (body.action === "cancel" || body.action === "resume") {
      if (!user?.id) return sendJson(res, 401, { message: "로그인이 필요합니다." });
      if (!sb) return sendJson(res, 503, { message: "주문 정보를 확인할 수 없습니다." });
      const { data: order, error: findError } = await sb.from("orders").select("id, user_id, status, amount, points_used, product_id").eq("id", String(body.orderId || "")).maybeSingle();
      if (findError) throw findError;
      if (body.action === "resume") {
        return sendJson(res, 200, { ok: true, ...resumeOwnedOrder({ order, userId: user.id }), customerKey: makeCustomerKey(user) });
      }
      const result = await cancelOwnedOrder({
        order,
        userId: user.id,
        update: async (patch) => {
          const updated = await sb.from("orders").update(patch).eq("id", order.id);
          if (updated.error) throw updated.error;
        },
      });
      return sendJson(res, 200, { ok: true, ...result });
    }
    const isPointCharge = productId === "point-charge";
    const tier = isPointCharge ? chargeTier(amount) : null;
    if (isPointCharge && !tier) return sendJson(res, 400, { message: "선택할 수 없는 포인트 충전 금액입니다." });
    if (isPointCharge && !user?.id) return sendJson(res, 401, { message: "포인트 충전은 로그인이 필요합니다." });
    if (isPointCharge && !sb) return sendJson(res, 503, { message: "포인트 기능을 사용할 수 없습니다." });

    const plan = isPointCharge ? { amount: tier.amount, name: `포인트 ${tier.points.toLocaleString("ko-KR")}pt 충전` } : PLANS[planId];
    if (!plan) return sendJson(res, 400, { message: "결제 상품을 찾지 못했습니다." });
    const config = isPointCharge ? {} : await loadSiteConfig();
    const price = isPointCharge ? tier.amount : resolveProductPrice(config, productId, plan);
    const requestedPoints = Number(pointsUsed || 0);
    if (!Number.isInteger(requestedPoints) || requestedPoints < 0) {
      return sendJson(res, 400, { message: "사용 포인트가 올바르지 않습니다." });
    }
    if (requestedPoints > 0 && (!user?.id || !sb)) {
      return sendJson(res, user?.id ? 503 : 401, { message: user?.id ? "포인트 기능을 사용할 수 없습니다." : "포인트 사용은 로그인이 필요합니다." });
    }

    let pointAccount = { balance: 0 };
    if (requestedPoints > 0) {
      try {
        pointAccount = await getPointAccount(sb, user.id, 0);
      } catch {
        return sendJson(res, 503, { message: "포인트 정보를 확인할 수 없습니다." });
      }
    }
    const payment = isPointCharge
      ? { price, pointsUsed: 0, cashAmount: price, payMethod: "toss" }
      : resolveOrderPayment({ price, requestedPoints, balance: pointAccount.balance });
    const id = makeOrderId();
    const resolvedName = String(orderName || plan.name).slice(0, 100);

    if (sb) {
      const baseRow = {
        id,
        product_id: isPointCharge ? "point-charge" : productId,
        profile_name: profileName,
        amount: payment.cashAmount,
        points_used: payment.pointsUsed,
        pay_method: payment.payMethod,
        status: "결제 준비",
        visitor_id: visitorId,
        session_id: sessionId,
      };
      // 로그인 사용자면 계정(카카오/이메일) 식별을 함께 저장. 컬럼이 아직 없으면(미마이그레이션)
      // 기본 행으로 한 번 더 저장 → 주문 기록이 절대 누락되지 않게.
      const orderRow = { ...baseRow, ...accountFields(user) };
      const { error } = await sb.from("orders").upsert(orderRow);
      if (error) {
        if (payment.pointsUsed > 0 || isPointCharge) throw error;
        await sb.from("orders").upsert(baseRow);
      }

      if (payment.payMethod === "points") {
        try {
          pointAccount.balance = await completePointOnlyOrder({
            userId: user.id,
            orderId: id,
            pointsUsed: payment.pointsUsed,
            adjust: ({ userId, delta, type, ref }) => adjustPoints(sb, { userId, delta, type, ref }),
            markDone: async () => {
              const done = await sb
                .from("orders")
                .update({ status: "결제 완료", approved_at: new Date().toISOString() })
                .eq("id", id);
              if (done.error) throw done.error;
            },
            markFailed: async () => {
              await sb.from("orders").update({ status: "결제 실패" }).eq("id", id);
            },
          });
        } catch (error) {
          if (isInsufficientPoints(error)) return sendJson(res, 400, { message: "포인트가 부족합니다." });
          throw error;
        }
      }
      sb.from("events")
        .insert({
          event: "order_created",
          page: "/checkout",
          visitor_id: visitorId,
          session_id: sessionId,
          metadata: { orderId: id, productId: isPointCharge ? "point-charge" : productId, profileName, amount: payment.cashAmount, pointsUsed: payment.pointsUsed },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return sendJson(res, 201, {
      orderId: id,
      amount: payment.cashAmount,
      price: payment.price,
      pointsUsed: payment.pointsUsed,
      payMethod: payment.payMethod,
      paidWithPoints: payment.payMethod === "points",
      pointBalance: pointAccount.balance,
      orderName: resolvedName,
      customerKey: makeCustomerKey(user),
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { message: error.message });
  }
}
