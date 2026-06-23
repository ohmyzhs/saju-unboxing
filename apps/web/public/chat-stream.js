(function initChatStream(root) {
  function parseBlock(block) {
    let id = 0;
    let event = "message";
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator >= 0 ? line.slice(0, separator) : line;
      let value = separator >= 0 ? line.slice(separator + 1) : "";
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "id") id = Number.parseInt(value, 10) || 0;
      if (field === "event") event = value || "message";
      if (field === "data") data.push(value);
    }
    if (!data.length) return null;
    const text = data.join("\n");
    try {
      return { id, event, data: JSON.parse(text) };
    } catch {
      throw new Error(`챗봇 응답을 해석할 수 없습니다: ${event}`);
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

  function retryDelay(attempt) {
    return Math.min(10_000, 500 * (2 ** Math.max(0, Number(attempt) || 0)));
  }

  async function consume(response, onEvent) {
    const contentType = response.headers?.get?.("content-type") || "";
    if (!response.ok || !contentType.includes("text/event-stream")) {
      const text = await response.text();
      let message = "";
      try {
        const payload = text ? JSON.parse(text) : {};
        message = payload.message || "";
      } catch {}
      throw new Error(message || `챗봇 연결에 실패했습니다. (${response.status || 500})`);
    }
    if (!response.body?.getReader) throw new Error("이 브라우저에서는 실시간 챗봇 응답을 받을 수 없습니다.");
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

  function connect({ runId, lastEventId = 0, onEvent = () => {}, onDisconnect = () => {} }) {
    const controller = new AbortController();
    let cursor = Number(lastEventId) || 0;
    let attempt = 0;
    const wait = (ms) => new Promise((resolve) => root.setTimeout(resolve, ms));
    const done = (async () => {
      while (!controller.signal.aborted) {
        let terminal = false;
        try {
          const headers = cursor > 0 ? { "Last-Event-ID": String(cursor) } : {};
          const response = await root.SajuApi.fetch(`/api/chat/runs/${encodeURIComponent(runId)}/events`, {
            headers,
            signal: controller.signal,
          });
          await consume(response, (record) => {
            if (record.id > cursor) cursor = record.id;
            if (record.event === "complete" || record.event === "error") terminal = true;
            onEvent(record);
          });
          if (terminal || controller.signal.aborted) break;
        } catch (error) {
          if (controller.signal.aborted) break;
          onDisconnect(error);
        }
        const delay = retryDelay(attempt);
        attempt += 1;
        await wait(delay);
      }
    })();
    return { close: () => controller.abort(), done };
  }

  root.ChatStream = { connect, consume, createParser, retryDelay };
})(typeof window !== "undefined" ? window : globalThis);
