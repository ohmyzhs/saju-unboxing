import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { productRequiresLogin } from "../apps/api/src/legacy/saju/analyze.js";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const analyze = readFileSync(new URL("../apps/api/src/legacy/saju/analyze.js", import.meta.url), "utf8");

test("인원 추가와 무료운세 화면은 로그인 보호 대상으로 묶는다", () => {
  assert.match(app, /AUTH_REQUIRED_VIEWS = new Set\(\["profile", "people", "fortune", "daily"\]\)/);
  const showView = app.slice(app.indexOf("function showView("), app.indexOf("function restoreNavigationState("));
  assert.ok(showView.indexOf("isAuthRequiredView(nextView)") < showView.indexOf("updateViewHistory(nextView, historyMode"));
  assert.match(app, /async function navigateToView/);
  assert.match(app, /refreshAuthSession\("protected-view", \{ force: true, silent: true \}\)/);
});

test("로그인 완료 후 사용자가 원래 누른 보호 화면으로 복귀한다", () => {
  assert.match(app, /PENDING_AUTH_VIEW_KEY = "sajuPendingAuthView"/);
  assert.match(app, /sessionStorage\.setItem\(PENDING_AUTH_VIEW_KEY, pendingAuthView\)/);
  assert.match(app, /function resumePendingAuthView\(\)/);
  assert.match(app, /showView\(nextView, \{ authGuard: false \}\)/);
  assert.match(app, /if \(!resumePendingAuthView\(\)\)/);
});

test("무료운세와 프로필 저장은 실행 직전에도 인증 세션을 확인한다", () => {
  assert.match(app, /async function startDailyFortune[\s\S]*requireAuthenticatedView\("fortune", \{ force: true \}\)/);
  assert.match(app, /profileForm\?\.addEventListener\("submit", async[\s\S]*requireAuthenticatedView\("profile", \{ historyMode: "none", force: true \}\)/);
  assert.match(app, /async function openMemberModal[\s\S]*productId === "daily-fortune"[\s\S]*requireAuthenticatedView\("fortune", \{ force: true \}\)/);
});

test("무료운세 API는 익명 요청을 AI 처리 전에 거절한다", () => {
  assert.equal(productRequiresLogin("daily-fortune"), true);
  assert.equal(productRequiresLogin("saju-analysis"), false);
  const authCheck = analyze.indexOf("productRequiresLogin(productId) && !sessionUser?.id");
  const dailyHandler = analyze.indexOf('if (productId === "daily-fortune")');
  assert.ok(authCheck >= 0 && authCheck < dailyHandler);
  assert.match(analyze, /sendJson\(res, 401, \{ message: "로그인 후 무료운세를 이용할 수 있습니다\." \}\)/);
});
