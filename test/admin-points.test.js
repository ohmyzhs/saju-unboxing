import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadAdminPointPayload, mergePointMembers, normalizeAdminPointChange } from "../apps/api/src/legacy/_lib/adminPoints.js";

const html = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");

test("관리자 화면에 회원 포인트 탭과 조정 폼이 있다", () => {
  assert.match(html, /data-admin-tab="points"/);
  assert.match(html, /data-point-adjust/);
  assert.match(html, /data-regen-adjust/);
  assert.match(app, /loadAdminPoints/);
});

test("주문 계정 라벨을 포인트 회원 잔액에 합친다", () => {
  const members = mergePointMembers(
    [{ user_id: "u1", balance: 13000, regen_tokens: 2, updated_at: "2026-06-20T01:00:00Z" }],
    [
      { user_id: "u1", user_label: "회원A", user_provider: "email", created_at: "2026-06-20T00:00:00Z" },
      { user_id: "u1", user_label: "옛이름", user_provider: "email", created_at: "2026-06-19T00:00:00Z" },
    ],
  );
  assert.deepEqual(members[0], {
    userId: "u1",
    userLabel: "회원A",
    userProvider: "email",
    balance: 13000,
    regenTokens: 2,
    updatedAt: "2026-06-20T01:00:00Z",
  });
});

test("관리자 포인트 조정은 0이 아닌 정수와 메모를 정규화한다", () => {
  assert.deepEqual(normalizeAdminPointChange({ operation: "adjust", userId: "u1", amount: "-500", memo: "오입금 회수" }), {
    operation: "adjust",
    userId: "u1",
    amount: -500,
    memo: "오입금 회수",
  });
  assert.throws(() => normalizeAdminPointChange({ operation: "adjust", userId: "u1", amount: 0 }), /0이 아닌 정수/);
  assert.throws(() => normalizeAdminPointChange({ operation: "regen", userId: "", amount: 1 }), /회원을 선택/);
  assert.throws(() => normalizeAdminPointChange({ operation: "regen", userId: "u1", amount: -1 }), /1 이상의 정수/);
});

test("회원 상세 조회는 전체 회원 목록을 다시 읽지 않는다", async () => {
  let listCalls = 0;
  const payload = await loadAdminPointPayload({}, "u1", {
    getAccount: async () => ({ balance: 5000, regenTokens: 1, transactions: [] }),
    listMembers: async () => { listCalls += 1; return []; },
  });

  assert.equal(listCalls, 0);
  assert.equal(payload.selectedUserId, "u1");
  assert.equal(payload.members, null);
  assert.equal(payload.account.balance, 5000);
});

test("관리자 포인트 UI는 안전한 폼 초기화와 상세 전용 새로고침을 사용한다", () => {
  assert.match(html, /data-point-member-search/);
  assert.match(html, /data-point-quick/);
  assert.match(app, /const form = event\.currentTarget/);
  assert.match(app, /loadAdminPointDetail/);
  assert.doesNotMatch(app, /event\.currentTarget\.reset\(\)/);
  assert.match(html, /data-point-quick[^>]*disabled/);
  assert.match(html, /data-point-adjust>[\s\S]*?input[^>]*disabled/);
  assert.match(html, /data-regen-adjust>[\s\S]*?input[^>]*disabled/);
});
