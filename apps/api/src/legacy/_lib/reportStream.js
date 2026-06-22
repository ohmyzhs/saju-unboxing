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
    });
    const data = planPayload({ productId, plan, manse, manseB });
    stage = "plan_ready";
    await emit("plan_ready", { progress: 40, total: plan.sections.length, data });

    const otherTitles = plan.sections.map((section) => section.title);
    let completed = 0;
    const generatedById = new Map();
    const batches = chunkSections(plan.sections, 2);
    await Promise.all(batches.map(async (sections) => {
      const generated = await generateBatchWithFallback({
        productId,
        extra,
        profile,
        partner,
        context: plan.context,
        sections,
        otherTitles,
        model,
      }, generateSections);
      for (const section of generated) {
        generatedById.set(section.id, section);
        completed += 1;
        stage = "section_ready";
        await emit("section_ready", {
          section,
          completed,
          total: plan.sections.length,
        });
      }
    }));

    const finalSections = plan.sections.map((section) => ({
      ...section,
      body: generatedById.get(section.id)?.body || "",
    }));
    const result = { ...data, sections: finalSections };
    stage = "complete";
    await emit("complete", {
      progress: 100,
      completed: finalSections.length,
      total: finalSections.length,
    });
    return result;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
