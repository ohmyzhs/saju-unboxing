import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../apps/web/public/order-recovery.js");

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("주문 상태별 복구 행동을 구분한다", () => {
  assert.deepEqual(globalThis.OrderRecovery.capabilities({ status: "결제 진행중" }), {
    cancel: true,
    resume: true,
    viewReport: false,
    retryReport: false,
  });
  assert.equal(globalThis.OrderRecovery.capabilities({ status: "결제 완료", reportStatus: "complete" }).viewReport, true);
  assert.equal(globalThis.OrderRecovery.capabilities({ status: "결제 완료", reportStatus: "failed" }).retryReport, true);
  assert.deepEqual(
    globalThis.OrderRecovery.capabilities({ status: "결제 완료", reportStatus: "failed", hasReport: true }),
    { cancel: false, resume: false, viewReport: true, retryReport: true },
  );
  assert.equal(globalThis.OrderRecovery.capabilities({ status: "결제 완료", productId: "point-charge" }).retryReport, false);
  // 외부 리포트 생성 중: externalReport 동기화 전에도 상태 확인 진입점이 항상 있어야 한다.
  assert.deepEqual(
    globalThis.OrderRecovery.capabilities({ status: "결제 완료", reportStatus: "generating" }),
    { cancel: false, resume: false, viewReport: true, retryReport: false },
  );
});

test("현금·포인트·혼합 결제를 읽을 수 있게 표시한다", () => {
  assert.equal(globalThis.OrderRecovery.paymentSummary({ cashAmount: 1990, pointsUsed: 0 }), "현금 1,990원");
  assert.equal(globalThis.OrderRecovery.paymentSummary({ cashAmount: 0, pointsUsed: 1990 }), "1,990pt");
  assert.equal(globalThis.OrderRecovery.paymentSummary({ cashAmount: 990, pointsUsed: 1000 }), "현금 990원 + 1,000pt");
  assert.equal(globalThis.OrderRecovery.totalAmount({ amount: 1990, cashAmount: 0, pointsUsed: 1990 }), 1990);
  assert.equal(globalThis.OrderRecovery.totalAmount({ amount: 1990, pointsUsed: 1990 }), 1990);
});

test("결제 내역은 상세·취소·이어하기·리포트 복구 동작을 연결한다", () => {
  assert.ok(html.indexOf("order-recovery.js") < html.indexOf("app.js"));
  assert.match(app, /data-order-detail/);
  assert.match(app, /data-order-resume/);
  assert.match(app, /data-order-cancel/);
  assert.match(app, /data-order-report/);
  assert.match(app, /resumeOrderPayment/);
  assert.match(app, /cancelOrder/);
  assert.match(app, /retryOrderReport/);
  assert.match(app, /OrderRecovery\.totalAmount/);
});

test("운명 완전개봉 상품은 외부 리포트 재접수·상태 조회·보기 흐름을 가진다", () => {
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20260628090000_external_report_orders.sql", import.meta.url),
    "utf8",
  );
  const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
  assert.match(html, /data-product-id="mz-dark-mudang-online"/);
  assert.match(app, /"mz-dark-mudang-online":\s*\{/);
  assert.match(app, /externalReport:\s*true/);
  assert.match(app, /purchaseSnapshot\(context\)/);
  assert.match(app, /\/api\/external-reports\?orderId=/);
  assert.match(app, /action:\s*"retry"/);
  assert.match(app, /scheduleExternalReportPolling/);
  assert.match(app, /synced\.reportStatus === "complete" && url/);
  // 생성 진행률 파이프라인: 서버 generation 저장 + 주문 카드 단계/섹션 표시 + 권장 폴링 주기 반영
  assert.match(app, /generation:\s*result\.generation \|\| null/);
  assert.match(app, /externalGenerationLabel/);
  assert.match(app, /pollAfterMs/);
  // 완성 아카이브는 실제 존재하는 saveArchive로 로컬 보관함에 저장하고, 주문 화면을 즉시 갱신한다.
  assert.match(app, /saveArchive\(result\.archive,\s*\{\s*sync:\s*false\s*\}\)/);
  assert.doesNotMatch(app, /saveArchiveItem/);
  assert.match(admin, /"mz-dark-mudang-online":\s*\{/);
  assert.match(schema, /purchase_snapshot jsonb/i);
  assert.match(schema, /external_report jsonb/i);
  assert.match(schema, /report_status text/i);
  assert.match(migration, /alter table orders[\s\S]*purchase_snapshot jsonb/i);
  assert.match(migration, /alter table orders[\s\S]*external_report jsonb/i);
  assert.match(migration, /alter table orders[\s\S]*report_status text/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
  assert.equal(
    globalThis.OrderRecovery.capabilities({
      status: "결제 완료",
      reportStatus: "generating",
      externalReport: { shareUrl: "https://saju-web.example/share/t" },
    }).viewReport,
    true,
  );
});
