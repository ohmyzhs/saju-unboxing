// POST /api/payments/confirm — 토스 승인. 서버가 저장된 주문 금액과 대조(위변조 방지) 후 승인.
import { readJson, sendJson } from "../_lib/http.js";
import { confirmTossPayment } from "../_lib/toss.js";
import { getSupabase } from "../_lib/supabase.js";
import { adjustPoints, chargeTier, isInsufficientPoints } from "../_lib/points.js";

function paymentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function confirmOrderPayment({
  order,
  paymentKey,
  requestedAmount,
  adjust,
  confirm,
  markDone,
  markFailed = async () => {},
}) {
  if (!order) throw paymentError("주문을 찾지 못했습니다.");
  if (Number(requestedAmount) !== Number(order.amount)) {
    throw paymentError("주문 금액과 결제 요청 금액이 다릅니다.");
  }
  if (order.status === "결제 취소") {
    throw paymentError("취소된 주문은 승인할 수 없습니다.", 409);
  }
  if (order.status === "결제 완료" || order.status === "DONE") {
    return {
      paymentKey: order.toss_payment_key || paymentKey,
      orderId: order.id,
      amount: Number(order.amount),
      pointsUsed: Number(order.points_used || 0),
      alreadyProcessed: true,
    };
  }

  const pointsUsed = Number(order.points_used || 0);
  const isMixed = order.pay_method === "mixed" && pointsUsed > 0;
  const isPointCharge = order.product_id === "point-charge";
  if ((isMixed || isPointCharge) && !order.user_id) throw paymentError("로그인 계정 주문이 아닙니다.");

  if (isMixed) {
    await adjust({ userId: order.user_id, delta: -pointsUsed, type: "spend", ref: order.id });
  }

  let payment;
  try {
    payment = await confirm({ id: order.id, amount: Number(order.amount) }, paymentKey);
  } catch (error) {
    if (isMixed) {
      await adjust({ userId: order.user_id, delta: pointsUsed, type: "refund", ref: order.id });
    }
    await markFailed(error);
    throw error;
  }

  let pointsAdded = 0;
  let pointBalance;
  if (isPointCharge) {
    const tier = chargeTier(order.amount);
    if (!tier) throw paymentError("포인트 충전 티어가 올바르지 않습니다.");
    await adjust({ userId: order.user_id, delta: tier.amount, type: "charge", ref: order.id });
    pointBalance = await adjust({ userId: order.user_id, delta: tier.bonus, type: "bonus", ref: order.id });
    pointsAdded = tier.points;
  }

  await markDone(payment);
  return {
    ...payment,
    orderId: order.id,
    amount: Number(order.amount),
    pointsUsed,
    pointsAdded,
    pointBalance,
    payMethod: order.pay_method || "toss",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  try {
    const { paymentKey, orderId, amount } = await readJson(req);
    if (!paymentKey || !orderId) {
      return sendJson(res, 400, { message: "결제 주문 또는 결제키가 없습니다." });
    }

    const sb = getSupabase();
    if (!sb) {
      return sendJson(res, 503, { message: "데이터베이스(Supabase)가 설정되지 않아 결제를 검증할 수 없습니다." });
    }

    const { data: order } = await sb.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return sendJson(res, 400, { message: "주문을 찾지 못했습니다." });
    if (Number(amount) !== Number(order.amount)) {
      return sendJson(res, 400, { message: "주문 금액과 결제 요청 금액이 다릅니다." });
    }

    const result = await confirmOrderPayment({
      order,
      paymentKey,
      requestedAmount: amount,
      adjust: ({ userId, delta, type, ref }) => adjustPoints(sb, { userId, delta, type, ref }),
      confirm: confirmTossPayment,
      markDone: async (payment) => {
        const done = await sb
          .from("orders")
          .update({
            status: "결제 완료",
            toss_payment_key: payment.paymentKey,
            approved_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        if (done.error) throw done.error;
      },
      markFailed: async () => {
        await sb.from("orders").update({ status: "결제 실패" }).eq("id", orderId);
      },
    });

    sb.from("events")
      .insert({
        event: "payment_success",
        page: "/payments/success",
        visitor_id: order.visitor_id,
        session_id: order.session_id,
        metadata: { orderId, productId: order.product_id, amount: order.amount, pointsUsed: Number(order.points_used || 0) },
      })
      .then(
        () => {},
        () => {},
      );

    return sendJson(res, 200, result);
  } catch (error) {
    const status = isInsufficientPoints(error) ? 400 : error.statusCode || 500;
    const payload = isInsufficientPoints(error) ? { message: "포인트가 부족합니다." } : error.payload || { message: error.message };
    return sendJson(res, status, payload);
  }
}
