(function initAnalysisStream(root) {
  function parseBlock(block) {
    let event = "message";
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator >= 0 ? line.slice(0, separator) : line;
      let value = separator >= 0 ? line.slice(separator + 1) : "";
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value || "message";
      if (field === "data") data.push(value);
    }
    if (!data.length) return null;
    const text = data.join("\n");
    try {
      return { event, data: JSON.parse(text) };
    } catch {
      throw new Error(`분석 진행 응답을 해석할 수 없습니다: ${event}`);
    }
  }

  function createParser(onEvent) {
    let buffer = "";
    const flush = (final = false) => {
      while (buffer) {
        const match = buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const parsed = parseBlock(block);
        if (parsed) onEvent(parsed);
      }
      if (final && buffer.trim()) {
        const parsed = parseBlock(buffer);
        buffer = "";
        if (parsed) onEvent(parsed);
      }
    };
    return {
      feed(chunk) {
        buffer += String(chunk || "");
        flush(false);
      },
      end() {
        flush(true);
      },
    };
  }

  function progressForSections(completed, total) {
    const count = Math.max(0, Number(completed) || 0);
    const size = Math.max(0, Number(total) || 0);
    if (!size) return 40;
    return Math.min(95, Math.round(40 + (55 * Math.min(count, size)) / size));
  }

  async function consume(response, onEvent) {
    const contentType = response.headers?.get?.("content-type") || "";
    if (!response.ok || !contentType.includes("text/event-stream")) {
      const text = await response.text();
      let message = "";
      try {
        const payload = text ? JSON.parse(text) : {};
        message = payload.message || payload.error || "";
      } catch {}
      throw new Error(message || `분석 서버 요청에 실패했습니다. (${response.status || 500})`);
    }
    if (!response.body?.getReader) throw new Error("이 브라우저에서는 실시간 분석을 받을 수 없습니다.");

    const parser = createParser(onEvent);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.end();
  }

  root.AnalysisStream = { createParser, consume, progressForSections };
})(typeof window !== "undefined" ? window : globalThis);
