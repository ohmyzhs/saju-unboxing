// 2026-07 UI/UX 정비 패스 회귀 테스트
// ① 푸터 메뉴 바로가기 제거 ② 하단 여백 축소 ③ 360px 버튼 줄바꿈 방지
// ④ 히어로 화살표·스와이프 ⑤ 마이페이지 개인정보 수정 ⑥ 사이드메뉴 추가질문 제거
// ⑦ 헤더 고정 ⑧ 밝은 배경 흰 글자 교정
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");
const sessionApi = readFileSync(new URL("../apps/api/src/legacy/session.js", import.meta.url), "utf8");
const sessionsLib = readFileSync(new URL("../apps/api/src/legacy/_lib/sessions.js", import.meta.url), "utf8");

test("메인 하단 메뉴 바로가기는 제거되고 약관 푸터만 남는다", () => {
  assert.doesNotMatch(html, /footer-menu/);
  assert.match(html, /footer-links/);
});

test("사이드메뉴에서 추가 질문 상담 항목이 빠진다", () => {
  assert.doesNotMatch(html, /data-view-target="followup" data-mypage-close/);
});

test("히어로 배너는 좌우 화살표와 스와이프를 지원한다", () => {
  assert.match(html, /data-slide-prev/);
  assert.match(html, /data-slide-next/);
  assert.match(app, /function stepSlide\(delta\)/);
  assert.match(app, /touchstart/);
  assert.match(app, /restartBannerAutoplay\(\)/);
  assert.match(css, /\.carousel-arrow\.prev/);
});

test("헤더는 고정된다 — overflow: hidden이 sticky를 깨지 않도록 clip 사용", () => {
  assert.match(css, /\.app-shell\s*{\s*overflow:\s*clip;\s*}/);
});

test("360px에서 단계 버튼이 줄바꿈되지 않도록 여백·nowrap 처리", () => {
  assert.match(css, /\.home-story \.story-points button,[\s\S]{0,80}white-space:\s*nowrap/);
  assert.match(css, /@media \(max-width: 380px\)/);
});

test("챗봇 질의응답권 카드는 밝은 한지 배경에 어두운 글자를 쓴다", () => {
  // 최종 오버라이드가 base의 color:#fff를 잉크색으로 교정하는지
  const overrideIdx = css.lastIndexOf(".chat-credit-card {");
  const block = css.slice(overrideIdx, overrideIdx + 120);
  assert.match(block, /color:\s*#16233c/);
});

test("마이페이지 개인정보 수정 — 프론트 폼과 API update 액션이 연결된다", () => {
  assert.match(app, /data-account-edit-form/);
  assert.match(app, /action:\s*"update"/);
  assert.match(sessionApi, /action === "update"/);
  assert.match(sessionApi, /현재 비밀번호가 올바르지 않습니다/);
  assert.match(sessionApi, /updateSessionUser\(req, user\)/);
  assert.match(sessionsLib, /export async function updateSessionUser/);
});
