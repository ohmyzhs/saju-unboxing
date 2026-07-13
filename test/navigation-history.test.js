import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");

test("화면 이동은 브라우저 history에 쌓이고 popstate에서 앱 화면을 복원한다", () => {
  assert.match(app, /function updateViewHistory\(nextView, historyMode = "push"/);
  assert.match(app, /history\[method\]\(nextState, "", navigationUrlFor\(nextView\)\)/);
  assert.match(app, /window\.addEventListener\("popstate", \(event\) => \{\s*restoreNavigationState\(event\.state\)/);
  assert.match(app, /showView\(nextView, \{\s*historyMode: "none",\s*scrollBehavior: "auto"/);
});

test("홈 이외의 앱 화면은 정적 호스팅에서도 열리는 hash 주소를 사용한다", () => {
  assert.match(app, /view === "home" \? "" : `#view=\$\{encodeURIComponent\(view\)\}`/);
  assert.ok(app.includes('new URLSearchParams(location.hash.replace(/^#/, "")).get("view")'));
  assert.match(html, /app\.js\?v=20260713-repeat-payment-fix/);
});

test("팝업과 챗봇 내부 단계도 Android 뒤로가기 이력에 포함한다", () => {
  assert.match(app, /NAVIGATION_OVERLAYS = new Set\(\["member", "mypage", "chat-report", "chat-store"\]\)/);
  assert.match(app, /pushOverlayHistory\("member", \{ productId \}\)/);
  assert.match(app, /pushOverlayHistory\("mypage"\)/);
  assert.match(app, /pushOverlayHistory\("chat-report"\)/);
  assert.match(app, /pushOverlayHistory\("chat-store"\)/);
  assert.match(app, /function openChatSession\(sessionId/);
  assert.match(app, /updateChatSessionHistory\(sessionId, historyMode\)/);
});

test("결제 콜백 URL 정리 뒤에도 현재 앱 화면 state를 유지한다", () => {
  assert.doesNotMatch(app, /history\.replaceState\(null, "", "\/"\)/);
  assert.match(app, /function replaceNavigationUrl\(url, view = currentViewName\)/);
});
