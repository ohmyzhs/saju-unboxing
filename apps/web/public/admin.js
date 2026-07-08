const PRODUCT_CONFIG_KEY = "saju_lab_product_config_v1";
const PROFILE_KEY = "saju_lab_profiles_v3";
const ARCHIVE_KEY = "saju_lab_archive_v3";
const ORDER_KEY = "saju_lab_orders_v1";

const DEFAULT_PRODUCTS = {
  "saju-analysis": {
    name: "흑야 사주 비망록",
    amount: 990,
    description: "봉인된 사주의 함을 열어 기질, 재물, 직업, 인연의 결을 정중한 사극체 하오체로 고하오.",
    prompt: "흑야 강무영 세계관을 유지하며 정통 명리 해석을 사극 하오체로 작성한다.",
  },
  compatibility: {
    name: "인연궁 합서",
    amount: 990,
    description: "두 사람 사이에 흐르는 끌림과 어긋남을 궁궐의 등불 아래 차분히 풀어드리오.",
    prompt: "두 사람의 인연을 조선 궁궐 문답처럼 정중한 하오체로 작성한다.",
  },
  cycle: {
    name: "십년운 궁궐도",
    amount: 990,
    description: "십 년마다 바뀌는 운의 문과 돌아서야 할 회랑을 지도처럼 펼쳐 보이오.",
    prompt: "대운 시작 시점과 10년 단위 흐름을 궁궐도처럼 펼치되 사극 하오체로 작성한다.",
  },
  "yearly-fortune": {
    name: "한 해의 왕명",
    amount: 990,
    description: "선택한 해의 총운과 계절별 징조, 달마다 조심할 문턱을 고하오.",
    prompt: "세운과 원국의 작용을 기준으로 한 해의 왕명을 받드는 말투로 작성한다.",
  },
  "auspicious-date": {
    name: "길일 어명첩",
    amount: 990,
    description: "어명이 내려오기 전, 선택한 목적과 후보 날짜를 사주 흐름에 맞춰 비교해 올리오.",
    prompt: "후보 날짜만 비교해 길일 순위와 활용법을 사극 하오체로 작성한다.",
  },
  "mz-dark-mudang-online": {
    name: "흑야 온라인 사주첩",
    amount: 9900,
    description: "젊은 군주 강무영의 흑금 세계관으로 펼치는 온라인뷰 전용 프리미엄 사주첩이오.",
    prompt: "saju-web tight-v3 온라인뷰 리포트로 생성한다. franchise에서는 결제와 열람 연결만 담당한다.",
  },
  "daily-fortune": {
    name: "오늘의 기운 전갈",
    amount: 0,
    description: "궁궐 새벽에 먼저 도착한 전갈처럼 오늘의 분위기와 마음가짐을 짧게 고하오.",
    prompt: "오늘 하루의 분위기, 관계, 일, 소비, 컨디션을 짧고 실용적인 사극 하오체로 작성한다.",
  },
  followup: {
    name: "흑야 문답 1회권",
    amount: 990,
    description: "이미 받은 사주첩의 만세력을 그대로 두고, 더 궁금한 한 대목에 답을 올리오.",
    prompt: "이미 계산된 만세력을 근거로 고객의 추가 질문에 정면으로, 사극 하오체로 답한다.",
  },
};

let analytics = {
  events: [],
  orders: [],
  visitors: [],
  exits: [],
  sources: [],
  utms: [],
  funnel: {},
  totals: {},
};

// 방문자 → 로그인 계정(카카오/이메일) 매핑. 주문·분석에서 채워(renderDashboard) 방문자 분석에 표시.
let visitorAccountMap = new Map();
let pointAdminData = { members: [], account: null, selectedUserId: null };
let pointMemberFilter = "";

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let serverConfig = { products: {}, prompts: {}, images: {}, branding: {}, ai_model: "glm-5.2", chat_model: "" };

const IMAGE_SLOTS = [
  ["banner.hero", "메인 배너"],
  ["thumb.saju-analysis", "사주 썸네일"],
  ["thumb.compatibility", "궁합 썸네일"],
  ["thumb.cycle", "대운 썸네일"],
  ["thumb.yearly-fortune", "연도 썸네일"],
  ["thumb.mz-dark-mudang-online", "흑야 온라인 썸네일"],
  ["thumb.daily-fortune", "오늘 썸네일"],
  ["loading.hero", "분석 로딩 움짤 (gif 권장 · 비우면 기본 애니메이션)"],
];

const EVENT_LABELS = {
  page_view: "방문",
  product_select: "상품 선택",
  checkout_view: "주문 확인",
  payment_start: "결제 시작",
  payment_success: "결제 완료",
  payment_error: "결제 오류",
  analysis_start: "분석 시작",
  analysis_complete: "분석 완료",
};

// 운영 콘솔 매직넘버 → 의미 있는 상수
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 업로드 이미지 상한(4MB)
const MIN_PASSWORD_LENGTH = 4; // 관리자 비밀번호 최소 길이

function getProducts() {
  return Object.fromEntries(
    Object.entries(DEFAULT_PRODUCTS).map(([id, product]) => [
      id,
      {
        ...product,
        ...(serverConfig.products?.[id] || {}),
        prompt: serverConfig.prompts?.[id] ?? "", // 추가 지침(append) — 비우면 기본 프롬프트 그대로

      },
    ]),
  );
}

function formatWon(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatPoints(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}pt`;
}

function adminPaymentLabel(order) {
  const cash = Number(order.cashAmount ?? order.amount ?? 0);
  const points = Number(order.pointsUsed || 0);
  if (order.payMethod === "mixed" || (cash > 0 && points > 0)) return `현금 ${formatWon(cash)} + ${formatPoints(points)}`;
  if (order.payMethod === "points" || points > 0) return formatPoints(points);
  return `현금 ${formatWon(cash)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace(".0", "")}%`;
}

function shortDate(timestamp) {
  const d = new Date(timestamp || Date.now());
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function duration(ms) {
  if (!ms) return "-";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

function safe(value) {
  return String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function renderProductForms() {
  const products = getProducts();
  const productForm = document.querySelector("[data-product-form]");
  if (!productForm) return;

  productForm.innerHTML = Object.entries(products)
    .map(
      ([id, product]) => `
        <article class="admin-product-card">
          <input type="hidden" name="${id}:id" value="${id}" />
          <label>상품명 <input name="${id}:name" value="${safe(product.name)}" /></label>
          <label>가격 (원) <input name="${id}:amount" type="number" min="0" step="10" value="${Number(product.amount || 0)}" /></label>
          <label>사용자 설명 <textarea name="${id}:description" rows="3">${safe(product.description)}</textarea></label>
        </article>
      `,
    )
    .join("") + `<button class="primary-action admin-save" type="submit">상품 설정 저장</button>`;
}

function collectProductConfig(form) {
  const data = new FormData(form);
  const products = getProducts();
  const next = {};
  Object.keys(products).forEach((id) => {
    next[id] = {
      ...products[id],
      name: String(data.get(`${id}:name`) || products[id].name).trim(),
      amount: Number(data.get(`${id}:amount`) || 0),
      description: String(data.get(`${id}:description`) || products[id].description).trim(),
      prompt: String(data.get(`${id}:prompt`) || products[id].prompt || "").trim(),
    };
  });
  return next;
}

// 관리자 API 공통 호출(JSON POST) → {ok, status, body}로 통일.
// 401(미인증)은 호출부에서 showLogin()으로 처리 — 인증 흐름을 호출부에 드러낸다.
async function adminPost(path, payload) {
  const res = await window.SajuApi.fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function saveConfig(patch, statusSel, okMsg) {
  const status = statusSel ? document.querySelector(statusSel) : null;
  setStatus(status, "저장 중...");
  try {
    const { ok, status: code, body } = await adminPost("/api/admin/config", patch);
    if (code === 401) return showLogin();
    if (!ok) {
      setStatus(status, `저장 실패: ${body.message || code}`, "error");
      return;
    }
    Object.assign(serverConfig, patch);
    renderProductForms();
    setStatus(status, okMsg, "ok");
  } catch (e) {
    setStatus(status, `저장 실패: ${e.message}`, "error");
  }
}

function saveProductBasics(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const products = getProducts();
  const nextProducts = { ...(serverConfig.products || {}) };
  Object.keys(products).forEach((id) => {
    nextProducts[id] = {
      ...(nextProducts[id] || {}),
      name: String(data.get(`${id}:name`) || products[id].name).trim(),
      amount: Number(data.get(`${id}:amount`) || 0),
      description: String(data.get(`${id}:description`) || products[id].description).trim(),
    };
  });
  saveConfig(
    { products: nextProducts },
    "[data-product-status]",
    "상품명·가격·설명을 저장했습니다. 사용자 화면 새로고침 시 반영됩니다.",
  );
}

async function loadConfig() {
  try {
    const res = await window.SajuApi.fetch("/api/admin/config", { cache: "no-store" });
    if (res.status === 401) {
      showLogin();
      return false; // 미로그인 → 화면 잠금 유지
    }
    if (res.ok) serverConfig = await res.json();
    document.body.classList.remove("locked"); // 인증 확인됨 → 화면 공개
    return true;
  } catch {
    // 네트워크 오류 등 인증 확인 불가 → 잠금 유지 + 로그인 표시
    showLogin();
    return false;
  }
}

function showLogin() {
  document.body.classList.add("locked"); // 로그인 전에는 관리 화면 숨김
  if (document.getElementById("admin-login")) return;
  const wrap = document.createElement("div");
  wrap.id = "admin-login";
  wrap.className = "admin-login";
  wrap.innerHTML = `
    <form id="admin-login-form">
      <div class="admin-login-brand"><span>命</span><h2>흑야 사주언박싱 관리자</h2></div>
      <p class="sub">관리자 비밀번호를 입력해 주세요.</p>
      <input type="password" id="admin-pw" placeholder="관리자 비밀번호" autocomplete="current-password" />
      <button type="submit">로그인</button>
      <p id="admin-login-msg" class="admin-login-msg"></p>
    </form>`;
  document.body.appendChild(wrap);
  document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const msg = document.getElementById("admin-login-msg");
    const password = document.getElementById("admin-pw").value;
    try {
      const { ok, body } = await adminPost("/api/admin/login", { password });
      if (ok) {
        wrap.remove();
        init();
      } else {
        msg.textContent = body.message || "로그인 실패";
      }
    } catch (e) {
      msg.textContent = e.message;
    }
  });
}

function renderImages() {
  const grid = document.querySelector("[data-image-grid]");
  if (!grid) return;
  grid.innerHTML = IMAGE_SLOTS.map(([key, label]) => {
    const url = serverConfig.images?.[key] || "";
    return `
      <article class="admin-product-card">
        <header><b>${label}</b><span>${key}</span></header>
        ${url ? `<img src="${safe(url)}" alt="" />` : `<div class="empty-box">이미지 없음</div>`}
        <input type="file" accept="image/*" data-image-input="${key}" />
        <p class="form-status" data-image-status="${key}"></p>
      </article>`;
  }).join("");
  grid.querySelectorAll("[data-image-input]").forEach((input) => {
    input.addEventListener("change", () => uploadImage(input.dataset.imageInput, input.files?.[0]));
  });
}

function uploadImage(key, file) {
  if (!file) return;
  const status = document.querySelector(`[data-image-status="${key}"]`);
  if (file.size > MAX_IMAGE_BYTES) {
    setStatus(status, "4MB 이하 이미지만 업로드하세요.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    setStatus(status, "업로드 중...");
    try {
      const { ok, status: code, body } = await adminPost("/api/admin/upload", { key, dataUrl: reader.result });
      if (code === 401) return showLogin();
      if (ok) {
        serverConfig.images = body.images || { ...serverConfig.images, [key]: body.url };
        renderImages();
        setStatus(status, "업로드 완료! 사용자 화면 새로고침 시 반영됩니다.", "ok");
      } else {
        setStatus(status, `실패: ${body.message || code}`, "error");
      }
    } catch (e) {
      setStatus(status, `실패: ${e.message}`, "error");
    }
  };
  reader.readAsDataURL(file);
}

function statusPill(label) {
  const s = String(label ?? "-");
  let cls = "";
  if (/(실패|오류|취소|에러|거절|거부)/.test(s)) cls = " is-danger";
  else if (/(준비|대기|진행|시작)/.test(s)) cls = " is-warn";
  else if (/(완료|성공|승인)/.test(s)) cls = " is-ok";
  return `<span class="status-pill${cls}">${safe(s)}</span>`;
}

// 고객 계정 출처 배지(카카오/이메일/비회원)
function providerBadge(provider) {
  if (provider === "kakao") return `<span class="acct-badge acct-kakao">카카오</span>`;
  if (provider === "email") return `<span class="acct-badge acct-email">이메일</span>`;
  return `<span class="acct-badge acct-guest">비회원</span>`;
}

function setStatus(elOrSel, msg, kind) {
  const el = typeof elOrSel === "string" ? document.querySelector(elOrSel) : elOrSel;
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("is-ok", "is-error");
  if (kind === "ok") el.classList.add("is-ok");
  else if (kind === "error") el.classList.add("is-error");
}

function renderTable(target, rows, empty, head) {
  if (!target) return;
  const thead = head
    ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`
    : "";
  target.innerHTML = rows.length
    ? `<table>${thead}<tbody>${rows.join("")}</tbody></table>`
    : `<div class="empty-box">${empty}</div>`;
}

function renderFunnel() {
  const entries = Object.entries(EVENT_LABELS).filter(([key]) => key !== "payment_error");
  const max = Math.max(...entries.map(([key]) => analytics.funnel[key] || 0), 1);
  document.querySelector("[data-admin-funnel]").innerHTML = entries
    .map(([key, label], index) => {
      const count = analytics.funnel[key] || 0;
      const prevCount = index === 0 ? 0 : (analytics.funnel[entries[index - 1][0]] || 0);
      let rateLabel;
      if (index === 0) {
        rateLabel = "기준 단계";
      } else if (!prevCount) {
        rateLabel = "-";
      } else {
        rateLabel = `이전 대비 ${formatPercent((count / prevCount) * 100)}`;
      }
      return `
        <article>
          <span>${label}</span>
          <strong>${count.toLocaleString("ko-KR")}</strong>
          <small class="funnel-rate">${rateLabel}</small>
          <div><i style="width:${Math.max(4, (count / max) * 100)}%"></i></div>
        </article>
      `;
    })
    .join("");

  renderTable(
    document.querySelector("[data-admin-events]"),
    analytics.events.slice(0, 80).map((event) => `
      <tr>
        <td><b>${safe(event.event)}</b><small>${shortDate(event.at)} · ${safe(event.view || event.page)}</small></td>
        <td>${safe(event.visitorId || "-").slice(0, 18)}</td>
        <td>${safe(event.metadata?.productId || event.metadata?.orderId || "-")}</td>
        <td>${duration(event.durationMs)}</td>
      </tr>
    `),
    "아직 이벤트가 없습니다.",
    ["이벤트", "방문자", "대상", "체류"],
  );
}

function renderTrafficTables() {
  renderTable(
    document.querySelector("[data-admin-visitors-table]"),
    analytics.visitors.map((visitor) => {
      const acct = visitorAccountMap.get(visitor.visitorId);
      const acctCell = acct
        ? `${providerBadge(acct.provider)} <b>${safe(acct.label)}</b>`
        : `<span class="acct-badge acct-guest">비회원</span>`;
      return `
      <tr>
        <td><b>${safe(visitor.visitorId).slice(0, 22)}</b><small>${safe(visitor.sessionId).slice(0, 22)}</small></td>
        <td>${acctCell}</td>
        <td>${safe(visitor.ip)}</td>
        <td><b>${safe(visitor.device)}</b><small>${safe(visitor.os)} · ${safe(visitor.browser)}</small></td>
        <td><b>${visitor.paid ? "결제자" : "방문자"}</b><small>${visitor.eventCount} events</small></td>
        <td><b>${safe(visitor.landingPage)}</b><small>last: ${safe(visitor.lastPage)}</small></td>
      </tr>
    `;
    }),
    "아직 방문자 데이터가 없습니다.",
    ["방문자 / 세션", "계정", "IP", "기기 / OS", "상태", "유입 / 최근 페이지"],
  );

  renderTable(
    document.querySelector("[data-admin-sources]"),
    analytics.sources.map((item) => `
      <tr>
        <td><b>${safe(item.source)}</b><small>referral/source</small></td>
        <td>${item.count.toLocaleString("ko-KR")}회</td>
      </tr>
    `),
    "레퍼럴 데이터가 없습니다.",
    ["유입 출처", "방문 수"],
  );

  renderTable(
    document.querySelector("[data-admin-utms]"),
    analytics.utms.map((item) => `
      <tr>
        <td><b>${safe(item.utm)}</b><small>source / medium / campaign</small></td>
        <td>${item.count.toLocaleString("ko-KR")}회</td>
      </tr>
    `),
    "UTM 데이터가 없습니다.",
    ["UTM 캠페인", "방문 수"],
  );

  renderTable(
    document.querySelector("[data-admin-exits-table]"),
    analytics.exits.map((item) => `
      <tr>
        <td><b>${safe(item.page)}</b><small>평균 체류 ${duration(item.avgDurationMs)}</small></td>
        <td>${item.exits.toLocaleString("ko-KR")}회 이탈</td>
      </tr>
    `),
    "이탈 이벤트가 없습니다.",
    ["이탈 페이지", "이탈 수"],
  );
}

function renderTrend(target, items, key, formatter) {
  if (!target) return;
  if (!items?.length) {
    target.innerHTML = `<span class="trend-empty">아직 데이터가 없어요</span>`;
    return;
  }
  const max = Math.max(...items.map((i) => Number(i[key] || 0)), 1);
  target.innerHTML = items
    .map((item) => {
      const value = Number(item[key] || 0);
      const ratio = value / max;
      const heightPct = value ? Math.max(8, Math.round(ratio * 100)) : 4;
      return `<span style="height:${heightPct}%" data-label="${safe(item.label)}" data-value="${safe(formatter ? formatter(value) : value)}" data-zero="${value === 0}"></span>`;
    })
    .join("");
}

function renderDistribution(target, items) {
  if (!target) return;
  const total = items.reduce((sum, i) => sum + Number(i.count || 0), 0) || 1;
  target.innerHTML = items.length
    ? items
        .slice(0, 6)
        .map(
          (item) => `
            <li>
              <b>${safe(item.label)}</b>
              <span>${item.count.toLocaleString("ko-KR")}회</span>
              <div class="bar"><i style="width:${Math.max(4, Math.round((item.count / total) * 100))}%"></i></div>
            </li>
          `,
        )
        .join("")
    : `<li class="is-empty">아직 데이터가 없습니다.</li>`;
}

function renderJourneys(target, journeys) {
  if (!target) return;
  target.innerHTML = journeys.length
    ? journeys
        .map((v) => {
          const steps = (v.journey || [])
            .map(
              (step) =>
                `<span class="${step.event === "payment_success" ? "is-paid" : ""}">${safe(EVENT_LABELS[step.event] || step.event)}${step.page ? ` · ${safe(step.page)}` : ""}</span>`,
            )
            .join("");
          return `
            <article class="journey-card">
              <header>
                <b>${safe(v.visitorId).slice(0, 22)} · ${safe(v.device)}/${safe(v.os)}/${safe(v.browser)}</b>
                <span>${v.paid ? "💳 결제자" : "방문자"} · ${shortDate(v.lastSeen)}</span>
              </header>
              <div class="journey-steps">${steps || `<span>이벤트 없음</span>`}</div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-box">방문 여정 데이터가 없습니다.</div>`;
}

function renderDashboard() {
  // 어드민은 '서버(Supabase) 데이터'만 본다 — 어드민 브라우저의 localStorage가 아니라 실제 고객 데이터.
  const allOrders = analytics.orders || [];
  const analyses = analytics.analyses || [];
  const paidOrders = allOrders.filter((order) => order.status === "결제 완료");

  // 고객 집계 — '계정(카카오/이메일)' 기준. 로그인 사용자는 user_id로 묶고(카카오 닉네임/이메일),
  // 미로그인은 visitor_id 기준 '비회원'으로 묶는다. (한 계정이 여러 사람을 분석해도 고객은 1명)
  const customerMap = new Map();
  const touchCustomer = (rec) => {
    let key, label, provider;
    if (rec.userId) {
      key = `u:${rec.userId}`;
      label = rec.userLabel || "회원";
      provider = rec.userProvider === "email" ? "email" : "kakao";
    } else {
      key = `g:${rec.visitorId || "unknown"}`;
      label = "비회원";
      provider = "guest";
    }
    if (!customerMap.has(key)) {
      customerMap.set(key, { key, label, provider, visitorId: rec.visitorId || "", analyses: 0, orders: 0, paid: 0, lastAt: 0 });
    }
    return customerMap.get(key);
  };
  analyses.forEach((a) => {
    const c = touchCustomer(a);
    c.analyses += 1;
    c.lastAt = Math.max(c.lastAt, a.createdAt || 0);
  });
  allOrders.forEach((o) => {
    const c = touchCustomer(o);
    c.orders += 1;
    if (o.status === "결제 완료") c.paid += Number(o.amount || 0);
    c.lastAt = Math.max(c.lastAt, o.approvedAt || o.createdAt || 0);
  });
  const customers = [...customerMap.values()].sort((a, b) => b.lastAt - a.lastAt);

  // 방문자별 로그인 계정(카카오/이메일) 매핑 — 주문·분석에 남은 visitor_id↔user 연결로 추정.
  visitorAccountMap = new Map();
  [...analyses, ...allOrders].forEach((rec) => {
    if (rec.userId && rec.visitorId && !visitorAccountMap.has(rec.visitorId)) {
      visitorAccountMap.set(rec.visitorId, {
        label: rec.userLabel || "회원",
        provider: rec.userProvider === "email" ? "email" : "kakao",
      });
    }
  });
  const todayKey = new Date().toDateString();
  const todayRevenue = paidOrders
    .filter((order) => {
      const at = order.approvedAt || order.updatedAt || order.createdAt;
      const d = new Date(at);
      return !Number.isNaN(d.getTime()) && d.toDateString() === todayKey;
    })
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const visitors = analytics.totals?.visitors || 0;
  const payers = analytics.totals?.payers || 0;
  const totals = analytics.totals || {};

  document.querySelector("[data-admin-revenue]").textContent = formatWon(todayRevenue);
  document.querySelector("[data-admin-visitors]").textContent = `${visitors.toLocaleString("ko-KR")}명`;
  document.querySelector("[data-admin-payers]").textContent = `${payers.toLocaleString("ko-KR")}명`;
  document.querySelector("[data-admin-conversion]").textContent = formatPercent(visitors ? (payers / visitors) * 100 : 0);
  document.querySelector("[data-admin-analysis]").textContent = `${analyses.length.toLocaleString("ko-KR")}건`;
  document.querySelector("[data-admin-exits]").textContent = `${(analytics.totals?.exits || 0).toLocaleString("ko-KR")}건`;

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };
  setText("[data-admin-bounce]", formatPercent(totals.bounceRate || 0));
  setText("[data-admin-new]", `${Number(totals.newVisitors || 0).toLocaleString("ko-KR")}명`);
  setText("[data-admin-returning]", `${Number(totals.returningVisitors || 0).toLocaleString("ko-KR")}명`);
  setText("[data-admin-aov]", formatWon(totals.avgOrderValue || 0));
  setText("[data-admin-ltv]", formatWon(totals.ltv || 0));

  renderTable(
    document.querySelector("[data-admin-payments]"),
    allOrders.slice(0, 120).map((order) => `
      <tr>
        <td><b>${safe(DEFAULT_PRODUCTS[order.productId]?.name || order.productName || order.orderName || "상품")}</b><small>${safe(order.orderId || order.id || "-")}</small></td>
        <td>${order.userId ? `${providerBadge(order.userProvider)} <b>${safe(order.userLabel || "회원")}</b>` : `<span class="acct-badge acct-guest">비회원</span>`}</td>
        <td>${safe(order.profileName || "-")}</td>
        <td><b>${adminPaymentLabel(order)}</b><small>${order.payMethod === "points" ? "포인트 결제" : order.payMethod === "mixed" ? "혼합 결제" : "토스 결제"}</small></td>
        <td>${statusPill(order.status)}</td>
      </tr>
    `),
    "아직 결제 데이터가 없습니다.",
    ["상품 / 주문번호", "고객(계정)", "분석 대상", "금액", "상태"],
  );

  renderTable(
    document.querySelector("[data-admin-customers-list]"),
    customers.map((c) => `
      <tr>
        <td><b>${safe(c.label)}</b> ${providerBadge(c.provider)}${c.provider === "guest" && c.visitorId ? `<small>${safe(c.visitorId).slice(0, 12)}…</small>` : ""}</td>
        <td>${c.analyses.toLocaleString("ko-KR")}건</td>
        <td>${c.orders.toLocaleString("ko-KR")}건 · ${formatWon(c.paid)}</td>
        <td>${c.lastAt ? shortDate(c.lastAt) : "-"}</td>
      </tr>
    `),
    "아직 고객 데이터가 없습니다. (로그인 고객은 카카오/이메일 계정, 미로그인은 비회원으로 집계됩니다)",
    ["고객 (계정)", "분석 수", "결제 (건·금액)", "최근 활동"],
  );

  renderTable(
    document.querySelector("[data-admin-analyses]"),
    analyses.map((item) => `
      <tr>
        <td><b>${safe(DEFAULT_PRODUCTS[item.productId]?.name || item.productId || "분석")}</b><small>${safe(item.orderId || "무료/데모")}</small></td>
        <td>${safe(item.profileName)}</td>
        <td>${shortDate(item.createdAt)}</td>
        <td>${statusPill("완료")}</td>
      </tr>
    `),
    "아직 완료된 분석이 없습니다.",
    ["상품 / 주문", "프로필", "생성일", "상태"],
  );

  renderFunnel();
  renderTrafficTables();

  // Time series + distributions on overview
  renderTrend(document.querySelector("[data-admin-trend-visitors]"), analytics.timeline || [], "visitors");
  renderTrend(
    document.querySelector("[data-admin-trend-revenue]"),
    analytics.timeline || [],
    "revenue",
    (v) => formatWon(v),
  );
  renderDistribution(document.querySelector("[data-admin-dist-device]"), analytics.devices || []);
  renderDistribution(document.querySelector("[data-admin-dist-os]"), analytics.oses || []);
  renderDistribution(document.querySelector("[data-admin-dist-browser]"), analytics.browsers || []);
  renderDistribution(document.querySelector("[data-admin-dist-landing]"), analytics.landingPages || []);
  renderJourneys(document.querySelector("[data-admin-journeys]"), analytics.journeys || []);

  // Errors table
  renderTable(
    document.querySelector("[data-admin-errors]"),
    (analytics.errors || []).map(
      (err) => `
        <tr>
          <td><b>${safe(err.message)}</b><small>${shortDate(err.at)}</small></td>
          <td>${safe(err.productId || "-")}</td>
          <td>${safe(err.visitorId || "-").slice(0, 18)}</td>
        </tr>
      `,
    ),
    "결제 오류 기록이 없습니다.",
    ["오류 메시지", "상품", "방문자"],
  );
}

async function loadAnalytics() {
  try {
    const res = await window.SajuApi.fetch("/api/admin/analytics", { cache: "no-store" });
    if (res.status === 401) return showLogin();
    analytics = await res.json();
  } catch {
    analytics = { events: [], orders: [], visitors: [], exits: [], sources: [], utms: [], funnel: {}, totals: {} };
  }
  renderDashboard();
  const upd = document.querySelector("[data-admin-updated]");
  if (upd) upd.textContent = `갱신 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
}

const POINT_TYPE_LABELS = {
  charge: "충전",
  bonus: "충전 보너스",
  spend: "상품 결제",
  refund: "결제 환원",
  admin_adjust: "관리자 조정",
};

async function loadAdminPoints() {
  try {
    const res = await window.SajuApi.fetch("/api/admin/points", { cache: "no-store" });
    if (res.status === 401) return showLogin();
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || "포인트 정보를 불러오지 못했습니다.");
    pointAdminData = { ...body, account: null, selectedUserId: null };
    renderAdminPoints();
  } catch (error) {
    setStatus(document.querySelector("[data-admin-point-status]"), error.message, "error");
  }
}

async function loadAdminPointDetail(userId) {
  pointAdminData.selectedUserId = String(userId || "");
  pointAdminData.account = null;
  renderAdminPoints();
  const summary = document.querySelector("[data-admin-point-summary]");
  if (summary) summary.innerHTML = `<div class="empty-box is-loading"><span class="inline-spinner"></span>회원 정보를 불러오는 중…</div>`;
  try {
    const res = await window.SajuApi.fetch(`/api/admin/points?userId=${encodeURIComponent(pointAdminData.selectedUserId)}`, { cache: "no-store" });
    if (res.status === 401) return showLogin();
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || "회원 포인트 정보를 불러오지 못했습니다.");
    pointAdminData = { ...pointAdminData, selectedUserId: body.selectedUserId, account: body.account };
    renderAdminPoints();
  } catch (error) {
    setStatus(document.querySelector("[data-admin-point-status]"), error.message, "error");
  }
}

function renderAdminPoints() {
  const members = pointAdminData.members || [];
  const needle = pointMemberFilter.trim().toLowerCase();
  const visibleMembers = needle
    ? members.filter((member) => `${member.userLabel} ${member.userId} ${member.userProvider}`.toLowerCase().includes(needle))
    : members;
  renderTable(
    document.querySelector("[data-admin-point-members]"),
    visibleMembers.map((member) => `
      <tr>
        <td><button class="admin-member-pick${member.userId === pointAdminData.selectedUserId ? " is-active" : ""}" type="button" data-point-member="${safe(member.userId)}"><b>${safe(member.userLabel)}</b><small>${safe(member.userId)}</small></button></td>
        <td>${providerBadge(member.userProvider)}</td>
        <td><b>${formatPoints(member.balance)}</b><small>토큰 ${Number(member.regenTokens || 0)}개</small></td>
      </tr>`),
    needle ? "검색 결과가 없습니다." : "포인트 회원 데이터가 없습니다.",
    ["회원", "계정", "잔액"],
  );
  document.querySelectorAll("[data-point-member]").forEach((button) => {
    button.addEventListener("click", () => loadAdminPointDetail(button.dataset.pointMember));
  });

  const member = members.find((item) => item.userId === pointAdminData.selectedUserId);
  const account = pointAdminData.account;
  const title = document.querySelector("[data-admin-point-title]");
  const summary = document.querySelector("[data-admin-point-summary]");
  if (title) title.textContent = member ? `${member.userLabel} 포인트` : "회원을 선택하세요";
  if (summary) summary.innerHTML = member && account
    ? `<article><span>잔액</span><b>${formatPoints(account.balance)}</b></article><article><span>재생성 토큰</span><b>${Number(account.regenTokens || 0)}개</b></article>`
    : `<div class="empty-box">왼쪽 목록에서 회원을 선택하세요.</div>`;
  renderTable(
    document.querySelector("[data-admin-point-transactions]"),
    (account?.transactions || []).map((tx) => `
      <tr>
        <td><b>${safe(POINT_TYPE_LABELS[tx.type] || tx.type)}</b><small>${safe(tx.ref || "-")}</small></td>
        <td>${Number(tx.amount) >= 0 ? "+" : ""}${formatPoints(tx.amount)}</td>
        <td>${formatPoints(tx.balanceAfter)}<small>${shortDate(tx.createdAt)}</small></td>
      </tr>`),
    member ? "포인트 거래 내역이 없습니다." : "회원을 먼저 선택하세요.",
    ["유형 / 메모", "변경", "변경 후 잔액"],
  );
  const canAdjust = Boolean(member && account);
  document.querySelectorAll("[data-point-adjust] input, [data-regen-adjust] input, [data-point-adjust] button, [data-regen-adjust] button, [data-point-quick]").forEach((control) => {
    control.disabled = !canAdjust;
  });
}

async function submitPointAdmin(event, operation) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("[data-admin-point-status]");
  if (!pointAdminData.selectedUserId) return setStatus(status, "회원을 먼저 선택하세요.", "error");
  const data = new FormData(form);
  const amount = Number(data.get("amount"));
  const memo = String(data.get("memo") || "관리자 조정").trim();
  setStatus(status, "반영 중...");
  try {
    const { ok, status: code, body } = await adminPost("/api/admin/points", {
      operation,
      userId: pointAdminData.selectedUserId,
      amount,
      memo,
    });
    if (code === 401) return showLogin();
    if (!ok) throw new Error(body.message || "포인트 조정에 실패했습니다.");
    form.reset();
    if (operation === "regen") form.querySelector('[name="amount"]').value = "1";
    await loadAdminPointDetail(pointAdminData.selectedUserId);
    setStatus(status, operation === "regen" ? "재생성 토큰을 부여했습니다." : "포인트를 반영했습니다.", "ok");
  } catch (error) {
    setStatus(status, error.message, "error");
  }
}

document.querySelector("[data-point-member-search]")?.addEventListener("input", (event) => {
  pointMemberFilter = event.currentTarget.value || "";
  renderAdminPoints();
});

document.querySelectorAll("[data-point-quick]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = document.querySelector("[data-admin-point-status]");
    if (!pointAdminData.selectedUserId) return setStatus(status, "회원을 먼저 선택하세요.", "error");
    const operation = button.dataset.operation;
    const amount = Number(button.dataset.amount);
    button.disabled = true;
    setStatus(status, "반영 중...");
    try {
      const { ok, status: code, body } = await adminPost("/api/admin/points", {
        operation,
        amount,
        userId: pointAdminData.selectedUserId,
        memo: "관리자 빠른 조정",
      });
      if (code === 401) return showLogin();
      if (!ok) throw new Error(body.message || "포인트 조정에 실패했습니다.");
      await loadAdminPointDetail(pointAdminData.selectedUserId);
      setStatus(status, operation === "regen" ? "재생성 토큰을 부여했습니다." : "포인트를 반영했습니다.", "ok");
    } catch (error) {
      setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.toggle("is-active", item === tab));
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== tab.dataset.adminTab;
    });
    tab.closest("[data-nav-group]")?.classList.remove("is-collapsed");
    document.querySelector(".admin-sidebar")?.classList.remove("nav-open");
    if (tab.dataset.adminTab === "points") loadAdminPoints();
    window.scrollTo({ top: 0 });
  });
});

// 모바일 메뉴(햄버거) 토글
document.querySelector("[data-mobile-nav-toggle]")?.addEventListener("click", () => {
  document.querySelector(".admin-sidebar")?.classList.toggle("nav-open");
});

// 사이드바 그룹 접기/펼치기
document.querySelectorAll("[data-nav-toggle]").forEach((head) => {
  head.addEventListener("click", () => {
    head.closest("[data-nav-group]")?.classList.toggle("is-collapsed");
  });
});

// 초기: 활성 탭이 속한 그룹만 펼치고 나머지는 접기
(() => {
  const activeGroup = document.querySelector("[data-admin-tab].is-active")?.closest("[data-nav-group]");
  document.querySelectorAll("[data-nav-group]").forEach((g) => {
    g.classList.toggle("is-collapsed", g !== activeGroup);
  });
})();

function renderLegal() {
  const form = document.querySelector("[data-legal-form]");
  if (!form) return;
  const legal = serverConfig.legal || {};
  ["terms", "privacy", "refund"].forEach((key) => {
    const ta = form.querySelector(`textarea[name="${key}"]`);
    if (ta) ta.value = legal[key] || "";
  });
  form.querySelectorAll("[data-legal-default]").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.legalDefault;
      const ta = form.querySelector(`textarea[name="${key}"]`);
      const def = serverConfig.legalDefaults?.[key] || "";
      if (ta && def) ta.value = def;
    };
  });
}

function saveLegal(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const legal = {
    terms: String(data.get("terms") || "").trim(),
    privacy: String(data.get("privacy") || "").trim(),
    refund: String(data.get("refund") || "").trim(),
  };
  saveConfig({ legal }, "[data-legal-status]", "약관/정책을 저장했습니다. 사용자 화면 새로고침 시 반영됩니다.");
}

const BUSINESS_FIELDS = ["name", "owner", "regNo", "mailOrderNo", "address", "tel", "email", "privacyOfficer"];

function renderBusiness() {
  const form = document.querySelector("[data-business-form]");
  if (!form) return;
  const b = serverConfig.business || {};
  BUSINESS_FIELDS.forEach((k) => {
    const input = form.querySelector(`input[name="${k}"]`);
    if (input) input.value = b[k] || "";
  });
}

function saveBusiness(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const business = {};
  BUSINESS_FIELDS.forEach((k) => {
    business[k] = String(data.get(k) || "").trim();
  });
  saveConfig({ business }, "[data-business-status]", "사업자정보를 저장했습니다. 사용자 화면 새로고침 시 하단에 반영됩니다.");
}

// ── 만세력 API 접속정보 ──
const SAJU_FIELDS = ["base", "key", "productCode", "engine"];

function renderSaju() {
  const form = document.querySelector("[data-saju-form]");
  if (!form) return;
  const s = serverConfig.saju || {};
  SAJU_FIELDS.forEach((k) => {
    const input = form.querySelector(`[name="${k}"]`);
    if (input) input.value = s[k] || "";
  });
}

function saveSaju(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const saju = {};
  SAJU_FIELDS.forEach((k) => {
    saju[k] = String(data.get(k) || "").trim();
  });
  saveConfig({ saju }, "[data-saju-status]", "만세력 API 정보를 저장했습니다. 이제 .env 없이도 분석이 동작합니다.");
}

// ── AI 해설 모델 ──
function renderModel() {
  const select = document.querySelector("[data-model-select]");
  if (!select) return;
  const current = serverConfig.ai_model || "glm-5.2";
  // 저장값이 목록에 없으면(예: 옛 gpt-5.4-mini) 맨 위에 표기해 현재 값을 보이게 한다.
  if (current && ![...select.options].some((o) => o.value === current)) {
    const opt = document.createElement("option");
    opt.value = current;
    opt.textContent = `${current} (현재 · 미검증)`;
    select.insertBefore(opt, select.firstChild);
  }
  select.value = current;
}

function saveModel(event) {
  event.preventDefault();
  const select = event.currentTarget.querySelector("[data-model-select]");
  const ai_model = String(select?.value || "").trim();
  if (!ai_model) return;
  saveConfig({ ai_model }, "[data-model-status]", "AI 모델을 저장했습니다. 다음 분석부터 적용됩니다.");
}

// ── 챗봇 상담 모델 (리포트 모델과 별개) ──
function renderChatModel() {
  const select = document.querySelector("[data-chat-model-select]");
  if (!select) return;
  const current = serverConfig.chat_model || "";
  if (current && ![...select.options].some((o) => o.value === current)) {
    const opt = document.createElement("option");
    opt.value = current;
    opt.textContent = `${current} (현재)`;
    select.insertBefore(opt, select.firstChild);
  }
  select.value = current || "deepseek-v4-flash";
}

function saveChatModel(event) {
  event.preventDefault();
  const select = event.currentTarget.querySelector("[data-chat-model-select]");
  const chat_model = String(select?.value || "").trim();
  saveConfig({ chat_model }, "[data-chat-model-status]", "챗봇 모델을 저장했습니다. 다음 질문부터 적용됩니다.");
}

async function testSaju() {
  const form = document.querySelector("[data-saju-form]");
  const status = document.querySelector("[data-saju-status]");
  if (!form) return;
  const base = form.querySelector('input[name="base"]')?.value.trim() || "";
  const key = form.querySelector('input[name="key"]')?.value.trim() || "";
  setStatus(status, "연결 확인 중...");
  try {
    const { status: code, body } = await adminPost("/api/admin/saju-test", { base, key });
    if (code === 401) return showLogin();
    if (body.ok) {
      setStatus(status, `연결 성공! 현재 포인트 잔액: ${Number(body.balance ?? 0).toLocaleString("ko-KR")}P`, "ok");
    } else {
      setStatus(status, body.message || "연결 실패", "error");
    }
  } catch (e) {
    setStatus(status, `연결 실패: ${e.message}`, "error");
  }
}

async function changePassword(event) {
  event.preventDefault();
  const status = document.querySelector("[data-password-status]");
  const form = event.currentTarget;
  const input = form.querySelector('input[name="newPassword"]');
  const confirmInput = form.querySelector('input[name="confirmPassword"]');
  const newPassword = input?.value || "";
  const confirmPassword = confirmInput?.value || "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    setStatus(status, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`, "error");
    return;
  }
  if (newPassword !== confirmPassword) {
    setStatus(status, "두 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.", "error");
    return;
  }
  setStatus(status, "변경 중...");
  try {
    const { ok, status: code, body } = await adminPost("/api/admin/password", { newPassword });
    if (code === 401) return showLogin();
    if (ok) {
      if (input) input.value = "";
      if (confirmInput) confirmInput.value = "";
      setStatus(status, "비밀번호를 변경했습니다(Supabase 저장 완료). 다음 로그인부터 새 비밀번호를 사용하세요.", "ok");
    } else {
      setStatus(status, `변경 실패: ${body.message || code}`, "error");
    }
  } catch (e) {
    setStatus(status, `변경 실패: ${e.message}`, "error");
  }
}

document.querySelector("[data-product-form]")?.addEventListener("submit", saveProductBasics);
document.querySelector("[data-legal-form]")?.addEventListener("submit", saveLegal);
document.querySelector("[data-business-form]")?.addEventListener("submit", saveBusiness);
document.querySelector("[data-saju-form]")?.addEventListener("submit", saveSaju);
document.querySelector("[data-model-form]")?.addEventListener("submit", saveModel);
document.querySelector("[data-chat-model-form]")?.addEventListener("submit", saveChatModel);
document.querySelector("[data-saju-test]")?.addEventListener("click", testSaju);
document.querySelector("[data-password-form]")?.addEventListener("submit", changePassword);
document.querySelector("[data-point-adjust]")?.addEventListener("submit", (event) => submitPointAdmin(event, "adjust"));
document.querySelector("[data-regen-adjust]")?.addEventListener("submit", (event) => submitPointAdmin(event, "regen"));
document.querySelector("[data-refresh-admin]").addEventListener("click", () => {
  loadAnalytics();
  if (document.querySelector('[data-admin-tab="points"]')?.classList.contains("is-active")) loadAdminPoints();
});

async function init() {
  const ok = await loadConfig();
  if (!ok) return; // 로그인 오버레이 표시됨
  renderProductForms();
  renderImages();
  renderLegal();
  renderBusiness();
  renderSaju();
  renderModel();
  renderChatModel();
  loadAnalytics();
}
init();
