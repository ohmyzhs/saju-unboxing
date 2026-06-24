(function initChatMarkdown(root) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderInline(value) {
    return escapeHtml(value)
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  }

  function lineKind(line) {
    const ordered = /^\s*(\d+)\.\s+(.+)$/.exec(line);
    if (ordered) return { type: "ordered", text: ordered[2] };
    const bullet = /^(\s*)[-*]\s+(.+)$/.exec(line);
    if (bullet) return { type: "bullet", indent: bullet[1].length, text: bullet[2] };
    return null;
  }

  function renderOrderedList(lines) {
    let html = "<ol>";
    let itemOpen = false;
    let nestedOpen = false;
    for (const line of lines) {
      const kind = lineKind(line);
      if (!kind) continue;
      if (kind.type === "ordered") {
        if (nestedOpen) {
          html += "</ul>";
          nestedOpen = false;
        }
        if (itemOpen) html += "</li>";
        html += `<li>${renderInline(kind.text)}`;
        itemOpen = true;
      } else if (kind.type === "bullet" && itemOpen && kind.indent > 0) {
        if (!nestedOpen) {
          html += "<ul>";
          nestedOpen = true;
        }
        html += `<li>${renderInline(kind.text)}</li>`;
      }
    }
    if (nestedOpen) html += "</ul>";
    if (itemOpen) html += "</li>";
    return `${html}</ol>`;
  }

  function renderBulletList(lines) {
    const items = lines
      .map(lineKind)
      .filter((kind) => kind?.type === "bullet")
      .map((kind) => `<li>${renderInline(kind.text)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  function renderBlock(lines) {
    const first = lineKind(lines[0] || "");
    if (first?.type === "ordered") return renderOrderedList(lines);
    if (first?.type === "bullet") return renderBulletList(lines);

    const text = lines.join("\n").trim();
    const heading = /^([^\w가-힣]{0,4})\s*\*\*([^*\n]+)\*\*\s*$/u.exec(text);
    if (heading) {
      const icon = heading[1].trim();
      return `<p class="chat-md-heading">${icon ? `<span>${escapeHtml(icon)}</span>` : ""}<strong>${escapeHtml(heading[2])}</strong></p>`;
    }
    return `<p>${lines.map(renderInline).join("<br />")}</p>`;
  }

  function render(value) {
    const normalized = String(value || "").replace(/\r\n?/g, "\n");
    const blocks = [];
    let current = [];
    function flush() {
      if (!current.length) return;
      blocks.push(renderBlock(current));
      current = [];
    }

    for (const line of normalized.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flush();
        blocks.push("<hr />");
        continue;
      }
      current.push(line);
    }
    flush();

    return `<div class="chat-markdown">${blocks.join("")}</div>`;
  }

  root.ChatMarkdown = { render };
})(typeof window !== "undefined" ? window : globalThis);
