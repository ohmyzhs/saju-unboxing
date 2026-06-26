(function initChatReportPreview(root) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeReport(report = {}) {
    const analysis = report?.analysis || report?.data || report || {};
    const sections = Array.isArray(analysis?.sections)
      ? analysis.sections
          .filter((section) => section && (section.title || section.body))
          .map((section) => ({
            title: String(section.title || "리포트 내용"),
            body: String(section.body || ""),
          }))
      : [];
    return {
      productName: String(report?.productName || analysis?.productName || "선택 리포트"),
      profileName: String(report?.profileName || analysis?.profileName || ""),
      headline: String(analysis?.headline || ""),
      summary: typeof analysis?.summary === "string" ? analysis.summary : "",
      sections,
    };
  }

  function renderBody(value) {
    if (root.ChatMarkdown?.render) return root.ChatMarkdown.render(value || "");
    return String(value || "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br />")}</p>`)
      .join("");
  }

  function render(report) {
    const data = normalizeReport(report);
    const introduction = [
      `<p class="chat-report-preview-eyebrow">${escapeHtml(data.productName)}</p>`,
      data.headline ? `<h3>${escapeHtml(data.headline)}</h3>` : "",
      data.summary ? `<div class="chat-report-preview-summary">${renderBody(data.summary)}</div>` : "",
    ].join("");
    const sections = data.sections
      .map((section, index) => `
        <article class="chat-report-preview-section">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <h4>${escapeHtml(section.title)}</h4>
            <div class="chat-report-preview-copy">${renderBody(section.body)}</div>
          </div>
        </article>`)
      .join("");
    const empty = !data.headline && !data.summary && !data.sections.length
      ? '<p class="chat-report-preview-empty">저장된 리포트 내용을 불러오지 못했습니다.</p>'
      : "";
    return `<div class="chat-report-preview-document">${introduction}${sections}${empty}</div>`;
  }

  root.ChatReportPreview = { normalizeReport, render };
})(typeof window !== "undefined" ? window : globalThis);
