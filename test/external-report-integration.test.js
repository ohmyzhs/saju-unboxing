import test from "node:test";
import assert from "node:assert/strict";

import {
  assertExternalReportConfigured,
  createSajuWebReportOrder,
  getSajuWebReport,
  splitMarkdownReport,
} from "../apps/api/src/domain/externalReports.js";
import { externalReportsHandler } from "../apps/api/src/http/externalReports.js";

test("외부 리포트 상품은 결제 전에 운영 연동 설정을 검증한다", () => {
  assert.doesNotThrow(() => assertExternalReportConfigured("saju-analysis", {}));

  assert.throws(
    () => assertExternalReportConfigured("mz-dark-mudang-online", {}),
    (error) => error.statusCode === 503
      && error.code === "external_report_base_missing"
      && /외부 심층 리포트 서비스/.test(error.publicMessage),
  );

  assert.throws(
    () => assertExternalReportConfigured("mz-dark-mudang-online", {
      SAJU_WEB_API_BASE_URL: "https://saju-web.example",
    }),
    (error) => error.statusCode === 503
      && error.code === "external_report_key_missing"
      && /외부 심층 리포트 서비스/.test(error.publicMessage),
  );

  assert.doesNotThrow(() => assertExternalReportConfigured("mz-dark-mudang-online", {
    SAJU_WEB_API_BASE_URL: "https://saju-web.example",
    SAJU_WEB_API_KEY: "integration-secret",
  }));
});

test("외부 서비스 주문 생성부터 완성 리포트 수신까지 요청 계약을 따른다", async () => {
  const key = "integration-secret";
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    assert.equal(options.headers["X-API-Key"], key);
    if (options.method === "POST" && url === "https://saju-web.example/api/v1/orders") {
      calls.push(JSON.parse(options.body));
      return new Response(JSON.stringify({
        order_id: 77,
        status: "queued",
        share_token: "share77",
        created_at: "2026-07-10T22:00:00+09:00",
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if ((!options.method || options.method === "GET") && url === "https://saju-web.example/api/v1/orders/77/report") {
      return new Response(JSON.stringify({
        order_id: 77,
        status: "done",
        share_token: "share77",
        share_url: "https://reports.example/share/share77",
        report_ready: true,
        final_report: "# 운명 완전개봉\n\n## 타고난 결\n구체적인 본문\n\n## 앞으로의 흐름\n실천 조언",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
  };
  const env = {
    SAJU_WEB_API_BASE_URL: "https://saju-web.example",
    SAJU_WEB_API_KEY: key,
  };
  const order = {
    id: "local-order-1",
    product_id: "mz-dark-mudang-online",
    profile_name: "김가별",
    purchase_snapshot: {
      profile: {
        name: "김가별",
        birthDate: "1980-10-31",
        birthTime: "12:00",
        calendar: "solar",
        gender: "female",
      },
    },
  };

  const created = await createSajuWebReportOrder({ order, env, fetchImpl });
  assert.equal(created.externalOrderId, 77);
  assert.equal(created.shareUrl, "https://saju-web.example/share/share77");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].customer_name, "김가별");
  assert.equal(calls[0].report_template, "tight-v3");
  assert.equal(calls[0].auto_queue, true);

  const report = await getSajuWebReport({ externalOrderId: created.externalOrderId, env, fetchImpl });
  assert.equal(report.report_ready, true);
  assert.equal(report.status, "done");
  assert.deepEqual(splitMarkdownReport(report.final_report).map((section) => section.title), ["타고난 결", "앞으로의 흐름"]);
});

test("결제 완료 외부 리포트 주문은 POST retry로 다시 접수한다", async () => {
  const order = {
    id: "paid-1",
    user_id: "user-1",
    product_id: "mz-dark-mudang-online",
    status: "결제 완료",
    report_status: "failed",
    external_report: {},
  };
  const sb = {
    from(table) {
      assert.equal(table, "orders");
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: order, error: null }) };
            },
          };
        },
      };
    },
  };
  const req = {
    method: "POST",
    query: {},
    headers: {},
    body: { action: "retry", orderId: order.id },
  };
  const result = { statusCode: 0, headers: {}, body: null };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    end(value) { result.statusCode = this.statusCode; result.body = JSON.parse(value); },
  };

  await externalReportsHandler(req, res, {
    getSupabase: () => sb,
    getSessionUser: async () => ({ id: "user-1" }),
    fulfillPaidOrder: async () => ({
      required: true,
      status: "submitted",
      provider: "saju-web",
      externalOrderId: 91,
      shareToken: "share91",
      shareUrl: "https://reports.example/share/share91",
      externalStatus: "queued",
    }),
  });

  assert.equal(result.statusCode, 202);
  assert.equal(result.body.reportStatus, "generating");
  assert.equal(result.body.externalReport.externalOrderId, 91);
});
