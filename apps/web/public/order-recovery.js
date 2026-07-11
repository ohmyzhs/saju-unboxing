function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function isPaid(order) {
  return String(order?.status || "").includes("완료") || String(order?.status || "") === "DONE";
}

function cashAmount(order) {
  if (order?.cashAmount !== undefined && order?.cashAmount !== null) return number(order.cashAmount);
  return Math.max(0, number(order?.amount) - number(order?.pointsUsed));
}

function capabilities(order = {}) {
  const status = String(order.status || "");
  const paid = isPaid(order);
  const pointCharge = order.productId === "point-charge";
  const cancelled = status.includes("취소");
  const failed = status.includes("실패") || status.includes("오류");
  const viewReport = paid && !pointCharge && (
    order.reportStatus === "complete"
    // 외부 리포트 생성 중에도 "생성 상태 확인" 진입점은 항상 남긴다
    // (externalReport가 아직 동기화되지 않았어도 버튼이 사라지면 안 됨).
    || order.reportStatus === "generating"
    || Boolean(order.hasReport)
    || Boolean(order.externalReport?.shareUrl)
  );
  const retryReport = paid && !pointCharge && order.reportStatus !== "generating"
    && (order.reportStatus === "failed" || !viewReport);
  return {
    cancel: !paid && !cancelled && !failed,
    resume: !paid && !cancelled && !failed,
    viewReport,
    retryReport,
  };
}

function totalAmount(order = {}) {
  if (order.price !== undefined && order.price !== null) return number(order.price);
  if (order.cashAmount !== undefined && order.cashAmount !== null) {
    return number(order.cashAmount) + number(order.pointsUsed);
  }
  return number(order.amount);
}

function paymentSummary(order = {}) {
  const cash = cashAmount(order);
  const points = number(order.pointsUsed);
  if (cash > 0 && points > 0) return `현금 ${cash.toLocaleString("ko-KR")}원 + ${points.toLocaleString("ko-KR")}pt`;
  if (points > 0) return `${points.toLocaleString("ko-KR")}pt`;
  return `현금 ${cash.toLocaleString("ko-KR")}원`;
}

globalThis.OrderRecovery = Object.freeze({ capabilities, cashAmount, isPaid, paymentSummary, totalAmount });
