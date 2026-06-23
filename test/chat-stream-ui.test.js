import test from "node:test";
import assert from "node:assert/strict";

await import("../apps/web/public/chat-stream.js");

test("챗봇 SSE 파서는 이벤트 ID와 여러 청크를 보존한다", () => {
  const events = [];
  const parser = globalThis.ChatStream.createParser((event) => events.push(event));
  parser.feed("id: 7\nevent: repl");
  parser.feed('ace\ndata: {"content":"안녕"}\n\n');
  parser.end();

  assert.deepEqual(events, [{ id: 7, event: "replace", data: { content: "안녕" } }]);
});

test("챗봇 재연결 대기는 상한이 있는 지수 백오프다", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 8].map(globalThis.ChatStream.retryDelay),
    [500, 1000, 2000, 4000, 10000],
  );
});
