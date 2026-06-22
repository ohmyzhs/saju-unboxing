function orderError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isPaidOrder(order) {
  return ["결제 완료", "DONE"].includes(String(order?.status || ""));
}

export async function cancelOwnedOrder({ order, userId, update }) {
  if (!order) throw orderError("주문을 찾지 못했습니다.", 404);
  if (!userId || String(order.user_id || "") !== String(userId)) {
    throw orderError("본인 주문만 취소할 수 있습니다.", 403);
  }
  if (isPaidOrder(order)) throw orderError("결제 완료 주문은 취소할 수 없습니다.", 409);
  if (String(order.status || "") === "결제 취소") {
    return { orderId: String(order.id), status: "결제 취소" };
  }
  await update({ status: "결제 취소" });
  return { orderId: String(order.id), status: "결제 취소" };
}

export function resumeOwnedOrder({ order, userId }) {
  if (!order) throw orderError("주문을 찾지 못했습니다.", 404);
  if (!userId || String(order.user_id || "") !== String(userId)) {
    throw orderError("본인 주문만 이어서 결제할 수 있습니다.", 403);
  }
  if (isPaidOrder(order) || ["결제 취소", "결제 실패"].includes(String(order.status || ""))) {
    throw orderError("이 주문은 결제를 재개할 수 없습니다.", 409);
  }
  return {
    orderId: String(order.id),
    amount: Number(order.amount || 0),
    pointsUsed: Number(order.points_used || 0),
    productId: order.product_id || null,
  };
}
