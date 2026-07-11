import {
  externalReportProduct,
  getSajuWebOrderStatus,
  getSajuWebReport,
  publicGenerationStatus,
  retrySajuWebGeneration,
  splitMarkdownReport,
} from "../domain/externalReports.js";
import { fulfillPaidOrder } from "../domain/orderFulfillment.js";
import { readJson, sendJson } from "../legacy/_lib/http.js";
import { getSessionUser } from "../legacy/_lib/sessions.js";
import { getSupabase } from "../legacy/_lib/supabase.js";

function asObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function firstHeadline(markdown) {
  const line = String(markdown || "").split(/\n/).find((row) => row.trim() && !row.startsWith("## "));
  return String(line || "").replace(/^#+\s*/, "").trim().slice(0, 160);
}

function buildArchiveSnapshot(order, reportPayload, externalReport) {
  const product = externalReportProduct(order.product_id);
  const snapshot = asObject(order.purchase_snapshot);
  const finalReport = reportPayload.final_report || reportPayload.report_json?.final_report || "";
  const sections = splitMarkdownReport(finalReport);
  const createdAt = Date.now();
  return {
    id: `external-${order.id}`,
    productId: order.product_id,
    productName: product?.name || order.product_id || "외부 리포트",
    profileId: snapshot.profile?.id || null,
    profileName: order.profile_name || snapshot.profile?.name || "",
    orderId: order.id,
    createdAt,
    updatedAt: createdAt,
    paymentStatus: "결제 완료",
    generationStatus: "complete",
    externalReport,
    reportUrl: reportPayload.share_url || externalReport.shareUrl || "",
    analysis: {
      headline: firstHeadline(finalReport) || "saju-web 온라인 리포트가 생성되었습니다.",
      summary: finalReport.slice(0, 1200),
      sections,
      externalReport,
    },
  };
}

async function upsertUserArchive(sb, userId, archive) {
  if (!userId || !archive?.id) return;
  await sb.from("user_data").upsert({
    user_id: userId,
    kind: "archive",
    id: archive.id,
    data: archive,
    updated_at: new Date().toISOString(),
  });
}

function publicExternalError(error, fallback) {
  console.error(`[external-report] ${String(error?.message || error).slice(0, 300)}`);
  return error?.publicMessage || fallback;
}

export async function externalReportsHandler(req, res, dependencies = {}) {
  if (!["GET", "POST"].includes(req.method)) return sendJson(res, 405, { message: "GET/POST only" });
  try {
    const body = req.method === "POST" ? await readJson(req) : {};
    const orderId = String(req.query?.orderId || body.orderId || "").trim();
    if (!orderId) return sendJson(res, 400, { message: "주문번호가 필요합니다." });
    const sb = (dependencies.getSupabase || getSupabase)();
    if (!sb) return sendJson(res, 503, { message: "데이터베이스를 사용할 수 없습니다." });
    const user = await (dependencies.getSessionUser || getSessionUser)(req);
    const { data: order, error } = await sb
      .from("orders")
      .select(req.method === "POST" ? "*" : "id, user_id, product_id, profile_name, purchase_snapshot, external_report, report_status, fulfillment_status, fulfillment_error")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return sendJson(res, 404, { message: "주문을 찾지 못했습니다." });
    if (order.user_id && (!user?.id || String(user.id) !== String(order.user_id))) {
      return sendJson(res, 403, { message: "본인 주문만 확인할 수 있습니다." });
    }
    if (!externalReportProduct(order.product_id)) {
      return sendJson(res, 400, { message: "외부 심층 리포트 상품 주문이 아닙니다." });
    }

    if (req.method === "POST") {
      if (body.action !== "retry") return sendJson(res, 400, { message: "지원하지 않는 작업입니다." });
      const existing = asObject(order.external_report);

      // 1순위: 이미 접수된 외부 주문이 실패한 경우 saju-web 쪽 재시도(새 주문 생성 없이 같은 주문 재생성).
      // 구버전 saju-web(404)이나 재시도 불가 상태(409)면 기존 fulfillment 경로로 폴백한다.
      if (existing.externalOrderId && order.report_status === "failed") {
        try {
          const retryGeneration = dependencies.retrySajuWebGeneration || retrySajuWebGeneration;
          const generationPayload = await retryGeneration({ externalOrderId: existing.externalOrderId });
          const nextExternal = { ...existing, status: "queued", retriedAt: new Date().toISOString() };
          const updated = await sb.from("orders").update({
            external_report: nextExternal,
            report_status: "generating",
            fulfillment_error: null,
          }).eq("id", order.id);
          if (updated.error) throw updated.error;
          return sendJson(res, 202, {
            ok: true,
            orderId,
            reportStatus: "generating",
            externalReport: nextExternal,
            generation: publicGenerationStatus(generationPayload),
            fulfillment: { required: true, status: "submitted", externalOrderId: existing.externalOrderId, reused: true },
          });
        } catch (error) {
          if (![404, 409].includes(Number(error?.statusCode))) throw error;
        }
      }

      const fulfill = dependencies.fulfillPaidOrder || fulfillPaidOrder;
      const fulfillment = await fulfill(sb, order, dependencies.fulfillmentDependencies || {});
      const externalReport = fulfillment.externalOrderId
        ? {
            provider: fulfillment.provider || "saju-web",
            productId: order.product_id,
            externalOrderId: fulfillment.externalOrderId,
            shareToken: fulfillment.shareToken || "",
            shareUrl: fulfillment.shareUrl || "",
            status: fulfillment.externalStatus || "queued",
            submittedAt: fulfillment.submittedAt || new Date().toISOString(),
          }
        : existing;
      return sendJson(res, 202, {
        ok: true,
        orderId,
        reportStatus: "generating",
        externalReport,
        fulfillment,
      });
    }

    const currentExternal = asObject(order.external_report);
    if (!currentExternal.externalOrderId) {
      return sendJson(res, 409, { message: "saju-web 주문번호가 아직 없습니다." });
    }

    // 생성 중 폴링은 가벼운 상태 API만 사용한다. 본문(/report)은 완성된 뒤 한 번만 가져온다.
    const getStatus = dependencies.getSajuWebOrderStatus || getSajuWebOrderStatus;
    const getReport = dependencies.getSajuWebReport || getSajuWebReport;
    const statusPayload = await getStatus({ externalOrderId: currentExternal.externalOrderId });
    const generation = publicGenerationStatus(statusPayload.generation);
    const reportPayload = statusPayload.report_ready
      ? await getReport({ externalOrderId: currentExternal.externalOrderId })
      : statusPayload;

    const externalStatus = String(reportPayload.status || currentExternal.status || "").toLowerCase();
    const reportFailed = generation ? generation.status === "failed" : externalStatus === "failed";
    const nextExternal = {
      ...currentExternal,
      shareUrl: reportPayload.share_url || currentExternal.shareUrl || "",
      shareToken: reportPayload.share_token || currentExternal.shareToken || "",
      status: externalStatus,
      reportReady: Boolean(reportPayload.report_ready),
      checkedAt: new Date().toISOString(),
    };
    const patch = {
      external_report: nextExternal,
      report_status: reportPayload.report_ready ? "complete" : reportFailed ? "failed" : "generating",
      fulfillment_error: reportFailed ? "외부 심층 리포트 생성에 실패했습니다. 다시 생성을 요청해주세요." : null,
    };
    const archive = reportPayload.report_ready ? buildArchiveSnapshot(order, reportPayload, nextExternal) : null;
    if (archive) await upsertUserArchive(sb, order.user_id || user?.id, archive);
    const updated = await sb.from("orders").update(patch).eq("id", order.id);
    if (updated.error) throw updated.error;
    return sendJson(res, 200, {
      ok: true,
      orderId,
      reportStatus: patch.report_status,
      externalReport: nextExternal,
      generation,
      archive,
      reportError: patch.fulfillment_error,
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 502, {
      message: publicExternalError(error, "외부 심층 리포트 서비스와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."),
      code: error.code || undefined,
    });
  }
}

export default externalReportsHandler;
