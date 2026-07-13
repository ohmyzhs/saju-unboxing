import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");

test("상품 결제 전 등록 프로필을 명확한 선택 목록으로 우선 노출한다", () => {
  assert.match(html, /class="member-list-head"[\s\S]*data-member-count/);
  assert.match(html, /등록된 프로필을 선택하면 결제 정보 확인으로 이어집니다/);
  assert.match(html, /목록에 없는 사람만 새로 등록/);
  assert.match(app, /const prioritizedProfiles = selectedProfileId/);
  assert.match(app, /class="member-row\$\{profile\.id === selectedProfileId \? " is-priority"/);
  assert.match(app, /class="member-select-mark"><small>선택<\/small>/);
  assert.match(app, /selectedProfileId = profile\.id/);
  assert.match(css, /\.member-row\.is-priority/);
  assert.match(css, /\.modal-add\s*\{[\s\S]*min-height:\s*38px/);
});

test("외부 리포트 대기 화면은 이미지와 제작 문구를 순환한다", () => {
  assert.match(html, /data-progress-story/);
  assert.match(html, /data-progress-image/);
  assert.match(html, /data-progress-live/);
  assert.match(app, /const EXTERNAL_WAIT_STORIES = \[/);
  assert.match(app, /heukya-premium-dark-mudang\.jpg/);
  assert.match(app, /heukya-premium-saju-reading\.jpg/);
  assert.match(app, /window\.setTimeout\(renderExternalWaitStory, reduceMotion \? 12000 : 6500\)/);
  assert.match(css, /\.report-progress-story\.is-changing/);
});

test("99% 장기 대기는 오류가 아니라 최종 편집 중임을 안내한다", () => {
  assert.match(app, /Number\(percent\) >= 99[\s\S]*"최종 편집과 열람 준비 중"/);
  assert.match(app, /99% 이후에는 문장 검수와 열람 링크 준비로 1~2분 더 걸릴 수 있습니다/);
  assert.match(app, /elapsedMs >= 120000[\s\S]*화면을 닫아도 제작은 계속됩니다/);
  assert.match(app, /function stopExternalWaitStory\(\)/);
  assert.match(app, /finishExternalWait[\s\S]*stopExternalWaitStory\(\)/);
});
