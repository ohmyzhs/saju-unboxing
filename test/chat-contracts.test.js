import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAT_CREDIT_PRODUCTS,
  chatCreditProduct,
  isChatCreditProduct,
} from "../packages/contracts/chat.js";

test("챗봇 질의권 상품은 확정 수량과 할인가를 사용한다", () => {
  assert.deepEqual(
    CHAT_CREDIT_PRODUCTS.map(({ id, questions, amount, discountRate }) => [id, questions, amount, discountRate]),
    [
      ["chat-qa-1", 1, 500, 0],
      ["chat-qa-3", 3, 1500, 0],
      ["chat-qa-5", 5, 2250, 10],
      ["chat-qa-10", 10, 4000, 20],
    ],
  );
});

test("상품 조회는 고정 카탈로그 밖의 값을 허용하지 않는다", () => {
  assert.equal(chatCreditProduct("chat-qa-5")?.questions, 5);
  assert.equal(chatCreditProduct("followup"), null);
  assert.equal(isChatCreditProduct("chat-qa-10"), true);
  assert.equal(isChatCreditProduct("saju-analysis"), false);
});

test("공유 카탈로그는 런타임에서 변경할 수 없다", () => {
  assert.equal(Object.isFrozen(CHAT_CREDIT_PRODUCTS), true);
  assert.equal(Object.isFrozen(CHAT_CREDIT_PRODUCTS[0]), true);
});
