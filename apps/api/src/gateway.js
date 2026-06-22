import config from "./legacy/config.js";
import profiles from "./legacy/profiles.js";
import orders from "./legacy/orders.js";
import track from "./legacy/track.js";
import session from "./legacy/session.js";
import share from "./legacy/share.js";
import paymentConfirm from "./legacy/payments/confirm.js";
import sajuAnalyze from "./legacy/saju/analyze.js";
import sajuSection from "./legacy/saju/section.js";
import admin from "./legacy/admin/[action].js";
import kakaoStart from "./legacy/auth/kakao/start.js";
import kakaoCallback from "./legacy/auth/kakao/callback.js";
import { createChatHandler } from "./http/chat.js";
import {
  resumeStuckChatRuns,
  startChatRecovery,
  startReportChatRun,
} from "./workflows/chatExecution.js";
import { getSupabase } from "./legacy/_lib/supabase.js";
import { baseUrl, sendJson } from "./legacy/_lib/http.js";

// 챗 실행기 주입 — 질문 전송 시 답변 생성을 즉시 트리거(백그라운드)하고 202 를 빠르게 반환한다.
const chat = createChatHandler({
  startRun: (runId) => startReportChatRun(runId),
  recoverRuns: (sb) => startChatRecovery(sb),
});

// 내구 실행 복구용 수동 엔드포인트. 시작 못 했거나 끊긴 run 을 재개한다.
async function chatSweepHandler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers?.authorization || "") !== `Bearer ${secret}`) {
    return sendJson(res, 401, { message: "unauthorized" });
  }
  const result = await resumeStuckChatRuns(getSupabase());
  return sendJson(res, 200, { ok: true, ...result });
}

const ROUTES = new Map([
  ["/api/config", { name: "config", handler: config }],
  ["/api/profiles", { name: "profiles", handler: profiles }],
  ["/api/orders", { name: "orders", handler: orders }],
  ["/api/track", { name: "track", handler: track }],
  ["/api/session", { name: "session", handler: session }],
  ["/api/share", { name: "share", handler: share }],
  ["/api/payments/confirm", { name: "payment-confirm", handler: paymentConfirm }],
  ["/api/saju/analyze", { name: "saju-analyze", handler: sajuAnalyze }],
  ["/api/saju/section", { name: "saju-section", handler: sajuSection }],
  ["/api/auth/kakao/start", { name: "kakao-start", handler: kakaoStart }],
  ["/api/auth/kakao/callback", { name: "kakao-callback", handler: kakaoCallback }],
]);

function normalizePath(pathname) {
  const value = String(pathname || "/").replace(/\/+$/, "");
  return value || "/";
}

function normalizeOrigin(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : "";
  } catch {
    return "";
  }
}

export function parseAllowedOrigins(env = process.env) {
  const values = [env.WEB_BASE_URL, ...String(env.WEB_ORIGINS || "").split(",")];
  return [...new Set(values.map(normalizeOrigin).filter(Boolean))];
}

export function isAllowedOrigin(origin, allowedOrigins = parseAllowedOrigins()) {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && allowedOrigins.includes(normalized));
}

function requestOrigin(req) {
  return normalizeOrigin(baseUrl(req));
}

function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  const allowed = [...new Set([...parseAllowedOrigins(), requestOrigin(req)].filter(Boolean))];
  if (!isAllowedOrigin(origin, allowed)) return false;
  res.setHeader("Access-Control-Allow-Origin", normalizeOrigin(origin));
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
  return true;
}

export function resolveRoute(pathname) {
  const path = normalizePath(pathname);
  if (path === "/api/health") return { name: "health" };
  if (path === "/api/internal/chat-sweep") return { name: "chat-sweep" };
  const chatMatch = /^\/api\/chat\/(.+)$/.exec(path);
  if (chatMatch) return { name: "chat", path: chatMatch[1] };
  const adminMatch = /^\/api\/admin\/([^/]+)$/.exec(path);
  if (adminMatch) return { name: "admin", action: decodeURIComponent(adminMatch[1]) };
  const route = ROUTES.get(path);
  return route ? { name: route.name } : null;
}

function routeHandler(route) {
  if (route.name === "health") return config;
  if (route.name === "admin") return admin;
  if (route.name === "chat") return chat;
  for (const candidate of ROUTES.values()) {
    if (candidate.name === route.name) return candidate.handler;
  }
  return null;
}

export function requestPath(req) {
  const rewrittenPath = Array.isArray(req.query?.path) ? req.query.path.join("/") : req.query?.path;
  if (rewrittenPath) return `/api/${String(rewrittenPath).replace(/^\/+|\/+$/g, "")}`;
  try {
    const url = new URL(req.url || "/", "http://gateway.local");
    const queryPath = url.searchParams.get("path");
    if (queryPath) return `/api/${queryPath.replace(/^\/+|\/+$/g, "")}`;
    return url.pathname;
  } catch {
    return "/";
  }
}

function withQuery(req, patch) {
  req.query = { ...(req.query || {}), ...patch };
}

export default async function gateway(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { message: "허용되지 않은 요청 출처입니다." });
  const route = resolveRoute(requestPath(req));
  if (!route) return sendJson(res, 404, { message: "API 경로를 찾지 못했습니다." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (route.name === "chat-sweep") return chatSweepHandler(req, res);
  if (route.name === "health") withQuery(req, { mode: "health" });
  if (route.name === "admin") withQuery(req, { action: route.action });
  if (route.name === "chat") withQuery(req, { chatPath: route.path });
  return routeHandler(route)(req, res);
}
