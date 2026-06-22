// 방문/매출 통계 집계 — 기존 server.mjs summarizeAnalytics 로직을 Supabase 입력용으로 포팅.
// events: 시간 오름차순 배열, orders: 주문 배열. (둘 다 legacy camelCase 모양으로 normalize 후 전달)
const BASE = "http://localhost";

function dayKey(timestamp) {
  const d = new Date(timestamp || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bumpMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

export function summarizeAnalytics(events, orders) {
  const visitors = new Map();
  const pageStats = new Map();
  const sources = new Map();
  const utms = new Map();
  const devices = new Map();
  const browsers = new Map();
  const oses = new Map();
  const landingPages = new Map();
  const dailyVisitors = new Map();
  const dailyEvents = new Map();
  const dailyOrders = new Map();
  const visitorJourneys = new Map();
  const funnelKeys = ["page_view", "product_select", "checkout_view", "payment_start", "payment_success", "analysis_start", "analysis_complete"];
  const funnel = Object.fromEntries(funnelKeys.map((key) => [key, 0]));
  const errors = [];
  const seenVisitorSource = new Set();
  const seenVisitorUtm = new Set();
  const exitDedup = new Map();
  let dedupedExitCount = 0;
  const EXIT_DEDUP_WINDOW_MS = 5000;

  events.forEach((event) => {
    const day = dayKey(event.at);
    bumpMap(dailyEvents, day);

    if (event.visitorId) {
      const current = visitors.get(event.visitorId) || {
        visitorId: event.visitorId,
        sessionId: event.sessionId,
        firstSeen: event.at,
        lastSeen: event.at,
        ip: event.ip,
        device: event.device?.type || event.serverDevice?.device || "-",
        browser: event.device?.browser || event.serverDevice?.browser || "-",
        os: event.device?.os || event.serverDevice?.os || "-",
        viewport: event.device?.viewport || "-",
        language: event.device?.language || "-",
        referrer: event.referrer || "-",
        landingPage: event.landingPage || event.page || "-",
        lastPage: event.page || event.view || "-",
        eventCount: 0,
        paid: false,
        utm: event.utm || {},
      };
      current.lastSeen = Math.max(current.lastSeen, event.at);
      current.firstSeen = Math.min(current.firstSeen, event.at);
      current.lastPage = event.page || event.view || current.lastPage;
      current.eventCount += 1;
      current.paid = current.paid || event.event === "payment_success";
      visitors.set(event.visitorId, current);

      if (!dailyVisitors.has(day)) dailyVisitors.set(day, new Set());
      dailyVisitors.get(day).add(event.visitorId);

      const trail = visitorJourneys.get(event.visitorId) || [];
      if (trail.length < 30) {
        trail.push({
          event: event.event,
          page: event.page || event.view || "-",
          at: event.at,
          productId: event.metadata?.productId,
        });
        visitorJourneys.set(event.visitorId, trail);
      }
    }

    if (event.event in funnel) funnel[event.event] += 1;
    if (event.event === "payment_error") {
      errors.push({
        at: event.at,
        message: event.metadata?.message || "-",
        productId: event.metadata?.productId,
        visitorId: event.visitorId,
      });
    }
    if (event.event === "view_exit" || event.event === "page_exit") {
      const dedupKey = event.visitorId || event.sessionId || event.id;
      const lastAt = exitDedup.get(dedupKey);
      const isDup = lastAt && Math.abs(event.at - lastAt) <= EXIT_DEDUP_WINDOW_MS;
      if (!isDup) {
        exitDedup.set(dedupKey, event.at);
        dedupedExitCount += 1;
        const key = event.view || event.page || "unknown";
        const stat = pageStats.get(key) || { page: key, exits: 0, totalDuration: 0 };
        stat.exits += 1;
        stat.totalDuration += Number(event.durationMs || 0);
        pageStats.set(key, stat);
      }
    }

    if (event.event === "page_view") {
      bumpMap(landingPages, event.page || "/");
    }

    const dedupVisitor = event.visitorId || event.sessionId || event.id;
    if (dedupVisitor && !seenVisitorSource.has(dedupVisitor)) {
      seenVisitorSource.add(dedupVisitor);
      let sourceKey = "direct";
      if (event.referrer) {
        try {
          sourceKey = new URL(event.referrer, BASE).hostname || "direct";
        } catch {
          sourceKey = "direct";
        }
      }
      bumpMap(sources, sourceKey);
    }
    if (dedupVisitor && !seenVisitorUtm.has(dedupVisitor)) {
      seenVisitorUtm.add(dedupVisitor);
      const utmSource = event.utm?.utm_source || "none";
      const utmMedium = event.utm?.utm_medium || "none";
      const utmCampaign = event.utm?.utm_campaign || "none";
      bumpMap(utms, `${utmSource} / ${utmMedium} / ${utmCampaign}`);
    }

    const dev = event.device?.type || event.serverDevice?.device;
    const br = event.device?.browser || event.serverDevice?.browser;
    const os = event.device?.os || event.serverDevice?.os;
    if (dev) bumpMap(devices, dev);
    if (br) bumpMap(browsers, br);
    if (os) bumpMap(oses, os);
  });

  const paidVisitorIds = new Set(
    orders.filter((order) => order.status === "결제 완료" && order.visitorId).map((order) => order.visitorId),
  );
  paidVisitorIds.forEach((visitorId) => {
    const visitor = visitors.get(visitorId);
    if (visitor) visitor.paid = true;
  });

  orders.forEach((order) => {
    if (order.status !== "결제 완료") return;
    const day = dayKey(order.approvedAt || order.updatedAt || order.createdAt);
    const current = dailyOrders.get(day) || { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += Number(order.amount || 0);
    dailyOrders.set(day, current);
  });

  const today = new Date();
  const timeline = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    timeline.push({
      day: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      visitors: dailyVisitors.get(key)?.size || 0,
      events: dailyEvents.get(key) || 0,
      orders: dailyOrders.get(key)?.count || 0,
      revenue: dailyOrders.get(key)?.revenue || 0,
    });
  }

  const sortedVisitors = [...visitors.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  const journeys = sortedVisitors.slice(0, 30).map((v) => ({ ...v, journey: visitorJourneys.get(v.visitorId) || [] }));
  const totalDuration = sortedVisitors.reduce((sum, v) => sum + Math.max(0, (v.lastSeen || 0) - (v.firstSeen || 0)), 0);

  const distToObj = (map) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));

  const todayKey = dayKey(Date.now());
  const visitorList = [...visitors.values()];
  const newVisitors = visitorList.filter((v) => dayKey(v.firstSeen) === todayKey).length;
  const returningVisitors = Math.max(0, visitors.size - newVisitors);
  const bouncedVisitors = visitorList.filter((v) => (v.eventCount || 0) <= 1).length;
  const completedOrders = orders.filter((o) => o.status === "결제 완료");
  const revenue = completedOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const orderCount = completedOrders.length;
  const bounceRate = visitors.size ? (bouncedVisitors / visitors.size) * 100 : 0;
  const avgOrderValue = orderCount ? Math.round(revenue / orderCount) : 0;
  const ltv = paidVisitorIds.size ? Math.round(revenue / paidVisitorIds.size) : 0;

  return {
    events: events.slice(-200).reverse(),
    orders,
    visitors: sortedVisitors,
    journeys,
    exits: [...pageStats.values()]
      .map((item) => ({ ...item, avgDurationMs: item.exits ? Math.round(item.totalDuration / item.exits) : 0 }))
      .sort((a, b) => b.exits - a.exits),
    sources: distToObj(sources).map((s) => ({ source: s.label, count: s.count })),
    utms: distToObj(utms).map((u) => ({ utm: u.label, count: u.count })),
    devices: distToObj(devices),
    browsers: distToObj(browsers),
    oses: distToObj(oses),
    landingPages: distToObj(landingPages),
    timeline,
    errors: errors.slice(-30).reverse(),
    funnel,
    totals: {
      visitors: visitors.size,
      payers: paidVisitorIds.size,
      events: events.length,
      orders: orderCount,
      revenue,
      exits: dedupedExitCount,
      avgSessionMs: visitors.size ? Math.round(totalDuration / visitors.size) : 0,
      paymentErrors: errors.length,
      newVisitors,
      returningVisitors,
      bounceRate,
      avgOrderValue,
      ltv,
    },
  };
}
