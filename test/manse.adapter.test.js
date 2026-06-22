// Phase 5 — 어댑터/통합. 기존 4개 컨텍스트 빌더가 로컬 엔진 출력을 그대로 소비하는지(계약).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeManseLocal } from "../apps/api/src/legacy/_lib/manse/index.js";
import { buildSajuContext, buildCompatContext, buildCycleContext, buildYearlyContext } from "../apps/api/src/legacy/_lib/sajuContext.js";

const TODAY = new Date("2026-06-20T12:00:00Z");
const PROFILE = { gender: "female", birthDate: "1992-03-14", birthTime: "05:30", calendar: "solar" };
const manse = computeManseLocal(PROFILE, TODAY);

test("계약 — ok/cost0/summary/full + 엔진 메타", () => {
  assert.equal(manse.ok, true);
  assert.equal(manse.cost, 0);
  assert.ok(manse.summary && manse.full);
  assert.equal(manse.meta.engine.name, "self-integrated-manse");
});

test("buildSajuContext — 비어있지 않은 핵심 필드", () => {
  const c = buildSajuContext(manse);
  assert.match(c.대상.일간, /己/); // 己
  assert.equal(c.원국.일주.간지, "己丑");
  assert.deepEqual(c.오행분포, { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 });
  assert.equal(c.용신체계.용신, "토"); // 土
  assert.ok(c.대운.흐름.length >= 8); // 대운 10주기
  assert.ok(c.대운.현재); // currentDaeun
  assert.ok(c.개운파생근거 && c.개운파생근거.color !== "산출 보류");
  assert.ok(Array.isArray(c.형충회합));
});

test("buildCycleContext — 대운 타임라인", () => {
  const c = buildCycleContext(manse);
  assert.ok(c.대운타임라인.length >= 8);
  assert.equal(c.대운타임라인[0].간지, "壬寅");
});

test("buildYearlyContext — 세운 + 올해월운", () => {
  const c = buildYearlyContext(manse);
  assert.equal(c.세운.length, 10);
  assert.equal(c.세운[0].간지, "丙午");
  assert.equal(c.올해월운.length, 12);
});

test("buildCompatContext — 2인 비교", () => {
  const other = computeManseLocal({ gender: "male", birthDate: "1988-03-05", birthTime: "12:00", calendar: "solar" }, TODAY);
  const c = buildCompatContext(manse, other, "김지은", "박철수");
  assert.ok(c.비교.일간관계);
  assert.ok(c.A.일간 && c.B.일간);
});

test("외부 만세력 HTTP 호출 없음 — fetch 미사용", async () => {
  const orig = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => { called = true; throw new Error("no network"); };
  try { computeManseLocal(PROFILE, TODAY); } finally { globalThis.fetch = orig; }
  assert.equal(called, false);
});
