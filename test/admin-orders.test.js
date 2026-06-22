import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mapOrder } from "../apps/api/src/legacy/admin/[action].js";

const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");

test("관리자 주문 매핑에 현금·포인트·결제방식을 포함한다", () => {
  const mapped = mapOrder({
    id: "o1",
    product_id: "saju-analysis",
    profile_name: "홍길동",
    amount: 0,
    points_used: 1990,
    pay_method: "points",
    status: "결제 완료",
    created_at: "2026-06-21T00:00:00Z",
  });

  assert.equal(mapped.cashAmount, 0);
  assert.equal(mapped.pointsUsed, 1990);
  assert.equal(mapped.payMethod, "points");
  assert.equal(mapped.totalAmount, 1990);
});

test("관리자 결제 목록은 포인트·혼합 결제를 별도 표시한다", () => {
  assert.match(admin, /function adminPaymentLabel/);
  assert.match(admin, /order\.pointsUsed/);
  assert.match(admin, /order\.payMethod/);
});
