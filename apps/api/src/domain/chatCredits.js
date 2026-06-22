import { chatCreditProduct } from "@saju/contracts/chat";

function required(value, code) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export async function grantChatCredits(sb, { userId, orderId, productId }) {
  if (!sb) throw new Error("chat_credit_database_unavailable");
  const user = required(userId, "invalid_user_id");
  const order = required(orderId, "invalid_order_id");
  const product = chatCreditProduct(productId);
  if (!product) throw new Error("invalid_chat_credit_product");

  const { data, error } = await sb.rpc("grant_chat_credits", {
    p_user_id: user,
    p_amount: product.questions,
    p_order_id: order,
  });
  if (error) throw error;
  return {
    balance: Number(data || 0),
    creditsAdded: product.questions,
    productId: product.id,
  };
}

export async function getChatCreditAccount(sb, userId) {
  if (!sb) return { enabled: false, balance: 0, updatedAt: null };
  const user = required(userId, "invalid_user_id");
  const { data, error } = await sb
    .from("chat_credit_accounts")
    .select("balance, updated_at")
    .eq("user_id", user)
    .maybeSingle();
  if (error) throw error;
  return {
    enabled: true,
    balance: Number(data?.balance || 0),
    updatedAt: data?.updated_at || null,
  };
}
