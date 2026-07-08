import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../apps/web/public/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../apps/web/public/admin.js", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../apps/web/public/admin.html", import.meta.url), "utf8");
const setupHtml = readFileSync(new URL("../apps/web/public/setup.html", import.meta.url), "utf8");
const logo = readFileSync(new URL("../apps/web/public/assets/ui/logo.svg", import.meta.url), "utf8");
const share = readFileSync(new URL("../apps/api/src/legacy/share.js", import.meta.url), "utf8");
const toss = readFileSync(new URL("../apps/api/src/legacy/_lib/toss.js", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../apps/web/public/assets/ASSET_INVENTORY.md", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260708090000_heukya_theme_defaults.sql", import.meta.url), "utf8");

test("홈은 흑야 조선 미스터리 세계관과 강무영 캐릭터를 전면에 건다", () => {
  assert.match(html, /흑야/);
  assert.match(html, /강무영/);
  assert.match(html, /조선/);
  assert.match(html, /운명.*함|함.*운명/);
  assert.match(html, /assets\/generated\/banners\/heukya-premium-hero/);
  assert.match(css, /--midnight-ink:\s*#101722/i);
  assert.match(css, /--royal-gold:\s*#c9a227/i);
  assert.match(css, /--blood-moon:\s*#6f2530/i);
  assert.doesNotMatch(inventory, /mint bob hair|squirrel|운박사/i);
});

test("모든 주요 상품은 조선 테마 썸네일과 사극풍 상품 카피를 사용한다", () => {
  for (const asset of [
    "heukya-premium-saju-reading.jpg",
    "heukya-premium-compatibility.jpg",
    "heukya-premium-fortune-cycle.jpg",
    "heukya-premium-dark-mudang.jpg",
    "heukya-premium-auspicious-date.jpg",
    "heukya-premium-year-wheel.jpg",
    "heukya-premium-consult-chat.jpg",
    "heukya-premium-daily-note.jpg",
  ]) {
    assert.match(html + app + inventory, new RegExp(asset.replace(".", "\\.")));
  }
  assert.match(app, /봉인된 사주의 함/);
  assert.match(app, /궁궐/);
  assert.match(app, /어명이 내려오기 전/);
  assert.match(app, /하오/);
});

test("운영 런타임 설정도 흑야 테마 상품명과 이미지를 기본값으로 갱신한다", () => {
  assert.match(migration, /site_config/);
  assert.match(migration, /흑야 사주 비망록/);
  assert.match(migration, /흑야 온라인 사주첩/);
  assert.match(migration, /heukya-premium-hero\.jpg/);
  assert.match(migration, /heukya-premium-dark-mudang\.jpg/);
  assert.match(migration, /notify pgrst,\s*'reload schema'/i);
});

test("출하되는 화면과 주문명은 예전 미니·스쿼럴 테마를 참조하지 않는다", () => {
  const shipped = [html, css, app, admin, adminHtml, setupHtml, logo, share, toss, migration].join("\n");
  assert.doesNotMatch(shipped, /사주언박싱-mini|AI 챗봇 상담|hero-lab\.jpg|squirrel|mint bob hair/i);
  assert.match(shipped, /흑야 사주언박싱/);
  assert.match(shipped, /흑야 사주 비망록/);
});
