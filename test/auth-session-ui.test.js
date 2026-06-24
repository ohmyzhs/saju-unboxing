import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("앱 복귀 시 서버 세션을 재검증하고 만료 상태를 UI에 반영한다", () => {
  assert.match(app, /function refreshAuthSession/);
  assert.match(app, /document\.addEventListener\("visibilitychange"/);
  assert.match(app, /window\.addEventListener\("pageshow"/);
  assert.match(app, /window\.addEventListener\("focus"/);
  assert.match(app, /localStorage\.removeItem\("saju_lab_auth_hint"\)/);
  assert.match(app, /reloadAccountData\(\)/);
  assert.match(app, /syncAccountData\(/);
});

test("카카오 로그인 성공 토스트는 세션 사용자 이름을 렌더한 뒤 표시한다", () => {
  assert.match(app, /let pendingAuthNotice/);
  assert.match(app, /consumeAuthNotice/);
  assert.doesNotMatch(app, /showToast\("카카오 로그인이 완료되었습니다\."\)/);
  assert.match(app, /showToast\(`\$\{nickname\}님으로 로그인되었습니다\.`\)/);
});
