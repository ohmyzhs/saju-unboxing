import test from "node:test";
import assert from "node:assert/strict";

await import("../apps/web/public/chat-markdown.js");

test("챗봇 Markdown 응답은 굵게·구분선·목록 구조로 렌더링된다", () => {
  const html = globalThis.ChatMarkdown.render([
    "다만 **핵심 조언**입니다.",
    "",
    "---",
    "",
    "📌 **현재 운세 흐름**",
    "",
    "1. **첫 항목**",
    "   - 하위 설명",
    "",
    "- **지금 시기**는 기다리는 기술이 중요합니다.",
  ].join("\n"));

  assert.match(html, /class="chat-markdown"/);
  assert.match(html, /<strong>핵심 조언<\/strong>/);
  assert.match(html, /<hr \/>/);
  assert.match(html, /class="chat-md-heading"/);
  assert.match(html, /<ol>/);
  assert.match(html, /<li><strong>첫 항목<\/strong><ul><li>하위 설명<\/li><\/ul><\/li>/);
  assert.match(html, /<ul><li><strong>지금 시기<\/strong>는 기다리는 기술이 중요합니다\.<\/li><\/ul>/);
  assert.doesNotMatch(html, /\*\*/);
});

test("ATX 헤딩(###)은 원문 노출 없이 헤딩 스타일로 렌더링된다", () => {
  const html = globalThis.ChatMarkdown.render([
    "### 조심해야 할 점",
    "- 원국에 **겁재**가 강력해서 주의가 필요합니다.",
    "",
    "## 요약 ##",
    "본문 문단.",
  ].join("\n"));

  assert.match(html, /<p class="chat-md-heading"><strong>조심해야 할 점<\/strong><\/p>/);
  assert.match(html, /<p class="chat-md-heading"><strong>요약<\/strong><\/p>/);
  assert.match(html, /<ul><li>원국에 <strong>겁재<\/strong>가 강력해서 주의가 필요합니다\.<\/li><\/ul>/);
  assert.doesNotMatch(html, /#{2,}/);
});

test("챗봇 Markdown 렌더러는 HTML을 실행 가능한 마크업으로 통과시키지 않는다", () => {
  const html = globalThis.ChatMarkdown.render("<img src=x onerror=alert(1)> **안전**");

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<strong>안전<\/strong>/);
  assert.doesNotMatch(html, /<img/);
});
