// 리포트 공개 공유.
//  POST /api/share        — 리포트 저장 → { token, url }
//  GET  /api/share?token= — 공개 HTML(OG 메타 포함, 로그인 불필요). /share/<token> 으로 rewrite.
import { randomBytes } from "crypto";
import { readJson, sendJson, baseUrl } from "./_lib/http.js";
import { getSupabase, loadSiteConfig } from "./_lib/supabase.js";

const MAX_SECTIONS = 24;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function tokenFrom(req) {
  if (req.query?.token) return String(req.query.token).trim();
  try {
    return new URL(req.url, baseUrl(req)).searchParams.get("token")?.trim() || "";
  } catch {
    return "";
  }
}

function htmlResponse(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (status === 200) res.setHeader("Cache-Control", "public, max-age=300");
  res.end(html);
}

export default async function handler(req, res) {
  const sb = getSupabase();

  if (req.method === "POST") {
    if (!sb) return sendJson(res, 503, { message: "공유 기능을 사용할 수 없습니다 (DB 미설정)." });
    const body = (await readJson(req)) || {};
    const { productId, productName, profileName, headline, sections, lucky, score, scoreLabel } = body;
    if (!headline || !Array.isArray(sections) || sections.length === 0) {
      return sendJson(res, 400, { message: "공유할 리포트 내용이 없습니다." });
    }
    const payload = {
      productId: String(productId || "saju-analysis"),
      productName: String(productName || "사주 리포트"),
      profileName: String(profileName || ""),
      headline: String(headline),
      sections: sections.slice(0, MAX_SECTIONS).map((s) => ({
        icon: String(s.icon || "✨"),
        title: String(s.title || ""),
        body: String(s.body || ""),
      })),
      lucky: lucky && typeof lucky === "object" ? lucky : null,
      score: Number.isFinite(Number(score)) ? Number(score) : null,
      scoreLabel: scoreLabel ? String(scoreLabel) : null,
    };
    const token = randomBytes(9).toString("base64url"); // 추측 불가 랜덤(미인덱싱)
    const { error } = await sb.from("shared_reports").insert({ token, product_id: payload.productId, payload });
    if (error) return sendJson(res, 500, { message: error.message });
    return sendJson(res, 200, { ok: true, token, url: `${baseUrl(req)}/share/${token}` });
  }

  if (req.method === "GET") {
    const token = tokenFrom(req);
    if (!sb || !token) return htmlResponse(res, 404, notFoundHtml());
    let data = null;
    try {
      ({ data } = await sb.from("shared_reports").select("payload").eq("token", token).maybeSingle());
    } catch {
      data = null;
    }
    if (!data?.payload) return htmlResponse(res, 404, notFoundHtml());
    let kakaoJsKey = "";
    try {
      const cfg = await loadSiteConfig();
      kakaoJsKey = cfg?.kakaoJsKey || process.env.KAKAO_JS_KEY || "";
    } catch {
      kakaoJsKey = process.env.KAKAO_JS_KEY || "";
    }
    return htmlResponse(res, 200, renderHtml(data.payload, `${baseUrl(req)}/share/${token}`, baseUrl(req), kakaoJsKey));
  }

  return sendJson(res, 405, { message: "GET/POST only" });
}

function notFoundHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>공유 링크를 찾을 수 없어요</title></head>
<body style="font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;background:#fffdf9;color:#243145;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px;margin:0">
<div><h1 style="font-size:22px">공유 링크가 만료됐거나 없어요</h1><p style="color:#6e726d">링크를 다시 확인해 주세요.</p></div></body></html>`;
}

function paragraphs(body) {
  return String(body || "")
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderHtml(payload, shareUrl, base, kakaoJsKey) {
  const title = payload.profileName ? `${payload.profileName}님의 ${payload.productName}` : payload.productName;
  const desc = (payload.sections[0]?.body || payload.headline || "").slice(0, 110).replace(/\s+/g, " ");
  const ogImage = `${base}/assets/generated/banners/heukya-premium-hero.jpg`;
  const sections = payload.sections
    .map(
      (s) => `<details class="sec" open><summary><span>${esc(s.icon)}</span>${esc(s.title)}</summary><div class="body">${paragraphs(s.body)}</div></details>`,
    )
    .join("");
  const scoreBar = payload.score != null
    ? `<div class="score"><b>${esc(payload.score)}</b><span>/100 ${esc(payload.scoreLabel || "")}</span></div>`
    : "";
  const kakao = kakaoJsKey
    ? `<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" crossorigin="anonymous"></script>
<script>try{if(window.Kakao&&!Kakao.isInitialized())Kakao.init(${JSON.stringify(kakaoJsKey)});}catch(e){}
function shareKakao(){try{Kakao.Share.sendDefault({objectType:'feed',content:{title:${JSON.stringify(title)},description:${JSON.stringify(desc)},imageUrl:${JSON.stringify(ogImage)},link:{mobileWebUrl:location.href,webUrl:location.href}}});}catch(e){copyLink();}}</script>`
    : `<script>function shareKakao(){copyLink();}</script>`;

  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · 사주언박싱-mini</title>
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(shareUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<style>
:root{--ink:#243145;--muted:#6e726d;--line:#e7dfd3;--rose:#ff5f8f}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;background:#fffdf9;color:var(--ink)}
.wrap{max-width:640px;margin:0 auto;padding:24px 16px 64px}
.brand{display:flex;align-items:center;gap:8px;font-weight:900;margin-bottom:18px}.brand .m{width:34px;height:34px;border-radius:10px;background:var(--ink);color:#fff;display:grid;place-items:center}
.headline{font-size:22px;font-weight:950;line-height:1.4;margin:6px 0 14px}
.score{display:flex;align-items:baseline;gap:8px;margin-bottom:14px}.score b{font-size:34px;color:var(--rose)}.score span{color:var(--muted)}
.sec{border-bottom:1px solid var(--line)}
.sec summary{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:center;padding:16px 4px;font-size:17px;font-weight:950;cursor:pointer;list-style:none}
.sec summary::-webkit-details-marker{display:none}.sec summary span{color:var(--rose)}
.sec .body p{margin:0 0 12px;padding:0 4px;color:#3d4540;line-height:1.75;white-space:pre-wrap}
.share{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0}
.share button,.share a{flex:1;min-width:120px;text-align:center;padding:12px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--ink);font-weight:800;font-size:14px;cursor:pointer;text-decoration:none}
.cta{display:block;text-align:center;margin-top:8px;padding:14px;border-radius:14px;background:var(--ink);color:#fff;font-weight:900;text-decoration:none}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
</style></head><body>
<div class="wrap">
<div class="brand"><span class="m">命</span>사주언박싱-mini</div>
<p class="headline">${esc(payload.headline)}</p>
${scoreBar}
${sections}
<div class="share">
<button onclick="copyLink()">링크 복사</button>
<button onclick="shareKakao()">카카오톡</button>
<a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener">X</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener">페이스북</a>
</div>
<a class="cta" href="${esc(base)}/">나도 무료 사주 보기 →</a>
</div>
<div class="toast" id="t">링크를 복사했어요</div>
<script>
function copyLink(){navigator.clipboard?.writeText(location.href).then(showToast,showToast)||showToast();}
function showToast(){var t=document.getElementById('t');t.classList.add('on');setTimeout(function(){t.classList.remove('on')},1500);}
</script>
${kakao}
</body></html>`;
}
