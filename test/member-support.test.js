import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizePhone, validateEmailSignup } from "../apps/api/src/legacy/session.js";
import { mapSupportInquiry, normalizeSupportInput } from "../apps/api/src/legacy/support.js";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
const supportApi = readFileSync(new URL("../apps/api/src/legacy/support.js", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260710100000_member_support.sql", import.meta.url), "utf8");

test("이메일 회원가입은 닉네임·휴대폰·비밀번호 확인을 필수 검증한다", () => {
  assert.equal(normalizePhone("010-1234-5678"), "01012345678");
  assert.deepEqual(validateEmailSignup({
    nickname: "가별",
    phone: "010-1234-5678",
    password: "password8",
    passwordConfirm: "password8",
    consent: true,
  }), { nickname: "가별", phone: "01012345678", password: "password8" });
  assert.match(validateEmailSignup({ nickname: "가별", phone: "010", password: "password8", passwordConfirm: "password8", consent: true }).message, /휴대폰/);
  assert.match(validateEmailSignup({ nickname: "가별", phone: "01012345678", password: "password8", passwordConfirm: "different", consent: true }).message, /일치/);
  assert.match(validateEmailSignup({ nickname: "가별", phone: "01012345678", password: "password8", passwordConfirm: "password8" }).message, /동의/);
});

test("회원가입 전용 화면은 요청한 계정 정보를 모두 수집한다", () => {
  for (const field of ["email", "password", "passwordConfirm", "nickname", "phone", "consent"]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(app, /action:\s*"signup"/);
  assert.match(app, /passwordConfirm, nickname, phone/);
  assert.match(css, /\.mypage-id-text small[\s\S]*white-space:\s*normal/);
});

test("1:1 문의 입력은 유형·제목·본문을 정규화하고 답변 데이터를 매핑한다", () => {
  assert.deepEqual(normalizeSupportInput({ category: "refund", title: "  결제   문의  ", content: "주문번호 1234 환불을 요청합니다." }), {
    category: "refund",
    title: "결제 문의",
    content: "주문번호 1234 환불을 요청합니다.",
  });
  assert.match(normalizeSupportInput({ title: "x", content: "짧음" }).message, /제목/);
  assert.equal(mapSupportInquiry({ id: "q1", status: "answered", answer: "처리했습니다." }).answer, "처리했습니다.");
});

test("사용자·관리자 화면과 DB가 비공개 문의 작성·답변 흐름을 연결한다", () => {
  assert.match(html, /data-support-form/);
  assert.match(html, /data-support-list/);
  assert.match(app, /\/api\/support/);
  assert.match(supportApi, /getSessionUser\(req\)/);
  assert.match(supportApi, /\.eq\("user_id", userId\)/);
  assert.match(adminHtml, /data-admin-tab="support"/);
  assert.match(adminHtml, /data-admin-support-form/);
  // 2단 분할 대신 목록 → 팝오버 레이어 (2026-07 UI 정비)
  assert.match(adminHtml, /data-support-popover/);
  assert.doesNotMatch(adminHtml, /admin-support-grid/);
  assert.match(admin, /openSupportPopover/);
  assert.match(admin, /\/api\/admin\/support/);
  for (const sql of [schema, migration]) {
    assert.match(sql, /create table if not exists support_inquiries/i);
    assert.match(sql, /user_id text not null/i);
    assert.match(sql, /alter table support_inquiries\s+add column if not exists contact_email text/i);
    assert.match(sql, /status in \('received', 'in_progress', 'answered', 'closed'\)/i);
    assert.match(sql, /alter table users\s+add column if not exists phone text/i);
  }
});
