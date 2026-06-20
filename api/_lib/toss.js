// 토스페이먼츠 헬퍼 (가맹점 자기 키 사용). 키 미설정 시 토스 공식 테스트 키로 작동.
import { createHash } from "crypto";

export const PLANS = {
  starter: { amount: 990, name: "사주연구소 기본 분석" },
  compatibility: { amount: 990, name: "사주연구소 궁합 분석" },
  fortune: { amount: 990, name: "사주연구소 운세 분석" },
};

export function tossKeys() {
  return {
    clientKey: process.env.TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm",
    secretKey: process.env.TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6",
  };
}

export function makeCustomerKey(user) {
  if (!user?.id) return undefined;
  return `kakao_${createHash("sha256").update(String(user.id)).digest("hex").slice(0, 28)}`;
}

export async function confirmTossPayment(order, paymentKey) {
  const { secretKey } = tossKeys();
  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": createHash("sha256").update(`${order.id}:${paymentKey}`).digest("hex"),
    },
    body: JSON.stringify({ paymentKey, orderId: order.id, amount: order.amount }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || "Toss 결제 승인 실패");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}
