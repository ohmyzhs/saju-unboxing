// POST /api/orders — 결제 주문 생성. Supabase orders 저장 + order_created 이벤트.
import { readJson, sendJson } from "./_lib/http.js";
import { PLANS, makeCustomerKey } from "./_lib/toss.js";
import { getSupabase } from "./_lib/supabase.js";
import { getSessionUser, accountFields } from "./_lib/sessions.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "POST only" });
  try {
    const { planId, amount, orderName, visitorId, sessionId, productId, profileName } =
      await readJson(req);
    const plan = PLANS[planId];
    if (!plan) return sendJson(res, 400, { message: "결제 상품을 찾지 못했습니다." });

    const user = await getSessionUser(req);
    const finalAmount = Math.max(0, Number(amount ?? plan.amount));
    const id = makeOrderId();
    const resolvedName = String(orderName || plan.name).slice(0, 100);

    const sb = getSupabase();
    if (sb) {
      const baseRow = {
        id,
        product_id: productId,
        profile_name: profileName,
        amount: finalAmount,
        status: "결제 준비",
        visitor_id: visitorId,
        session_id: sessionId,
      };
      // 로그인 사용자면 계정(카카오/이메일) 식별을 함께 저장. 컬럼이 아직 없으면(미마이그레이션)
      // 기본 행으로 한 번 더 저장 → 주문 기록이 절대 누락되지 않게.
      const { error } = await sb.from("orders").upsert({ ...baseRow, ...accountFields(user) });
      if (error) await sb.from("orders").upsert(baseRow);
      sb.from("events")
        .insert({
          event: "order_created",
          page: "/checkout",
          visitor_id: visitorId,
          session_id: sessionId,
          metadata: { orderId: id, productId, profileName, amount: finalAmount },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return sendJson(res, 201, {
      orderId: id,
      amount: finalAmount,
      orderName: resolvedName,
      customerKey: makeCustomerKey(user),
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { message: error.message });
  }
}
