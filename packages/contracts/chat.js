const rows = [
  { id: "chat-qa-1", name: "질의응답 1건", questions: 1, regularAmount: 500, discountRate: 0, amount: 500 },
  { id: "chat-qa-3", name: "질의응답 3건", questions: 3, regularAmount: 1500, discountRate: 0, amount: 1500 },
  { id: "chat-qa-5", name: "질의응답 5건", questions: 5, regularAmount: 2500, discountRate: 10, amount: 2250 },
  { id: "chat-qa-10", name: "질의응답 10건", questions: 10, regularAmount: 5000, discountRate: 20, amount: 4000 },
];

export const CHAT_CREDIT_PRODUCTS = Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const byId = new Map(CHAT_CREDIT_PRODUCTS.map((product) => [product.id, product]));

export function chatCreditProduct(productId) {
  return byId.get(String(productId || "")) || null;
}

export function isChatCreditProduct(productId) {
  return byId.has(String(productId || ""));
}
