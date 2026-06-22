import test from "node:test";
import assert from "node:assert/strict";

import { releaseDailyRegeneration, reserveDailyRegeneration } from "../apps/api/src/legacy/_lib/points.js";

test("재생성 요청과 토큰이 있으면 토큰 하나를 예약한다", async () => {
  const calls = [];
  const state = await reserveDailyRegeneration({
    requested: true,
    userId: "u1",
    sb: {},
    tokenBalance: 2,
    adjust: async (entry) => { calls.push(entry); return 1; },
  });
  assert.deepEqual(state, { regenerate: true, reserved: true, remainingTokens: 1 });
  assert.deepEqual(calls, [{ userId: "u1", delta: -1 }]);
});

test("토큰이 없거나 미로그인이면 기존 캐시 경로를 유지한다", async () => {
  let called = false;
  const adjust = async () => { called = true; return 0; };
  assert.equal((await reserveDailyRegeneration({ requested: true, userId: "u1", sb: {}, tokenBalance: 0, adjust })).regenerate, false);
  assert.equal((await reserveDailyRegeneration({ requested: true, userId: null, sb: {}, tokenBalance: 2, adjust })).regenerate, false);
  assert.equal(called, false);
});

test("생성 실패 시 예약한 토큰을 반환한다", async () => {
  const calls = [];
  const remaining = await releaseDailyRegeneration({
    reserved: true,
    userId: "u1",
    sb: {},
    adjust: async (entry) => { calls.push(entry); return 2; },
  });
  assert.equal(remaining, 2);
  assert.deepEqual(calls, [{ userId: "u1", delta: 1 }]);
});
