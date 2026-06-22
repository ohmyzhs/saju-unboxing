import { isChatCreditProduct } from "@saju/contracts/chat";
import { isPaidOrder } from "../legacy/_lib/orderLifecycle.js";
import { grantChatCredits } from "./chatCredits.js";

function fulfillmentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function updateFulfillment(sb, orderId, patch) {
  const { error } = await sb.from("orders").update(patch).eq("id", orderId);
  if (error) throw error;
}

export async function fulfillPaidOrder(sb, order) {
  if (!sb) throw fulfillmentError("질의응답권 데이터베이스를 사용할 수 없습니다.", 503);
  if (!order?.id) throw fulfillmentError("주문을 찾지 못했습니다.", 404);
  if (!isChatCreditProduct(order.product_id)) {
    return { required: false, status: "not_required" };
  }
  if (!isPaidOrder(order)) throw fulfillmentError("결제 완료 주문만 질의응답권을 적립할 수 있습니다.", 409);
  if (!order.user_id) throw fulfillmentError("로그인 계정 주문이 아닙니다.", 409);

  await updateFulfillment(sb, order.id, {
    fulfillment_status: "processing",
    fulfillment_error: null,
  });

  try {
    const granted = await grantChatCredits(sb, {
      userId: order.user_id,
      orderId: order.id,
      productId: order.product_id,
    });
    const fulfilledAt = new Date().toISOString();
    await updateFulfillment(sb, order.id, {
      fulfillment_status: "fulfilled",
      fulfillment_error: null,
      fulfilled_at: fulfilledAt,
    });
    return { required: true, status: "fulfilled", fulfilledAt, ...granted };
  } catch (error) {
    await updateFulfillment(sb, order.id, {
      fulfillment_status: "pending",
      fulfillment_error: String(error?.message || error).slice(0, 500),
    }).catch(() => {});
    throw error;
  }
}

export async function settleOrderFulfillment(sb, order) {
  if (!isChatCreditProduct(order?.product_id)) {
    return { required: false, status: "not_required" };
  }
  try {
    return await fulfillPaidOrder(sb, order);
  } catch (error) {
    return {
      required: true,
      status: "pending",
      error: String(error?.message || error),
    };
  }
}
