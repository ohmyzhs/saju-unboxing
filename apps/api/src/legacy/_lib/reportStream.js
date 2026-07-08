export function formatSse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function openSse(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function sendSse(res, event, payload) {
  if (!res.writableEnded) res.write(formatSse(event, payload));
}

export function chunkSections(items, size = 2) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function planPayload({ productId, plan, manse, manseB }) {
  const common = {
    ok: true,
    mode: "plan",
    productId,
    headline: plan.headline,
    sections: plan.sections,
    context: plan.context,
    targetYear: plan.context?.대상연도 || null,
    summary: manse.summary,
    manse: manse.full,
    cost: (manse.cost || 0) + (manseB?.cost || 0),
  };
  if (productId === "compatibility") {
    return {
      ...common,
      score: plan.score,
      scoreLabel: plan.scoreLabel,
      hashtags: plan.hashtags,
      partnerSummary: manseB?.summary || {},
    };
  }
  return { ...common, lucky: plan.lucky };
}

async function generateBatchWithFallback(args, generateSections) {
  try {
    return await generateSections(args);
  } catch (error) {
    if (args.sections.length === 1) throw error;
    const singles = await Promise.all(args.sections.map((section) => generateSections({
      ...args,
      sections: [section],
    })));
    return singles.flat();
  }
}

export async function runReportStream(options, dependencies) {
  const {
    emit,
    computeManse,
    generatePlan,
    generateSections,
    heartbeatMs = 10000,
  } = dependencies;
  const {
    productId = "saju-analysis",
    productName = "기본 사주 리포트",
    profile,
    partner,
    config,
    extra,
    model,
    targetYear,
    calendarPick,
  } = options;
  let stage = "started";
  const heartbeat = heartbeatMs > 0
    ? setInterval(() => Promise.resolve(emit("heartbeat", { stage })).catch(() => {}), heartbeatMs)
    : null;
  heartbeat?.unref?.();

  try {
    await emit("started", { progress: 5 });
    const manse = await computeManse(profile, config);
    const manseB = productId === "compatibility" ? await computeManse(partner, config) : null;
    stage = "manse_ready";
    await emit("manse_ready", { progress: 20 });

    stage = "plan_started";
    await emit("plan_started", { progress: 25 });
    const plan = await generatePlan({
      productId,
      productName,
      extra,
      profile,
      partner,
      manse,
      manseB,
      model,
      targetYear,
      calendarPick,
    });
    const data = planPayload({ productId, plan, manse, manseB });
    stage = "plan_ready";
    await emit("plan_ready", { progress: 40, total: plan.sections.length, data });

    // Vercel 함수 하나가 모든 본문 생성을 기다리지 않는다. 브라우저가 plan을 받은 뒤
    // /api/saju/section을 독립적으로 병렬 호출해 각 함수의 실행시간을 분리한다.
    const result = data;
    stage = "complete";
    await emit("complete", {
      progress: 40,
      completed: 0,
      total: plan.sections.length,
      planOnly: true,
    });
    return result;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
