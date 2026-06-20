import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  POINT_CHARGE_TIERS,
  adjustPoints,
  adjustRegenTokens,
  chargeTier,
  getPointAccount,
  ensurePointAccount,
  isInsufficientPoints,
  paymentBreakdown,
} from "../api/_lib/points.js";

test("충전 티어는 고정 보너스를 포함한다", () => {
  assert.deepEqual(
    POINT_CHARGE_TIERS.map(({ amount, bonus, points }) => [amount, bonus, points]),
    [
      [5000, 1000, 6000],
      [10000, 3000, 13000],
      [20000, 10000, 30000],
    ],
  );
  assert.equal(chargeTier(5000)?.bonusRate, 20);
  assert.equal(chargeTier(7000), null);
});

test("결제 금액을 포인트 전액·혼합·토스로 구분한다", () => {
  assert.deepEqual(paymentBreakdown(990, 990, 2000), {
    price: 990,
    pointsUsed: 990,
    cashAmount: 0,
    payMethod: "points",
  });
  assert.deepEqual(paymentBreakdown(990, 500, 500), {
    price: 990,
    pointsUsed: 500,
    cashAmount: 490,
    payMethod: "mixed",
  });
  assert.deepEqual(paymentBreakdown(990, 500, 200), {
    price: 990,
    pointsUsed: 200,
    cashAmount: 790,
    payMethod: "mixed",
  });
  assert.equal(paymentBreakdown(990, 0, 2000).payMethod, "toss");
});

test("가격·잔액·요청 포인트는 음수가 될 수 없다", () => {
  assert.throws(() => paymentBreakdown(-1, 0, 0), /상품 금액/);
  assert.throws(() => paymentBreakdown(990, -1, 0), /사용 포인트/);
  assert.throws(() => paymentBreakdown(990, 0, -1), /포인트 잔액/);
});

test("포인트 RPC 인자와 반환값을 정규화한다", async () => {
  const calls = [];
  const sb = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: name === "adjust_points" ? 1300 : 2, error: null };
    },
  };

  assert.equal(
    await adjustPoints(sb, { userId: "u1", delta: 300, type: "charge", ref: "o1" }),
    1300,
  );
  assert.equal(await adjustRegenTokens(sb, { userId: "u1", delta: 1 }), 2);
  assert.deepEqual(calls, [
    {
      name: "adjust_points",
      args: { p_user_id: "u1", p_delta: 300, p_type: "charge", p_ref: "o1" },
    },
    {
      name: "adjust_regen_tokens",
      args: { p_user_id: "u1", p_delta: 1 },
    },
  ]);
});

test("잔액 부족 오류를 식별한다", () => {
  assert.equal(isInsufficientPoints({ message: "insufficient_points" }), true);
  assert.equal(isInsufficientPoints({ details: "insufficient_regen_tokens" }), true);
  assert.equal(isInsufficientPoints({ message: "network" }), false);
});

test("계정 잔액과 최근 거래를 조회한다", async () => {
  const rows = {
    user_points: { data: { balance: 13000, regen_tokens: 2, updated_at: "2026-06-20T00:00:00Z" }, error: null },
    point_transactions: {
      data: [{ id: "t1", type: "bonus", amount: 3000, balance_after: 13000, ref: "o1", created_at: "2026-06-20T00:00:00Z" }],
      error: null,
    },
  };
  const sb = {
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        order() { return chain; },
        maybeSingle: async () => rows[table],
        limit: async () => rows[table],
      };
      return chain;
    },
  };

  assert.deepEqual(await getPointAccount(sb, "u1", 20), {
    enabled: true,
    balance: 13000,
    regenTokens: 2,
    updatedAt: "2026-06-20T00:00:00Z",
    transactions: [{ id: "t1", type: "bonus", amount: 3000, balanceAfter: 13000, ref: "o1", createdAt: "2026-06-20T00:00:00Z" }],
  });
});

test("포인트 행이 없으면 활성화된 0 잔액을 반환한다", async () => {
  const sb = {
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; }, order() { return chain; },
        maybeSingle: async () => ({ data: null, error: null }),
        limit: async () => ({ data: [], error: null }),
      };
      return chain;
    },
  };
  assert.equal((await getPointAccount(sb, "new-user")).balance, 0);
});

test("로그인 회원의 0포인트 계정을 멱등 생성한다", async () => {
  const calls = [];
  const sb = {
    from(table) {
      assert.equal(table, "user_points");
      return {
        async upsert(row, options) {
          calls.push({ row, options });
          return { error: null };
        },
      };
    },
  };
  await ensurePointAccount(sb, "u1");
  assert.deepEqual(calls, [{ row: { user_id: "u1" }, options: { onConflict: "user_id", ignoreDuplicates: true } }]);
});

test("스키마는 행 잠금·음수 방지·멱등 거래를 정의한다", () => {
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(schema, /create table if not exists user_points/i);
  assert.match(schema, /balance integer not null default 0 check \(balance >= 0\)/i);
  assert.match(schema, /for update/i);
  assert.match(schema, /idx_point_transactions_idempotent/i);
  assert.match(schema, /create or replace function adjust_regen_tokens/i);
});
