import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
const logo = readFileSync(new URL("../apps/web/public/assets/ui/logo.svg", import.meta.url), "utf8");
const share = readFileSync(new URL("../apps/api/src/legacy/share.js", import.meta.url), "utf8");
const toss = readFileSync(new URL("../apps/api/src/legacy/_lib/toss.js", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../apps/web/public/assets/ASSET_INVENTORY.md", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260709090000_heukya_visual_theme.sql", import.meta.url),
  "utf8",
);

test("홈 화면은 흑야 조선 미스터리 비주얼(이미지 스킨)을 쓴다", () => {
  assert.match(html, /assets\/generated\/banners\/heukya-premium-fortune-reader\.jpg/);
  assert.match(html, /assets\/generated\/banners\/heukya-premium-hero\.jpg/);
  assert.match(html, /assets\/generated\/banners\/heukya-premium-daily-flow\.jpg/);
  assert.match(html, /assets\/generated\/banners\/heukya-premium-unboxing\.jpg/);
  // 여명 팔레트: 칠흑이 아니라 새벽빛 남색 + 금.
  assert.match(css, /--midnight-ink:\s*#1a2942/i);
  assert.match(css, /--royal-gold:\s*#d5aa55/i);
  assert.match(css, /--blood-moon:\s*#8b3a48/i);
  assert.match(css, /#1e2f4f/i);
});

test("운영 화면은 시스템 다크모드와 무관하게 동일한 밝은 색상 체계를 유지한다", () => {
  assert.match(html, /<meta name="color-scheme" content="only light"\s*\/>/);
  assert.match(css, /:root\s*\{\s*color-scheme:\s*only light;/);
});

test("모든 주요 상품 카드는 흑야 썸네일을 사용한다", () => {
  for (const asset of [
    "heukya-premium-saju-reading.jpg",
    "heukya-premium-compatibility.jpg",
    "heukya-premium-fortune-cycle.jpg",
    "heukya-premium-dark-mudang.jpg",
    "heukya-premium-auspicious-date.jpg",
    "heukya-premium-year-wheel.jpg",
    "heukya-premium-consult-chat.jpg",
  ]) {
    assert.match(html, new RegExp(asset.replace(".", "\\.")));
  }
});

test("헤더·기본 상품명칭은 기존 이름을 그대로 유지한다", () => {
  assert.match(html, /사주언박싱-mini/);
  assert.match(html, /기본 사주 리포트/);
  assert.match(html, /관계 궁합 분석/);
  assert.match(app, /"기본 사주 리포트"/);
  assert.match(toss, /사주언박싱-mini 기본 분석/);
  const shipped = [html, app, admin, adminHtml, logo, share, toss].join("\n");
  assert.doesNotMatch(
    shipped,
    /흑야 사주 비망록|인연궁 합서|십년운 궁궐도|한 해의 왕명|길일 어명첩|흑야 온라인 사주첩|흑야 사주언박싱|강무영 상담각/,
  );
});

test("외부 심층 상품은 간결한 이름과 하오체 각오 카피, 히어로 직하단 가로 카드를 가진다", () => {
  assert.match(html, /운명 완전개봉/);
  assert.match(app, /운명 완전개봉/);
  assert.match(html, /premium-unboxing-card/);
  assert.match(css, /\.premium-unboxing-card/);
  assert.match(html, /가감 없이.*각오|각오를 단단히/);
  // 옛 이름 퇴출
  const shipped = [html, app, admin].join("\n");
  assert.doesNotMatch(shipped, /MZ다크무당 사주 리포트|운명 완전개봉 · 흑야 프리미엄/);
  // 신규 프리미엄 배너는 첫 화면, 기존 프리미엄 배너는 네 번째 슬라이드로 유지
  assert.doesNotMatch(html, /banner-copy-right[\s\S]{0,200}택일 캘린더/);
  assert.match(html, /data-slide="0"[\s\S]{0,400}heukya-premium-fortune-reader\.jpg[\s\S]{0,400}data-product-id="mz-dark-mudang-online"/);
  assert.match(html, /data-slide="3"[\s\S]{0,400}data-product-id="mz-dark-mudang-online"/);
  assert.equal([...html.matchAll(/class="banner-slide(?: is-active)?"/g)].length, 4);
  assert.equal([...html.matchAll(/data-slide-target="\d"/g)].length, 4);
});

test("홈 그리드에서 추가질문 카드는 빠지고 AI 챗봇 상담이 세로형으로 대체한다", () => {
  assert.doesNotMatch(html, /<h2>추가 질문 상담<\/h2>/);
  assert.match(html, /product-card chat-product-card/);
  assert.doesNotMatch(html, /product-card-wide chat-product-card/);
  // 메인 하단 '메뉴 바로가기'는 제거됨 (2026-07 UI 정비)
  assert.doesNotMatch(html, /footer-menu/);
});

test("운영 런타임 설정 migration은 이미지 스킨만 흑야로, 상품명은 원래대로 유지한다", () => {
  assert.match(migration, /site_config/);
  assert.match(migration, /기본 사주 리포트/);
  assert.match(migration, /운명 완전개봉/);
  assert.match(migration, /사주언박싱-mini/);
  assert.match(migration, /heukya-premium-hero\.jpg/);
  assert.match(migration, /heukya-premium-dark-mudang\.jpg/);
  assert.doesNotMatch(migration, /흑야 사주 비망록|흑야 온라인 사주첩/);
  assert.match(migration, /notify pgrst,\s*'reload schema'/i);
});

test("출하 화면은 예전 스킨 자산(hero-lab·스쿼럴)을 참조하지 않는다", () => {
  const shipped = [html, css, app, admin, adminHtml, share, inventory].join("\n");
  assert.doesNotMatch(shipped, /hero-lab\.jpg|squirrel|mint bob hair/i);
});
