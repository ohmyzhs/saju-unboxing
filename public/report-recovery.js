function createDraft({ id, orderId = null, productId, productName, profileId, profileName, partnerId = null, partnerName = null, paymentStatus, data = {}, createdAt = Date.now() }) {
  return {
    id,
    orderId,
    productId,
    productName,
    profileId,
    profileName,
    partnerId,
    partnerName,
    paymentStatus,
    generationStatus: "generating",
    generationError: null,
    analysis: {
      headline: data.headline || "",
      sections: (data.sections || []).map((section) => ({ ...section, body: section.body || "" })),
      manse: data.manse || null,
      summary: data.summary || null,
      lucky: data.lucky || null,
      score: typeof data.score === "number" ? data.score : undefined,
      scoreLabel: data.scoreLabel || undefined,
      hashtags: data.hashtags || undefined,
      context: data.context || undefined,
    },
    createdAt,
    updatedAt: Date.now(),
  };
}

function mergeSection(draft, sectionId, body) {
  return {
    ...draft,
    analysis: {
      ...draft.analysis,
      sections: (draft.analysis?.sections || []).map((section) => section.id === sectionId ? { ...section, body } : section),
    },
    updatedAt: Date.now(),
  };
}

function finish(draft, status = "complete", error = null) {
  return {
    ...draft,
    generationStatus: status,
    generationError: error || null,
    updatedAt: Date.now(),
  };
}

globalThis.ReportRecovery = Object.freeze({ createDraft, finish, mergeSection });
