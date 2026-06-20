import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mergePointMembers, normalizeAdminPointChange } from "../api/_lib/adminPoints.js";

const html = readFileSync(new URL("../public/admin.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/admin.js", import.meta.url), "utf8");

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
