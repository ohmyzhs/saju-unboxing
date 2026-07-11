import test from "node:test";
import assert from "node:assert/strict";

import {
  assertExternalReportConfigured,
  createSajuWebReportOrder,
  getSajuWebOrderStatus,
  getSajuWebReport,
  publicGenerationStatus,
  retrySajuWebGeneration,
  splitMarkdownReport,
} from "../apps/api/src/domain/externalReports.js";
import { externalReportsHandler } from "../apps/api/src/http/externalReports.js";

function makeRes(result) {
  return {
    setHeader(name, value) { result.headers[name] = value; },
    end(value) { result.statusCode = this.statusCode; result.body = JSON.parse(value); },
  };
}

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

test("주문 접수는 franchise 주문번호를 Idempotency-Key로 보낸다", async () => {
  let seenKey = "";
  const fetchImpl = async (url, options = {}) => {
    seenKey = options.headers["Idempotency-Key"];
    return new Response(JSON.stringify({ order_id: 1, status: "queued", share_token: "t" }), { status: 201 });
  };
  await createSajuWebReportOrder({
    order: {
      id: "2607110001",
      product_id: "mz-dark-mudang-online",
      purchase_snapshot: { profile: { name: "김가별", birthDate: "1980-10-31" } },
    },
    env: { SAJU_WEB_API_BASE_URL: "https://saju-web.example", SAJU_WEB_API_KEY: "k" },
    fetchImpl,
  });
  assert.equal(seenKey, "saju-franchise-2607110001");
});

test("상태 조회와 재시도는 saju-web 신규 API 경로를 사용한다", async () => {
  const env = { SAJU_WEB_API_BASE_URL: "https://saju-web.example", SAJU_WEB_API_KEY: "k" };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push(`${options.method || "GET"} ${url}`);
    return new Response(JSON.stringify({ order_id: 5, status: "running", report_ready: false, generation: { status: "generating" } }), { status: 200 });
  };
  await getSajuWebOrderStatus({ externalOrderId: 5, env, fetchImpl });
  await retrySajuWebGeneration({ externalOrderId: 5, env, fetchImpl });
  assert.deepEqual(calls, [
    "GET https://saju-web.example/api/v1/orders/5",
    "POST https://saju-web.example/api/v1/orders/5/retry",
  ]);
});

test("generation 상태는 내부 정보 없이 진행률만 노출한다", () => {
  const publicView = publicGenerationStatus({
    order_id: 5,
    status: "generating",
    terminal: false,
    retryable: false,
    poll_after_ms: 3000,
    template: { key: "tight-v3", release_key: "internal" },
    progress: {
      percent: 58,
      total_sections: 12,
      completed_sections: 7,
      current_section: { index: 8, title: "재물의 흐름" },
      sections: [{ prompt: "internal-prompt" }],
    },
    job: { id: 1, status: "running" },
    error: "provider raw error",
    urls: { retry: "https://saju-web.example/api/v1/orders/5/retry" },
    updated_at: "2026-07-11T00:00:00+09:00",
  });
  assert.deepEqual(publicView, {
    status: "generating",
    terminal: false,
    retryable: false,
    pollAfterMs: 3000,
    percent: 58,
    totalSections: 12,
    completedSections: 7,
    currentSection: { index: 8, title: "재물의 흐름" },
    updatedAt: "2026-07-11T00:00:00+09:00",
  });
  assert.equal(publicGenerationStatus(null), null);
});

function stubSb(order, log = []) {
  return {
    from(table) {
      return {
        select() {
          return { eq() { return { maybeSingle: async () => ({ data: order, error: null }) }; } };
        },
        update(patch) {
          log.push({ table, patch });
          return { eq: async () => ({ error: null }) };
        },
        upsert(row) {
          log.push({ table, upsert: row });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

test("생성 중 폴링은 상태 API만 호출하고 진행률을 돌려준다", async () => {
  const order = {
    id: "gen-1",
    user_id: null,
    product_id: "mz-dark-mudang-online",
    report_status: "generating",
    external_report: { externalOrderId: 42, shareUrl: "https://saju-web.example/share/t42" },
  };
  const log = [];
  let reportCalls = 0;
  const result = { statusCode: 0, headers: {}, body: null };
  await externalReportsHandler(
    { method: "GET", query: { orderId: order.id }, headers: {} },
    makeRes(result),
    {
      getSupabase: () => stubSb(order, log),
      getSessionUser: async () => null,
      getSajuWebOrderStatus: async () => ({
        order_id: 42,
        status: "running",
        report_ready: false,
        share_token: "t42",
        share_url: "https://saju-web.example/share/t42",
        generation: {
          status: "generating",
          poll_after_ms: 3000,
          progress: { percent: 41, total_sections: 12, completed_sections: 5, current_section: { index: 6, title: "관계의 결" } },
        },
      }),
      getSajuWebReport: async () => { reportCalls += 1; return {}; },
    },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.reportStatus, "generating");
  assert.equal(result.body.generation.percent, 41);
  assert.equal(result.body.generation.completedSections, 5);
  assert.equal(reportCalls, 0, "완성 전에는 본문 API를 호출하지 않는다");
  assert.equal(result.body.archive, null);
});

test("report_ready가 되면 본문을 한 번 받아 보관함 아카이브를 만든다", async () => {
  const order = {
    id: "gen-2",
    user_id: "user-7",
    product_id: "mz-dark-mudang-online",
    profile_name: "김가별",
    purchase_snapshot: { profile: { id: "p1", name: "김가별" } },
    report_status: "generating",
    external_report: { externalOrderId: 42 },
  };
  const log = [];
  const result = { statusCode: 0, headers: {}, body: null };
  await externalReportsHandler(
    { method: "GET", query: { orderId: order.id }, headers: {} },
    makeRes(result),
    {
      getSupabase: () => stubSb(order, log),
      getSessionUser: async () => ({ id: "user-7" }),
      getSajuWebOrderStatus: async () => ({ order_id: 42, status: "done", report_ready: true, generation: { status: "completed", progress: { percent: 100 } } }),
      getSajuWebReport: async () => ({
        order_id: 42,
        status: "done",
        report_ready: true,
        share_token: "t42",
        share_url: "https://saju-web.example/share/t42",
        final_report: "# 운명 완전개봉\n\n## 타고난 결\n본문\n\n## 앞으로의 흐름\n조언",
      }),
    },
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.reportStatus, "complete");
  assert.equal(result.body.archive.id, "external-gen-2");
  assert.deepEqual(result.body.archive.analysis.sections.map((s) => s.title), ["타고난 결", "앞으로의 흐름"]);
  const archiveUpsert = log.find((entry) => entry.table === "user_data");
  assert.equal(archiveUpsert.upsert.user_id, "user-7");
  const orderPatch = log.find((entry) => entry.table === "orders");
  assert.equal(orderPatch.patch.report_status, "complete");
});

test("실패한 외부 주문 retry는 saju-web 재시도 API를 먼저 쓴다", async () => {
  const order = {
    id: "gen-3",
    user_id: null,
    product_id: "mz-dark-mudang-online",
    status: "결제 완료",
    report_status: "failed",
    external_report: { externalOrderId: 42, shareToken: "t42" },
  };
  const log = [];
  let fulfillCalls = 0;
  const result = { statusCode: 0, headers: {}, body: null };
  await externalReportsHandler(
    { method: "POST", query: {}, headers: {}, body: { action: "retry", orderId: order.id } },
    makeRes(result),
    {
      getSupabase: () => stubSb(order, log),
      getSessionUser: async () => null,
      retrySajuWebGeneration: async ({ externalOrderId }) => {
        assert.equal(externalOrderId, 42);
        return { status: "queued", progress: { percent: 0 } };
      },
      fulfillPaidOrder: async () => { fulfillCalls += 1; return {}; },
    },
  );
  assert.equal(result.statusCode, 202);
  assert.equal(result.body.fulfillment.reused, true);
  assert.equal(result.body.externalReport.externalOrderId, 42);
  assert.equal(fulfillCalls, 0, "같은 외부 주문 재시도가 가능하면 새 주문을 만들지 않는다");
});

test("구버전 saju-web(재시도 404)이면 기존 재접수 경로로 폴백한다", async () => {
  const order = {
    id: "gen-4",
    user_id: null,
    product_id: "mz-dark-mudang-online",
    status: "결제 완료",
    report_status: "failed",
    external_report: { externalOrderId: 42 },
  };
  const result = { statusCode: 0, headers: {}, body: null };
  await externalReportsHandler(
    { method: "POST", query: {}, headers: {}, body: { action: "retry", orderId: order.id } },
    makeRes(result),
    {
      getSupabase: () => stubSb(order),
      getSessionUser: async () => null,
      retrySajuWebGeneration: async () => {
        const error = new Error("Not Found");
        error.statusCode = 404;
        throw error;
      },
      fulfillPaidOrder: async () => ({
        required: true,
        status: "submitted",
        provider: "saju-web",
        externalOrderId: 43,
        shareToken: "t43",
        externalStatus: "queued",
      }),
    },
  );
  assert.equal(result.statusCode, 202);
  assert.equal(result.body.externalReport.externalOrderId, 43);
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
