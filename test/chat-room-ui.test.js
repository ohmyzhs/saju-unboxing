import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("챗봇은 로비와 재진입 가능한 풀화면 대화방을 분리한다", () => {
  assert.match(html, /data-chat-lobby/);
  assert.match(html, /data-chat-room-back/);
  assert.match(html, /data-chat-report-context/);
  assert.match(css, /\.chat-view\.is-room-open[\s\S]*position:\s*fixed/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(app, /buildClientChatTurns/);
  assert.match(app, /data-chat-room-back/);
  assert.match(app, /is-room-open/);
  const load = app.slice(app.indexOf("async function loadChatView"), app.indexOf("function updateChatStreamRecord"));
  assert.doesNotMatch(load, /chatState\.sessions\[0\]/);
});

test("질문 전송 실패는 낙관적 질문-답변 턴을 지우지 않고 실패 상태로 남긴다", () => {
  const send = app.slice(app.indexOf("async function sendChatMessage"), app.indexOf("function startChatCreditCheckout"));
  assert.match(send, /assistantMessage\.status\s*=\s*"failed"/);
  assert.match(send, /assistantMessage\.errorMessage/);
  assert.doesNotMatch(send, /catch[\s\S]*await loadChatView/);
});
