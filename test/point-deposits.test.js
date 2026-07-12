import test from "node:test";
import assert from "node:assert/strict";

import pointDepositsHandler, {
  DEFAULT_BANK_TRANSFER,
  depositConfirmedSmsText,
  depositRequestSmsText,
  makeDepositorCode,
  resolveBankTransfer,
} from "../apps/api/src/legacy/pointDeposits.js";
import { handleAdminDeposits } from "../apps/api/src/legacy/_lib/adminDeposits.js";
import { sendSms, solapiAuthHeader, isValidKoreanMobile } from "../apps/api/src/legacy/_lib/notify.js";

function makeSb(tables = {}) {
  const state = { tables };
  function matches(row, filters) {
    return Object.entries(filters).every(([k, v]) => String(row[k]) === String(v));
  }
  return {
    state,
    from(table) {
      return {
        select() {
          const q = { filters: {}, ids: null };
          const rows = () => (state.tables[table] || [])
            .filter((row) => matches(row, q.filters))
            .filter((row) => (q.ids ? q.ids.map(String).includes(String(row.id)) : true));
          const chain = {
            eq(k, v) { q.filters[k] = v; return chain; },
            order() { return chain; },
            in(k, values) { q.ids = values; return Promise.resolve({ data: rows(), error: null }); },
            limit() { return Promise.resolve({ data: rows(), error: null }); },
            maybeSingle() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
          };
          return chain;
        },
        insert(row) {
          (state.tables[table] ||= []).push({ ...row });
          return Promise.resolve({ error: null });
        },
        update(patch) {
          const q = { filters: {} };
          const apply = () => {
            const rows = (state.tables[table] || []).filter((row) => matches(row, q.filters));
            rows.forEach((row) => Object.assign(row, patch));
            return rows.map((row) => ({ ...row }));
          };
          const chain = {
            eq(k, v) { q.filters[k] = v; return chain; },
            select() { return Promise.resolve({ data: apply(), error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: apply(), error: null }).then(resolve, reject); },
          };
          return chain;
        },
      };
    },
  };
}

function makeRes(result) {
  return {
    setHeader() {},
    end(value) { result.statusCode = this.statusCode; result.body = JSON.parse(value); },
  };
}

test("계좌 설정은 어드민 저장값 우선, 없으면 기본 카카오뱅크", () => {
  assert.deepEqual(resolveBankTransfer({}), { ...DEFAULT_BANK_TRANSFER });
  assert.equal(resolveBankTransfer({}).account, "3333-26-3204251");
  assert.deepEqual(
    resolveBankTransfer({ bank_transfer: { bank: "국민은행", account: "123-456", holder: "홍길동" } }),
    { bank: "국민은행", account: "123-456", holder: "홍길동" },
  );
  assert.match(makeDepositorCode("김가별"), /^김가\d{4}$/);
  assert.match(makeDepositorCode(""), /^고객\d{4}$/);
});

test("입금 신청은 티어를 스냅샷하고 계좌·입금자명이 담긴 SMS를 발송한다", async () => {
  const sb = makeSb({ point_deposit_requests: [], users: [{ id: "u1" }] });
  const sent = [];
  const result = { statusCode: 0 };
  await pointDepositsHandler(
    { method: "POST", query: {}, headers: {}, body: { amount: 10000, phone: "010-1234-5678" } },
    makeRes(result),
    {
      getSupabase: () => sb,
      getSessionUser: async () => ({ id: "u1", nickname: "김가별" }),
      loadSiteConfig: async () => ({}),
      sendSms: async ({ to, text }) => { sent.push({ to, text }); return { ok: true }; },
    },
  );
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.request.points, 13000);
  assert.equal(result.body.request.bonus, 3000);
  assert.equal(result.body.request.status, "awaiting_deposit");
  assert.equal(result.body.sms, "sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "01012345678");
  assert.match(sent[0].text, /카카오뱅크 3333-26-3204251/);
  assert.match(sent[0].text, new RegExp(result.body.request.depositorCode));
  assert.match(sent[0].text, /13,000pt/);
  // users.phone 저장(다음 신청 프리필용)
  assert.equal(sb.state.tables.users[0].phone, "01012345678");
});

test("입금 대기 신청이 있으면 중복 신청을 409로 막는다", async () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const sb = makeSb({
    point_deposit_requests: [{ id: "d1", user_id: "u1", status: "awaiting_deposit", expires_at: future, amount: 5000, points: 6000, bonus: 1000, depositor_code: "김가0001", phone: "01011112222", notify_log: [] }],
    users: [{ id: "u1" }],
  });
  const result = { statusCode: 0 };
  await pointDepositsHandler(
    { method: "POST", query: {}, headers: {}, body: { amount: 10000, phone: "01012345678" } },
    makeRes(result),
    { getSupabase: () => sb, getSessionUser: async () => ({ id: "u1" }), loadSiteConfig: async () => ({}), sendSms: async () => ({ ok: true }) },
  );
  assert.equal(result.statusCode, 409);
  assert.equal(result.body.request.id, "d1");
});

test("관리자 승인은 charge+bonus 지급, 완료 SMS, 중복 승인 차단까지 보장한다", async () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const sb = makeSb({
    point_deposit_requests: [{ id: "d2", user_id: "u1", status: "awaiting_deposit", expires_at: future, amount: 20000, points: 30000, bonus: 10000, depositor_code: "김가0002", phone: "01012345678", notify_log: [], created_at: new Date().toISOString() }],
    users: [{ id: "u1", nickname: "김가별" }],
  });
  const adjustments = [];
  const sent = [];
  const deps = {
    loadSiteConfig: async () => ({}),
    adjustPoints: async (_sb, { delta, type, ref }) => { adjustments.push({ delta, type, ref }); return 41000; },
    sendSms: async ({ text }) => { sent.push(text); return { ok: true }; },
  };
  const first = { statusCode: 0 };
  await handleAdminDeposits({ method: "POST", body: { id: "d2", action: "confirm" } }, makeRes(first), sb, deps);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.balance, 41000);
  assert.deepEqual(adjustments, [
    { delta: 20000, type: "charge", ref: "d2" },
    { delta: 10000, type: "bonus", ref: "d2" },
  ]);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /30,000pt 충전/);
  assert.match(sent[0], /41,000pt/);

  // 두 번째 승인 시도 → 이미 처리됨(포인트 재지급 없음)
  const second = { statusCode: 0 };
  await handleAdminDeposits({ method: "POST", body: { id: "d2", action: "confirm" } }, makeRes(second), sb, deps);
  assert.equal(second.statusCode, 409);
  assert.equal(adjustments.length, 2);
});

test("관리자 거절은 포인트 지급 없이 안내 문자만 보낸다", async () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const sb = makeSb({
    point_deposit_requests: [{ id: "d3", user_id: "u1", status: "awaiting_deposit", expires_at: future, amount: 5000, points: 6000, bonus: 1000, depositor_code: "고객0003", phone: "01012345678", notify_log: [], created_at: new Date().toISOString() }],
    users: [{ id: "u1" }],
  });
  const adjustments = [];
  const sent = [];
  const result = { statusCode: 0 };
  await handleAdminDeposits({ method: "POST", body: { id: "d3", action: "reject", memo: "입금 미확인" } }, makeRes(result), sb, {
    loadSiteConfig: async () => ({}),
    adjustPoints: async () => { adjustments.push(1); return 0; },
    sendSms: async ({ text }) => { sent.push(text); return { ok: true }; },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(adjustments.length, 0);
  assert.equal(sb.state.tables.point_deposit_requests[0].status, "rejected");
  assert.match(sent[0], /확인되지 않아/);
});

test("본인 취소는 입금 대기 상태에서만 가능하다", async () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const sb = makeSb({
    point_deposit_requests: [{ id: "d4", user_id: "u1", status: "awaiting_deposit", expires_at: future, amount: 5000, points: 6000, bonus: 1000, depositor_code: "고객0004", phone: "01012345678", notify_log: [] }],
    users: [{ id: "u1" }],
  });
  const result = { statusCode: 0 };
  await pointDepositsHandler(
    { method: "POST", query: {}, headers: {}, body: { action: "cancel", id: "d4" } },
    makeRes(result),
    { getSupabase: () => sb, getSessionUser: async () => ({ id: "u1" }), loadSiteConfig: async () => ({}) },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(sb.state.tables.point_deposit_requests[0].status, "cancelled");
});

test("Solapi 발송: HMAC 헤더 규격과 미설정 시 무해한 실패", async () => {
  const header = solapiAuthHeader({ apiKey: "KEY", apiSecret: "SECRET", date: "2026-07-12T00:00:00.000Z", salt: "abcd" });
  assert.match(header, /^HMAC-SHA256 apiKey=KEY, date=2026-07-12T00:00:00\.000Z, salt=abcd, signature=[0-9a-f]{64}$/);

  const calls = [];
  const ok = await sendSms({
    to: "010-1234-5678",
    text: "테스트",
    env: { SOLAPI_API_KEY: "KEY", SOLAPI_API_SECRET: "SECRET", SOLAPI_SENDER: "01000000000", SOLAPI_BASE_URL: "https://solapi.test" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ groupInfo: { _id: "g1", count: { registeredFailed: 0 } } }), { status: 200 });
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(calls[0].url, "https://solapi.test/messages/v4/send-many/detail");
  assert.match(calls[0].options.headers.Authorization, /^HMAC-SHA256 apiKey=KEY/);
  assert.deepEqual(JSON.parse(calls[0].options.body).messages[0], { to: "01012345678", from: "01000000000", text: "테스트" });

  const missing = await sendSms({ to: "01012345678", text: "x", env: {} });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /SOLAPI_API_KEY/);
  const noSender = await sendSms({ to: "01012345678", text: "x", env: { SOLAPI_API_KEY: "k", SOLAPI_API_SECRET: "s" } });
  assert.equal(noSender.ok, false);
  assert.match(noSender.error, /SOLAPI_SENDER/);
  assert.equal(isValidKoreanMobile("01012345678"), true);
  assert.equal(isValidKoreanMobile("021234567"), false);
});

test("SMS 문안: 입금 안내와 완료 안내에 핵심 정보가 모두 들어간다", () => {
  const guide = depositRequestSmsText({
    bank: DEFAULT_BANK_TRANSFER,
    amount: 10000,
    depositorCode: "김가1234",
    points: 13000,
    expiresAt: new Date("2026-07-15T03:00:00Z").toISOString(),
  });
  assert.match(guide, /\[사주언박싱\] 무통장입금 안내/);
  assert.match(guide, /카카오뱅크 3333-26-3204251 \(에스랩\)/);
  assert.match(guide, /금액 10,000원/);
  assert.match(guide, /"김가1234"/);
  const done = depositConfirmedSmsText({ points: 13000, bonus: 3000, balance: 15000 });
  assert.match(done, /입금 확인 완료/);
  assert.match(done, /13,000pt 충전/);
  assert.match(done, /보너스 3,000pt/);
  assert.match(done, /잔액 15,000pt/);
});

test("프론트·어드민 UI가 무통장입금 API와 연결돼 있다", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
  const adminHtml = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
  const gateway = readFileSync(new URL("../apps/api/src/gateway.js", import.meta.url), "utf8");

  assert.match(gateway, /\/api\/points\/deposit/);
  assert.match(html, /data-deposit-area/);
  assert.match(app, /chooseChargeMethod/);
  assert.match(app, /\/api\/points\/deposit/);
  assert.match(app, /depositorCode/);
  assert.match(adminHtml, /data-admin-tab="deposits"/);
  assert.match(adminHtml, /data-deposit-bank-form/);
  assert.match(admin, /\/api\/admin\/deposits/);
  assert.match(admin, /loadAdminDeposits/);
  assert.match(admin, /bank_transfer/);
});
