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

test("MZ다크무당 온라인뷰 상품은 외부 리포트 스냅샷과 리포트 보기 흐름을 가진다", () => {
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
  assert.match(html, /data-product-id="mz-dark-mudang-online"/);
  assert.match(app, /"mz-dark-mudang-online":\s*\{/);
  assert.match(app, /externalReport:\s*true/);
  assert.match(app, /purchaseSnapshot\(context\)/);
  assert.match(app, /\/api\/external-reports\?orderId=/);
  assert.match(admin, /"mz-dark-mudang-online":\s*\{/);
  assert.match(schema, /purchase_snapshot jsonb/i);
  assert.match(schema, /external_report jsonb/i);
  assert.match(schema, /report_status text/i);
  assert.equal(
    globalThis.OrderRecovery.capabilities({
      status: "결제 완료",
      reportStatus: "generating",
      externalReport: { shareUrl: "https://saju-web.example/share/t" },
    }).viewReport,
    true,
  );
});
