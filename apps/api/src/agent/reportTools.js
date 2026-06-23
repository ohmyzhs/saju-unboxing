function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function reportAnalysis(snapshot) {
  return snapshot?.analysis || snapshot?.data || snapshot || {};
}

function reportSections(snapshot) {
  const sections = reportAnalysis(snapshot)?.sections;
  return Array.isArray(sections) ? sections : [];
}

function keywords(value) {
  const words = String(value || "").toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || [];
  const result = new Set();
  for (const word of words) {
    result.add(word);
    const stripped = word.replace(/(어떤가요|인가요|에서는|에서|으로|에게|한테|까지|부터|처럼|보다|과|와|은|는|이|가|을|를|의|에|도|로)$/u, "");
    if (stripped.length >= 2) result.add(stripped);
    for (let index = 0; index < word.length - 1; index += 1) result.add(word.slice(index, index + 2));
  }
  return [...result];
}

export function selectRelevantSection(snapshot, question) {
  const sections = reportSections(snapshot);
  if (!sections.length) return null;
  const tokens = keywords(question);
  let best = sections[0];
  let bestScore = -1;
  for (const section of sections) {
    const text = `${section?.title || ""} ${section?.body || ""}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? Math.max(1, token.length - 1) : 0), 0);
    if (score > bestScore) {
      best = section;
      bestScore = score;
    }
  }
  return best;
}

export function createReportTools({ snapshot, history = [] }) {
  const analysis = reportAnalysis(snapshot);
  const sections = reportSections(snapshot);
  return {
    get_report_overview() {
      return clone({
        archiveId: snapshot?.id || null,
        productId: snapshot?.productId || null,
        productName: snapshot?.productName || null,
        profileName: snapshot?.profileName || null,
        partnerName: snapshot?.partnerName || null,
        headline: analysis?.headline || null,
        summary: analysis?.summary || null,
        lucky: analysis?.lucky || null,
      });
    },
    get_report_section(sectionKey) {
      const key = String(sectionKey ?? "");
      const section = sections.find((candidate, index) =>
        String(candidate?.id ?? index) === key || String(candidate?.title || "") === key,
      );
      return clone(section || null);
    },
    get_manse_facts() {
      return clone({
        manse: analysis?.manse || null,
        summary: analysis?.summary || null,
        context: analysis?.context || null,
      });
    },
    get_conversation_history() {
      return clone((history || [])
        .filter((message) => message?.status === undefined || message.status === "completed")
        .filter((message) => message?.role === "user" || message?.role === "assistant")
        .slice(-20)
        .map((message) => ({
          role: message.role,
          content: String(message.content || "").slice(0, 4000),
        })));
    },
  };
}
