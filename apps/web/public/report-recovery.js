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
      sections: (data.sections || []).map((section) => {
        const body = section.body || "";
        return {
          ...section,
          body,
          status: section.status || (body ? "complete" : "pending"),
          error: section.error || null,
        };
      }),
      manse: data.manse || null,
      summary: data.summary || null,
      lucky: data.lucky || null,
      score: typeof data.score === "number" ? data.score : undefined,
      scoreLabel: data.scoreLabel || undefined,
      hashtags: data.hashtags || undefined,
      context: data.context || undefined,
      targetYear: data.targetYear || data.context?.대상연도 || undefined,
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
      sections: (draft.analysis?.sections || []).map((section) => section.id === sectionId ? { ...section, body, status: "complete", error: null } : section),
    },
    updatedAt: Date.now(),
  };
}

function markSectionFailed(draft, sectionId, error) {
  return {
    ...draft,
    analysis: {
      ...draft.analysis,
      sections: (draft.analysis?.sections || []).map((section) =>
        section.id === sectionId
          ? { ...section, body: "", status: "failed", error: String(error || "섹션 생성 실패") }
          : section,
      ),
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

globalThis.ReportRecovery = Object.freeze({ createDraft, finish, markSectionFailed, mergeSection });
