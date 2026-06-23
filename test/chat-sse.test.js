import test from "node:test";
import assert from "node:assert/strict";

import {
  createChatEventsHandler,
  formatChatSseEvent,
  parseLastEventId,
} from "../apps/api/src/http/chatEvents.js";
import { resolveRoute } from "../apps/api/src/gateway.js";

test("게이트웨이는 챗봇 실행 이벤트 경로를 일반 챗 API보다 먼저 분리한다", () => {
  assert.deepEqual(resolveRoute("/api/chat/runs/r1/events"), { name: "chat-events", runId: "r1" });
});

test("챗봇 SSE는 Last-Event-ID와 이벤트 레코드를 표준 형식으로 처리한다", () => {
  assert.equal(parseLastEventId("12"), 12);
  assert.equal(parseLastEventId("wrong"), 0);
  assert.equal(
    formatChatSseEvent({ id: 3, event: "replace", data: { content: "답변" } }),
    'id: 3\nevent: replace\ndata: {"content":"답변"}\n\n',
  );
});

test("챗봇 SSE는 소유권 확인 후 스냅샷과 새 이벤트를 보내고 완료한다", async () => {
  const chunks = [];
  const handler = createChatEventsHandler({
    getUser: async () => ({ id: "u1" }),
    getDb: () => ({ name: "db" }),
    loadSnapshot: async (_db, input) => {
      assert.deepEqual(input, { userId: "u1", runId: "r1" });
      return { content: "초안", status: "running", errorMessage: null };
    },
    loadEvents: async (_db, input) => {
      assert.deepEqual(input, { userId: "u1", runId: "r1", after: 4 });
      return [{ seq: 5, type: "complete", payload: { content: "완료" } }];
    },
    sleep: async () => {},
    now: (() => { let value = 0; return () => (value += 10); })(),
    maxDurationMs: 100,
  });
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    flushHeaders() {},
    write(chunk) { chunks.push(chunk); },
    end() { this.ended = true; },
  };

  await handler({ method: "GET", headers: { "last-event-id": "4" }, query: { chatRunId: "r1" } }, res);

  assert.equal(res.headers["Content-Type"], "text/event-stream; charset=utf-8");
  assert.match(chunks.join(""), /event: replace/);
  assert.match(chunks.join(""), /id: 5\nevent: complete/);
  assert.equal(res.ended, true);
});
