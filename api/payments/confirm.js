// POST /api/payments/confirm — 토스 승인. 서버가 저장된 주문 금액과 대조(위변조 방지) 후 승인.
import { readJson, sendJson } from "../_lib/http.js";
import { confirmTossPayment } from "../_lib/toss.js";
import { getSupabase } from "../_lib/supabase.js";

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

    const result = await confirmTossPayment({ id: order.id, amount: order.amount }, paymentKey);

    await sb
      .from("orders")
      .update({
        status: "결제 완료",
        toss_payment_key: result.paymentKey,
        approved_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    sb.from("events")
      .insert({
        event: "payment_success",
        page: "/payments/success",
        visitor_id: order.visitor_id,
        session_id: order.session_id,
        metadata: { orderId, productId: order.product_id, amount: order.amount },
      })
      .then(
        () => {},
        () => {},
      );

    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, error.payload || { message: error.message });
  }
}
