// ---------- DOM references ----------
const views = [...document.querySelectorAll("[data-view]")];
const bottomButtons = [...document.querySelectorAll(".bottom-nav [data-view-target]")];
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const productCards = [...document.querySelectorAll(".product-card")];
const slides = [...document.querySelectorAll(".banner-slide")];
const slideButtons = [...document.querySelectorAll("[data-slide-target]")];
const authButtons = [...document.querySelectorAll("[data-auth-button]")];
const logoutButtons = [...document.querySelectorAll("[data-logout-button]")];
const sessionCopy = document.querySelector("[data-session-copy]");
const paymentStatus = document.querySelector("[data-payment-status]");
const paymentTitle = document.querySelector("[data-payment-title]");
const paymentMessage = document.querySelector("[data-payment-message]");
const paymentDetail = document.querySelector("[data-payment-detail]");
const paymentContinueButton = document.querySelector("[data-payment-continue]");
const paymentIcon = document.querySelector("[data-payment-icon]");
const paymentRef = document.querySelector("[data-payment-ref]");
const mypageDrawer = document.querySelector("[data-mypage]");
const mypageChip = document.querySelector("[data-mypage-chip]");
const mypageId = document.querySelector("[data-mypage-id]");
const profileForm = document.querySelector("[data-profile-form]");
const profileStatus = document.querySelector("[data-profile-status]");
const profileMansePreview = document.querySelector("[data-profile-manse-preview]");
const timePeriodGrid = document.querySelector("[data-time-period-grid]");
const exactTimeField = document.querySelector("[data-exact-time-field]");
const memberModal = document.querySelector("[data-member-modal]");
const memberList = document.querySelector("[data-member-list]");
const memberModalTitle = document.querySelector("[data-member-modal-title]");
const memberModalSubtitle = document.querySelector("[data-member-modal-subtitle]");
const archiveList = document.querySelector("[data-archive-list]");
const primaryProfileLabel = document.querySelector("[data-primary-profile]");

// ---------- Storage keys ----------
const PROFILE_KEY = "saju_lab_profiles_v3";
const ARCHIVE_KEY = "saju_lab_archive_v3";
const ORDER_KEY = "saju_lab_orders_v1";
// 분석 결과 보관 기간: 1개월(개인정보 최소보관·PG 부담 완화). 지나면 자동 삭제.
const ARCHIVE_RETENTION_DAYS = 30;
const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PENDING_PURCHASE_KEY = "saju_lab_pending_purchase_v1";
const VISITOR_KEY = "saju_lab_visitor_id_v1";
const SESSION_KEY = "saju_lab_session_id_v1";
const SESSION_REFRESH_INTERVAL_MS = 60 * 1000;
const ACCOUNT_SYNC_STALE_MS = 90 * 1000;

// ---------- Product catalog ----------
// 가격(amount/price/amountLabel)은 코드에 두지 않는다.
// 어드민 설정(site_config.products)이 유일한 가격 기준이며, applyRuntimeConfig()가 채운다.
const PRODUCTS = {
  "saju-analysis": {
    name: "기본 사주 리포트",
    subtitle: "어떤 분의 사주해설을 볼까요?",
    paid: true,
    planId: "starter",
    category: "사주해설",
    description: "만세력, 타고난 성향, 직업운, 재물운, 관계 흐름을 긴 호흡의 리포트로 정리합니다.",
  },
  compatibility: {
    name: "관계 궁합 분석",
    subtitle: "궁합을 볼 기준 프로필을 먼저 선택해주세요.",
    paid: true,
    planId: "starter",
    category: "궁합해설",
    description: "두 사람의 끌림, 충돌 지점, 대화 방식과 오래 가는 방법을 관계 중심으로 풀어냅니다.",
  },
  cycle: {
    name: "대운의 흐름",
    subtitle: "어떤 분의 대운을 볼까요?",
    paid: true,
    planId: "starter",
    category: "대운해설",
    description: "10년 단위 운의 전환점과 준비 구간, 기회와 위기를 타임라인으로 풀어드립니다.",
  },
  "yearly-fortune": {
    name: "연도별 운세",
    subtitle: "어떤 분의 연도별 운세를 볼까요?",
    paid: true,
    planId: "starter",
    category: "연도 운세",
    description: "특정 연도의 총운과 계절별 흐름, 조심할 타이밍과 행동 조언을 미리 짚습니다.",
  },
  "auspicious-date": {
    name: "목적별 택일 리포트",
    subtitle: "어떤 분의 일정에 맞는 날짜인지 선택해주세요.",
    paid: true,
    planId: "fortune",
    category: "택일해설",
    description: "선택한 목적과 후보 날짜를 사주 흐름에 맞춰 비교하고 우선순위와 활용법을 정리합니다.",
  },
  "mz-dark-mudang-online": {
    name: "운명 완전개봉",
    subtitle: "누구의 운명함을 완전히 열어 보겠소?",
    paid: true,
    planId: "starter",
    category: "온라인 심층 리포트",
    description: "그대의 운명, 이번엔 남김없이 열어 보이겠소. 흉한 대목까지 가감 없이 이를 것이니, 각오를 단단히 하고 함을 여시오.",
    externalReport: true,
  },
  "daily-fortune": {
    name: "오늘의 무료운세",
    subtitle: "누구의 오늘을 볼까요?",
    price: "무료",
    amountLabel: "0원",
    amount: 0,
    paid: false,
    planId: null,
    category: "오늘 운세",
    description: "오늘 하루의 분위기, 일정, 마음가짐, 작은 선택 포인트를 짧고 실용적으로 정리합니다.",
  },
  followup: {
    name: "질문 1회권",
    subtitle: "어떤 분석에 대해 더 물어볼까요?",
    paid: true,
    planId: "starter",
    category: "추가 질문",
    description: "이미 받은 분석의 만세력을 그대로 활용해, 더 궁금한 점 하나에 깊이 있는 답을 드립니다.",
  },
};

// 어드민 가격이 아직 로드되지 않았을 때 노출할 표시. 유료 상품 결제는 가격 로드 전엔 막는다.
const PRICE_PENDING_LABEL = "가격 확인 중";
function productPriceLoaded(product) {
  return Number.isFinite(Number(product?.amount)) && product?.amount !== undefined && product?.amount !== null;
}

// ---------- Time period catalog (자시 ~ 해시) ----------
const TIME_PERIODS = [
  ["ja", "자시", "23:00 ~ 01:00", "00:00"],
  ["chuk", "축시", "01:00 ~ 03:00", "02:00"],
  ["in", "인시", "03:00 ~ 05:00", "04:00"],
  ["myo", "묘시", "05:00 ~ 07:00", "06:00"],
  ["jin", "진시", "07:00 ~ 09:00", "08:00"],
  ["sa", "사시", "09:00 ~ 11:00", "10:00"],
  ["o", "오시", "11:00 ~ 13:00", "12:00"],
  ["mi", "미시", "13:00 ~ 15:00", "14:00"],
  ["sin", "신시", "15:00 ~ 17:00", "16:00"],
  ["yu", "유시", "17:00 ~ 19:00", "18:00"],
  ["sul", "술시", "19:00 ~ 21:00", "20:00"],
  ["hae", "해시", "21:00 ~ 23:00", "22:00"],
];

// ---------- Stem / branch helper data ----------
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const STEMS_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const BRANCHES_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const TEN_GODS = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];

// Stem element color map: green(목), red(화), yellow(토), white(금), black(수)
const STEM_COLOR = {
  甲: { bg: "#89ac46", fg: "#f8fafc" },
  乙: { bg: "#d3e671", fg: "#33691e" },
  丙: { bg: "#f08787", fg: "#fff7f7" },
  丁: { bg: "#f7cfd8", fg: "#ad1457" },
  戊: { bg: "#fada7a", fg: "#57564f" },
  己: { bg: "#fada7a", fg: "#57564f" },
  庚: { bg: "#e9e9e9", fg: "#2b2b2b" },
  辛: { bg: "#f6f1ea", fg: "#5b4a2f" },
  壬: { bg: "#647fbc", fg: "#f6f5f2" },
  癸: { bg: "#9b7ebd", fg: "#f6f5f2" },
};

const BRANCH_COLOR = {
  子: { bg: "#647fbc", fg: "#f6f5f2" },
  丑: { bg: "#fada7a", fg: "#57564f" },
  寅: { bg: "#89ac46", fg: "#f8fafc" },
  卯: { bg: "#d3e671", fg: "#33691e" },
  辰: { bg: "#fada7a", fg: "#57564f" },
  巳: { bg: "#f7cfd8", fg: "#ad1457" },
  午: { bg: "#f08787", fg: "#fff7f7" },
  未: { bg: "#fada7a", fg: "#57564f" },
  申: { bg: "#9b7ebd", fg: "#f8fafc" },
  酉: { bg: "#e9e9e9", fg: "#2b2b2b" },
  戌: { bg: "#fada7a", fg: "#57564f" },
  亥: { bg: "#647fbc", fg: "#f6f5f2" },
};

// ---------- Runtime state ----------
let runtimeConfig = null;
let lastReport = null; // 마지막으로 렌더된 리포트(공유용)
let lastShareUrl = null; // 생성된 공유 URL 캐시(한 번만 생성)
let activeAnalysisArchiveId = null;
let runtimeSession = null;
let lastSessionRefreshAt = 0;
let sessionRefreshPromise = null;
let pendingAuthNotice = null;
let activeSlide = 0;
let selectedProductId = "saju-analysis";
let selectedProfileId = null;
let currentCheckout = null;
let activeAnalysisTimer = null;
let analysisLoadingHideTimer = null;
let currentViewName = "home";
let currentViewStartedAt = Date.now();
let paymentReturn = false;
let activeDailyProfile = null;
let activeDailyMood = "";
let analysisDraftSync = Promise.resolve();
let chatReportPreviewHideTimer = null;
let chatState = {
  catalog: null,
  sessions: [],
  activeSessionId: null,
  detail: null,
  stream: null,
  streamRunId: null,
  requestVersion: 0,
};
// Calendar state for 택일
let calendarState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-indexed
  picked: new Set(), // ISO date strings
  purpose: "이사",
};
// Library filter state
let libraryFilter = "all";
const FORTUNE_MOOD_KEY = "saju_lab_fortune_mood";
const FORTUNE_MOOD_CUSTOM_KEY = "saju_lab_fortune_mood_custom";

// ---------- Storage helpers ----------
function readStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 등은 조용히 무시 (보관함 저장 실패가 분석 흐름을 깨지 않도록)
  }
}

function stableId(storage, key, prefix) {
  let value = storage.getItem(key);
  if (!value) {
    value = `${prefix}-${crypto.randomUUID()}`;
    storage.setItem(key, value);
  }
  return value;
}

function visitorId() {
  return stableId(localStorage, VISITOR_KEY, "visitor");
}

function sessionId() {
  return stableId(sessionStorage, SESSION_KEY, "session");
}

// ---------- Tracking ----------
function parseUtm() {
  const params = new URLSearchParams(location.search);
  return Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
      .filter((key) => params.has(key))
      .map((key) => [key, params.get(key)]),
  );
}

function deviceInfo() {
  const ua = navigator.userAgent || "";
  return {
    type: /mobile|iphone|android/i.test(ua) ? "mobile" : /ipad|tablet/i.test(ua) ? "tablet" : "desktop",
    browser: /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : /firefox/i.test(ua) ? "Firefox" : "Unknown",
    os: /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iOS" : "Unknown",
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${screen.width}x${screen.height}`,
  };
}

function trackEvent(event, metadata = {}, options = {}) {
  const payload = {
    event,
    visitorId: visitorId(),
    sessionId: sessionId(),
    page: location.pathname + location.search,
    view: currentViewName,
    landingPage: sessionStorage.getItem("saju_lab_landing_page") || location.pathname + location.search,
    referrer: sessionStorage.getItem("saju_lab_referrer") || document.referrer || "",
    utm: parseUtm(),
    device: deviceInfo(),
    durationMs: metadata.durationMs,
    metadata,
  };
  const body = JSON.stringify(payload);
  if (options.beacon && navigator.sendBeacon) {
    navigator.sendBeacon(window.SajuApi.url("/api/track"), new Blob([body], { type: "application/json" }));
    return Promise.resolve();
  }
  return window.SajuApi.fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: Boolean(options.keepalive),
  }).catch(() => {});
}

// ---------- View routing ----------
function showView(nextView) {
  if (currentViewName === "chat" && nextView !== "chat") {
    stopChatStream();
    closeChatReportPreview({ immediate: true, restoreFocus: false });
  }
  if (currentViewName === "profile" && nextView !== "profile" && profileReturnContext) {
    profileReturnContext = null;
  }
  if (currentViewName && currentViewName !== nextView) {
    trackEvent("view_exit", {
      fromView: currentViewName,
      toView: nextView,
      durationMs: Date.now() - currentViewStartedAt,
    }, { keepalive: true });
    currentViewName = nextView;
    currentViewStartedAt = Date.now();
    trackEvent("view_change", { view: nextView });
  }
  // Cancel in-progress analysis timer if user navigates away (unless we just returned from payment)
  if (nextView !== "analysis" && activeAnalysisTimer && !paymentReturn) {
    window.clearInterval(activeAnalysisTimer);
    activeAnalysisTimer = null;
    const loading = document.querySelector("[data-analysis-loading]");
    if (loading) loading.hidden = true;
    const hint = document.querySelector("[data-scroll-hint]");
    if (hint) hint.hidden = true;
  }
  views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === nextView));
  bottomButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.viewTarget === nextView));
  // 무료운세 FAB는 모든 화면에서 항상 고정 노출(하단 내비 일관성)
  const fab = document.querySelector(".fortune-fab");
  if (fab) fab.classList.remove("fab-hidden");
  closeMemberModal();
  closeMypage();
  if (["library", "people", "orders", "points"].includes(nextView)) ensureAccountDataFresh(nextView);
  if (nextView === "library") renderArchive();
  if (nextView === "people") renderPeople();
  if (nextView === "orders") renderOrders();
  if (nextView === "points") renderPointsView();
  if (nextView === "support") loadSupportBoard();
  if (nextView === "profile" && !openingEditProfile) resetProfileForm();
  if (nextView === "compatibility" || nextView === "fortune") renderProfileSelects();
  if (nextView === "calendar") {
    renderPrimaryProfileLabel();
    renderCalendar();
  }
  if (nextView === "chat") loadChatView();
  if (nextView === "followup") renderFollowup();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSlide(nextSlide) {
  slides.forEach((slide) => slide.classList.toggle("is-active", slide.dataset.slide === nextSlide));
  slideButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.slideTarget === nextSlide));
}

// ---------- 계정별 데이터 분리 (개인정보 보호 핵심) ----------
// 저장 데이터(인원·보관함·주문)를 "브라우저"가 아니라 "로그인 계정"에 귀속시킨다.
// → 같은 브라우저에서 다른 계정으로 로그인해도 이전 사람 데이터가 보이지 않는다.
let accountScopeId = "guest";
// 계정 데이터가 서버에서 도착했는지 여부. 부팅/로그인 직후 잠깐 false →
// 그동안 인원관리·결제내역·보관함은 "없음"이 아니라 "불러오는 중"을 보여준다.
let accountDataReady = false;
let accountDataLastSyncedAt = 0;
function setAccountScope() {
  const uid = runtimeSession?.user?.id;
  accountScopeId = uid ? `u_${String(uid)}` : "guest";
}
function scopedKey(base) {
  return `${base}__${accountScopeId}`;
}
// 세션이 아직 안 왔으면 직전 로그인 힌트로, 왔으면 확정값으로 "로그인 상태일 가능성" 판단.
function accountLikelyLoggedIn() {
  if (runtimeSession) return Boolean(runtimeSession.user?.id);
  try {
    return Boolean(localStorage.getItem("saju_lab_auth_hint"));
  } catch {
    return false;
  }
}
// 로그인 계정인데 아직 서버 데이터가 도착 전이면 true → 화면에 "불러오는 중" 표시.
function accountLoading() {
  return !accountDataReady && accountLikelyLoggedIn();
}
// 예전(스코프 없던) 공유 데이터는 1회만 guest 네임스페이스로 옮기고 공유 키는 삭제(누수 방지).
function migrateLegacyData() {
  [PROFILE_KEY, ARCHIVE_KEY, ORDER_KEY].forEach((base) => {
    const legacy = localStorage.getItem(base);
    if (legacy == null) return;
    const guestKey = `${base}__guest`;
    if (localStorage.getItem(guestKey) == null) localStorage.setItem(guestKey, legacy);
    localStorage.removeItem(base);
  });
}
// 로그인/로그아웃으로 계정이 바뀌면 화면 데이터를 새 계정 기준으로 다시 읽어 렌더.
function reloadAccountData() {
  resetChatState();
  setAccountScope();
  selectedProfileId = getProfiles()[0]?.id || null;
  renderProfileSelects();
  renderPrimaryProfileLabel();
  renderArchive();
  const active = document.querySelector(".view.is-active")?.dataset.view;
  if (active === "people") renderPeople();
  if (active === "orders") renderOrders();
  if (active === "points") renderPointsView();
}

function ensureAccountDataFresh(reason = "view") {
  if (!runtimeSession?.user?.id) return;
  if (!accountDataReady || Date.now() - accountDataLastSyncedAt < ACCOUNT_SYNC_STALE_MS) return;
  accountDataReady = false;
  const active = document.querySelector(".view.is-active")?.dataset.view;
  if (active === "people") renderPeople();
  if (active === "orders") renderOrders();
  if (active === "library") renderArchive();
  if (active === "points") renderPointsView();
  syncAccountData({ reason });
}
// ── 계정 데이터 서버 동기화 — 로그인 시 Supabase가 진실, localStorage는 미러(캐시) ──
function pushProfile(profile) {
  if (!runtimeSession?.user?.id) return; // 게스트는 서버 저장 안 함
  window.SajuApi.fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  }).catch(() => {});
}
function removeServerProfile(id) {
  if (!runtimeSession?.user?.id) return;
  window.SajuApi.fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  }).catch(() => {});
}
// 보관함(archive)·주문(order) 항목을 서버에 저장(로그인 시).
function pushUserData(kind, item) {
  if (!runtimeSession?.user?.id || !item) return Promise.resolve();
  return window.SajuApi.fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, item }),
  }).catch(() => {});
}

// 한 종류(프로필/보관함/주문)를 서버와 동기화: 서버에 없는 로컬·게스트 항목을 올린 뒤 서버를 미러로.
async function syncKind({ resource, kind, baseKey, idField }) {
  const url = kind ? `/api/profiles?kind=${kind}` : "/api/profiles";
  const localItems = readStore(scopedKey(baseKey), []);
  const guestItems = readStore(`${baseKey}__guest`, []);
  const first = await window.SajuApi.fetch(url);
  const serverItems = first.ok ? (await first.json())[resource] || [] : [];
  const serverIds = new Set(serverItems.map((x) => x?.[idField]).filter(Boolean));
  const toPush = [...guestItems, ...localItems].filter((x) => x?.[idField] && !serverIds.has(x[idField]));
  if (toPush.length) {
    await Promise.all(
      toPush.map((item) =>
        window.SajuApi.fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind ? { kind, item } : { profile: item }),
        }).catch(() => {}),
      ),
    );
  }
  localStorage.removeItem(`${baseKey}__guest`);
  // 서버+로컬 병합(로컬을 통째로 덮어쓰지 않음). 이렇게 해야 방금 만든 주문이
  // 서버 응답이 비었거나(테이블 미설정·일시 오류) 동기화 타이밍 때문에 사라지지 않는다.
  // 같은 id가 양쪽에 있으면 updatedAt이 더 최신인 쪽(없으면 로컬)을 채택.
  const merged = new Map();
  for (const it of serverItems) if (it?.[idField]) merged.set(it[idField], it);
  for (const it of [...guestItems, ...localItems]) {
    const key = it?.[idField];
    if (!key) continue;
    const prev = merged.get(key);
    if (!prev || Number(it.updatedAt || 0) >= Number(prev.updatedAt || 0)) merged.set(key, it);
  }
  writeStore(scopedKey(baseKey), [...merged.values()]);
}

// 로그인 직후/부팅: 프로필·보관함·주문을 모두 서버와 동기화(기기 무관). 게스트는 로컬만.
async function syncAccountData({ reason = "sync" } = {}) {
  try {
    if (!runtimeSession?.user?.id) return; // 게스트는 로컬만(서버 동기화 없음)
    // 3종(프로필·보관함·주문)을 병렬로 동기화 — 순차 왕복(콜드스타트 누적) 대신 한 번에.
    await Promise.all([
      syncKind({ resource: "profiles", kind: "", baseKey: PROFILE_KEY, idField: "id" }),
      syncKind({ resource: "items", kind: "archive", baseKey: ARCHIVE_KEY, idField: "id" }),
      syncKind({ resource: "items", kind: "order", baseKey: ORDER_KEY, idField: "orderId" }),
    ]);
    selectedProfileId = getProfiles()[0]?.id || null;
  } catch {
    // 서버 동기화 실패 시 로컬 미러로 계속 동작(베스트에포트)
  } finally {
    // 게스트든 로그인이든 여기까지 오면 "데이터 도착" → 화면을 실제값으로 다시 그린다.
    accountDataReady = true;
    accountDataLastSyncedAt = Date.now();
    renderProfileSelects();
    renderPrimaryProfileLabel();
    renderArchive();
    const active = document.querySelector(".view.is-active")?.dataset.view;
    if (active === "people") renderPeople();
    if (active === "orders") renderOrders();
  }
}

// ---------- Profile storage (계정 스코프 적용) ----------
function seedProfiles() {
  return readStore(scopedKey(PROFILE_KEY), []);
}

function getProfiles() {
  return readStore(scopedKey(PROFILE_KEY), []);
}

function saveProfiles(profiles) {
  writeStore(scopedKey(PROFILE_KEY), profiles);
}

function saveProfile(profile) {
  const profiles = getProfiles();
  profiles.unshift(profile);
  saveProfiles(profiles);
  pushProfile(profile); // 로그인 상태면 Supabase에도 저장(계정 귀속)
  return profiles;
}

function getArchive() {
  return readStore(scopedKey(ARCHIVE_KEY), []);
}

// 보관 정책: 1개월 지난 분석은 로컬에서 제거(서버는 API가 자체 삭제). 바뀌면 저장하고 남은 목록 반환.
function pruneArchiveRetention() {
  const cutoff = Date.now() - ARCHIVE_RETENTION_MS;
  const archive = getArchive();
  const kept = archive.filter((item) => Number(item.createdAt || 0) >= cutoff);
  if (kept.length !== archive.length) writeStore(scopedKey(ARCHIVE_KEY), kept);
  return kept;
}

function saveArchive(item, options = {}) {
  const archive = getArchive();
  const index = archive.findIndex((entry) => entry.id === item.id);
  if (index >= 0) archive.splice(index, 1, item);
  else archive.unshift(item);
  writeStore(scopedKey(ARCHIVE_KEY), archive.slice(0, 60));
  if (options.sync !== false) pushUserData("archive", item); // 로그인 상태면 보관함도 서버 저장(기기 무관)
  renderArchive();
}

// 기존 보관함 항목을 id로 찾아 갱신(추가 질문 Q&A 붙이기 등). 서버에도 upsert.
function updateArchiveItem(id, updater) {
  const archive = getArchive();
  const idx = archive.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const updated = updater(archive[idx]);
  archive.splice(idx, 1, updated);
  writeStore(scopedKey(ARCHIVE_KEY), archive);
  pushUserData("archive", updated); // 서버도 같은 id로 갱신(기기 무관)
  renderArchive();
  return updated;
}

function getOrders() {
  return readStore(scopedKey(ORDER_KEY), []);
}

function upsertOrder(order) {
  const orders = getOrders();
  const index = orders.findIndex((item) => item.orderId === order.orderId);
  const normalized = {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...orders[index],
    ...order,
  };
  if (index >= 0) orders.splice(index, 1, normalized);
  else orders.unshift(normalized);
  writeStore(scopedKey(ORDER_KEY), orders.slice(0, 120));
  pushUserData("order", normalized); // 로그인 상태면 결제내역도 서버 저장(기기 무관)
  return normalized;
}

function savePendingPurchase(payload) {
  sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(payload));
}

function getPendingPurchase() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_PURCHASE_KEY) || "null");
  } catch {
    return null;
  }
}

function clearPendingPurchase() {
  sessionStorage.removeItem(PENDING_PURCHASE_KEY);
}

// ---------- Formatting helpers ----------
function formatBirthDate(date) {
  return String(date || "").replaceAll("-", ".");
}

function formatBirthDateLong(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ""));
  if (!match) return formatBirthDate(date);
  return `${match[1]}년 ${match[2]}월 ${match[3]}일`;
}

function formatWon(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatPoints(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}pt`;
}

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

function shortDate(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp || Date.now()));
}

function genderLabel(value) {
  return value === "M" ? "남성" : "여성";
}

function calendarLabel(value) {
  return value === "lunar" ? "음력" : "양력";
}

function profileTime(profile) {
  if (!profile) return "";
  if (profile.timeKnown === "no") return "시간 모름";
  if (profile.timeMode === "period") {
    const period = TIME_PERIODS.find(([id]) => id === profile.timePeriod);
    return period ? `${period[1]} (${period[2]})` : profile.birthTime || "시간대 선택";
  }
  return profile.birthTime || "시간 모름";
}

function profileInitial(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function colorForText(text) {
  const colors = ["#89ac46", "#647fbc", "#f08787", "#9b7ebd", "#fada7a", "#27a996"];
  const sum = [...String(text || "")].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
}

function setPaymentStatus(message) {
  if (paymentStatus) paymentStatus.textContent = message;
}

// ---------- Fetch helper ----------
const REQUEST_TIMEOUT_MS = 55000;
// 단일 섹션은 서버의 OpenRouter 3회 시도(각 40초 + 짧은 백오프)를 끝까지 기다린다.
const SECTION_RETRY_TIMEOUT_MS = 145000;
async function getJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await window.SajuApi.fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(response.ok ? "서버 응답 형식을 확인할 수 없습니다." : `서버 요청에 실패했습니다. (${response.status})`);
    }
    if (!response.ok) {
      throw new Error(body.message || body.error || "요청 처리에 실패했습니다.");
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("요청 시간이 초과되었습니다. 결제내역에서 다시 시도할 수 있습니다.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

// ---------- Auth session ----------
function emptyPoints() {
  return { enabled: false, balance: 0, regenTokens: 0, transactions: [] };
}

function guestSession() {
  return { user: null, points: emptyPoints() };
}

function normalizeSession(session) {
  return session?.user
    ? { user: session.user, points: session.points || emptyPoints() }
    : guestSession();
}

function consumeAuthNotice(session = runtimeSession) {
  if (!pendingAuthNotice) return;
  const notice = pendingAuthNotice;
  pendingAuthNotice = null;
  if (notice.result === "kakao-ok") {
    const nickname = session?.user?.nickname;
    if (nickname) showToast(`${nickname}님으로 로그인되었습니다.`);
    else showToast("로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.", true);
    return;
  }
  const messages = {
    "missing-kakao": "카카오 키가 설정되지 않았습니다 (KAKAO_REST_API_KEY).",
    "state-error": "로그인 상태(state) 검증 실패 — 쿠키 문제일 수 있어요. 다시 시도해주세요.",
    "error": "카카오 로그인 오류" + (notice.reason ? `: ${decodeURIComponent(notice.reason)}` : ""),
  };
  showToast(messages[notice.result] || `로그인 오류: ${notice.result}`, true);
}

function applyVerifiedSession(session, { forceSync = false, silent = false } = {}) {
  const prevUserId = runtimeSession?.user?.id || null;
  runtimeSession = normalizeSession(session);
  const nextUserId = runtimeSession?.user?.id || null;
  renderSession();

  if (!nextUserId && !prevUserId) {
    accountDataReady = true;
    accountDataLastSyncedAt = Date.now();
  }

  if (prevUserId !== nextUserId) {
    accountDataReady = !nextUserId;
    accountDataLastSyncedAt = 0;
    clearPendingPurchase();
    currentCheckout = null;
    reloadAccountData();
    if (currentViewName === "support") loadSupportBoard({ force: Boolean(nextUserId) });
    if (nextUserId) syncAccountData({ reason: "session-change" });
    else if (prevUserId && !silent) showToast("로그인 세션이 만료되었습니다. 다시 로그인해주세요.", true);
  } else if (nextUserId && (forceSync || Date.now() - accountDataLastSyncedAt >= ACCOUNT_SYNC_STALE_MS)) {
    accountDataReady = false;
    reloadAccountData();
    syncAccountData({ reason: "session-refresh" });
  }

  consumeAuthNotice(runtimeSession);
  return runtimeSession;
}

async function refreshAuthSession(reason = "manual", { force = false, silent = false } = {}) {
  const now = Date.now();
  if (sessionRefreshPromise) return sessionRefreshPromise;
  if (!force && now - lastSessionRefreshAt < SESSION_REFRESH_INTERVAL_MS) return runtimeSession;
  lastSessionRefreshAt = now;
  sessionRefreshPromise = getJson("/api/session")
    .then((session) => applyVerifiedSession(session, { forceSync: force, silent }))
    .catch(() => {
      consumeAuthNotice(runtimeSession);
      return runtimeSession;
    })
    .finally(() => {
      sessionRefreshPromise = null;
    });
  return sessionRefreshPromise;
}

// 첫 화면 깜빡임 방지: 직전 로그인 닉네임 캐시로 상단 칩을 미리 표시(곧 서버 응답으로 확정).
function applyAuthHint() {
  let hint = null;
  try {
    hint = localStorage.getItem("saju_lab_auth_hint");
  } catch {}
  if (mypageChip) mypageChip.textContent = hint ? `${hint}님` : "로그인";
}

function renderSession() {
  const user = runtimeSession?.user;
  const nickname = user?.nickname;
  const email = user?.email;
  const phone = user?.phone;
  authButtons.forEach((button) => {
    button.textContent = nickname ? `${nickname}님` : "카카오 로그인";
    button.disabled = Boolean(nickname);
  });
  logoutButtons.forEach((button) => {
    button.hidden = !nickname;
  });
  if (sessionCopy) {
    sessionCopy.textContent = nickname
      ? `${nickname}님의 계정이 연결됐어요. 결제 내역과 분석 기록을 이어서 관리할 수 있습니다.`
      : "로그인하면 결제 내역, 고객 프로필, 분석 결과를 같은 브라우저에서 이어서 볼 수 있어요.";
  }
  // 상단 칩: 이름(님) 또는 "로그인"
  if (mypageChip) mypageChip.textContent = nickname ? `${nickname}님` : "로그인";
  // 다음 방문 때 첫 화면부터 바로 이름이 뜨도록 닉네임만 캐시(토큰 아님). 로그아웃이면 제거.
  try {
    if (nickname) localStorage.setItem("saju_lab_auth_hint", nickname);
    else localStorage.removeItem("saju_lab_auth_hint");
  } catch {}
  // 드로어 신원 영역
  if (mypageId) {
    if (nickname) {
      const isEmailUser = user?.provider === "email";
      mypageId.innerHTML = `
        <div class="mypage-id-card">
          <span class="mypage-avatar" style="background:${colorForText(nickname)}">${escapeHtml(profileInitial(nickname))}</span>
          <div class="mypage-id-text">
            <b>${escapeHtml(nickname)}님</b>
            <small>${email ? escapeHtml(email) : "카카오 계정으로 로그인됨"}${phone ? ` · ${escapeHtml(formatPhoneNumber(phone))}` : ""}</small>
          </div>
          <button class="mypage-edit-toggle" type="button" data-account-edit-toggle>개인정보 수정</button>
        </div>
        <form class="account-edit-form" data-account-edit-form hidden>
          <label>닉네임
            <input name="nickname" minlength="2" maxlength="20" value="${escapeHtml(nickname)}" autocomplete="nickname" required />
          </label>
          <label>휴대폰 번호
            <input type="tel" name="phone" inputmode="tel" maxlength="13" value="${phone ? escapeHtml(formatPhoneNumber(phone)) : ""}" placeholder="010-1234-5678" autocomplete="tel" />
          </label>
          ${isEmailUser ? `
          <div class="account-edit-divider"><span>비밀번호 변경 (선택)</span></div>
          <label>현재 비밀번호
            <input type="password" name="currentPassword" autocomplete="current-password" placeholder="비밀번호를 바꿀 때만 입력" />
          </label>
          <label>새 비밀번호
            <input type="password" name="newPassword" minlength="8" autocomplete="new-password" placeholder="8자 이상" />
          </label>
          <label>새 비밀번호 확인
            <input type="password" name="newPasswordConfirm" minlength="8" autocomplete="new-password" placeholder="한 번 더 입력" />
          </label>` : `
          <p class="account-edit-note">카카오 계정은 닉네임·휴대폰 번호만 변경할 수 있어요.</p>`}
          <div class="account-edit-actions">
            <button type="submit">저장</button>
            <button type="button" data-account-edit-cancel>취소</button>
          </div>
          <p class="form-status" data-account-edit-status></p>
        </form>`;
      const editForm = mypageId.querySelector("[data-account-edit-form]");
      mypageId.querySelector("[data-account-edit-toggle]")?.addEventListener("click", () => {
        if (editForm) editForm.hidden = !editForm.hidden;
      });
      mypageId.querySelector("[data-account-edit-cancel]")?.addEventListener("click", () => {
        if (editForm) editForm.hidden = true;
      });
      editForm?.addEventListener("submit", updateAccountInfo);
    } else {
      mypageId.innerHTML = `
        <div class="mypage-id-text mypage-auth-intro"><b>로그인하고 이어보기</b>
          <small>결제 내역, 사주 인원, 분석 기록과 문의 답변을 같은 계정에서 안전하게 관리할 수 있어요.</small></div>
        <button class="mypage-login-btn" type="button" data-mypage-login>카카오로 로그인</button>
        <div class="email-auth">
          <div class="email-auth-or"><span>또는 이메일로</span></div>
          <input class="email-auth-input" type="email" data-email-input placeholder="이메일" autocomplete="email" />
          <input class="email-auth-input" type="password" data-pw-input placeholder="비밀번호" autocomplete="current-password" />
          <div class="email-auth-actions">
            <button class="email-auth-login" type="button" data-email-login>로그인</button>
            <button class="email-auth-signup" type="button" data-email-signup>회원가입</button>
          </div>
          <p class="email-auth-msg" data-email-msg></p>
        </div>`;
      const loginBtn = mypageId.querySelector("[data-mypage-login]");
      if (loginBtn) loginBtn.addEventListener("click", () => { window.location.href = window.SajuApi.url("/api/auth/kakao/start"); });
      mypageId.querySelector("[data-email-login]")?.addEventListener("click", emailAuth);
      mypageId.querySelector("[data-email-signup]")?.addEventListener("click", () => showView("signup"));
    }
  }
  const pointBox = document.querySelector("[data-mypage-points]");
  if (pointBox) {
    const points = runtimeSession?.points;
    pointBox.hidden = !user?.id || !points?.enabled;
    pointBox.innerHTML = points?.enabled
      ? `<span>보유 포인트</span><b>${formatPoints(points.balance)}</b><small>무료운세 재생성 ${Number(points.regenTokens || 0)}회</small>`
      : "";
  }
}

async function refreshPoints() {
  if (!runtimeSession?.user?.id) return;
  try {
    const session = await getJson("/api/session");
    applyVerifiedSession(session, { silent: true });
    renderPointsView();
  } catch {
    // 잔액 갱신 실패는 현재 화면의 마지막 확인값을 유지한다.
  }
}

// 마이페이지 — 닉네임·휴대폰·비밀번호 수정
async function updateAccountInfo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-account-edit-status]");
  const fail = (message) => { if (status) status.textContent = message; };
  const data = new FormData(form);
  const nickname = String(data.get("nickname") || "").trim().replace(/\s+/g, " ");
  const phone = String(data.get("phone") || "").replace(/\D/g, "");
  const currentPassword = String(data.get("currentPassword") || "");
  const newPassword = String(data.get("newPassword") || "");
  const newPasswordConfirm = String(data.get("newPasswordConfirm") || "");
  if (nickname.length < 2 || nickname.length > 20) return fail("닉네임은 2~20자로 입력하세요.");
  if (phone && !/^01[016789]\d{7,8}$/.test(phone)) return fail("휴대폰 번호를 정확히 입력하세요.");
  if (newPassword || currentPassword) {
    if (!currentPassword) return fail("현재 비밀번호를 입력하세요.");
    if (newPassword.length < 8) return fail("새 비밀번호는 8자 이상이어야 합니다.");
    if (newPassword !== newPasswordConfirm) return fail("새 비밀번호 확인이 일치하지 않습니다.");
  }
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;
  fail("저장 중...");
  try {
    const payload = { action: "update", nickname, phone };
    if (newPassword) Object.assign(payload, { currentPassword, newPassword, newPasswordConfirm });
    const res = await window.SajuApi.fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return fail(body.message || "저장에 실패했습니다.");
    applyVerifiedSession({ user: body.user, points: runtimeSession?.points }, { silent: true });
    showToast("개인정보가 저장되었습니다.");
  } catch (error) {
    fail(error.message || "저장 중 오류가 발생했습니다.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

// 이메일 로그인 (회원가입은 필수 프로필을 받는 전용 화면에서 처리).
async function emailAuth() {
  if (!mypageId) return;
  const email = mypageId.querySelector("[data-email-input]")?.value.trim();
  const password = mypageId.querySelector("[data-pw-input]")?.value;
  const msg = mypageId.querySelector("[data-email-msg]");
  if (msg) msg.textContent = "로그인 중...";
  try {
    const res = await window.SajuApi.fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      applyVerifiedSession({ user: body.user, points: body.points }, { forceSync: true, silent: true });
      showToast("로그인되었습니다.");
    } else if (msg) {
      msg.textContent = body.message || "실패했습니다.";
    }
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
}

async function signupWithEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("[data-signup-status]");
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  const passwordConfirm = String(data.get("passwordConfirm") || "");
  const nickname = String(data.get("nickname") || "").trim().replace(/\s+/g, " ");
  const phone = String(data.get("phone") || "").replace(/\D/g, "");
  const fail = (message) => { if (status) status.textContent = message; };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("올바른 이메일을 입력하세요.");
  if (password.length < 8) return fail("비밀번호는 8자 이상이어야 합니다.");
  if (password !== passwordConfirm) return fail("비밀번호 확인이 일치하지 않습니다.");
  if (nickname.length < 2 || nickname.length > 20) return fail("닉네임은 2~20자로 입력하세요.");
  if (!/^01[016789]\d{7,8}$/.test(phone)) return fail("휴대폰 번호를 정확히 입력하세요.");
  if (!form.elements.consent.checked) return fail("이용약관과 개인정보처리방침에 동의해주세요.");
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;
  fail("가입 정보를 확인하고 있습니다...");
  try {
    const res = await window.SajuApi.fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signup", email, password, passwordConfirm, nickname, phone, consent: true }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return fail(body.message || "회원가입에 실패했습니다.");
    applyVerifiedSession({ user: body.user, points: body.points }, { forceSync: true, silent: true });
    form.reset();
    showToast(`${body.user?.nickname || nickname}님, 가입이 완료되었습니다.`);
    showView("home");
    window.setTimeout(openMypage, 240);
  } catch (error) {
    fail(error.message || "회원가입 중 오류가 발생했습니다.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

// ---------- 마이페이지 드로어 ----------
function openMypage() {
  if (!mypageDrawer) return;
  mypageDrawer.removeAttribute("hidden");
  requestAnimationFrame(() => mypageDrawer.classList.add("is-open"));
}
function closeMypage() {
  if (!mypageDrawer) return;
  mypageDrawer.classList.remove("is-open");
  setTimeout(() => mypageDrawer.setAttribute("hidden", ""), 240);
}

// ---------- 사주 인원 관리 ----------
function renderPeople() {
  const list = document.querySelector("[data-people-list]");
  const count = document.querySelector("[data-people-count]");
  if (!list) return;
  const profiles = getProfiles();
  // 로컬에 데이터가 있으면 즉시 표시. 진짜 처음(로컬 비어 있고 서버 동기화 대기)일 때만 스피너.
  if (!profiles.length && accountLoading()) {
    if (count) count.textContent = "불러오는 중…";
    list.innerHTML = `<div class="people-empty is-loading"><span class="inline-spinner"></span>내 계정 정보를 불러오는 중…</div>`;
    return;
  }
  if (count) count.textContent = `${profiles.length}명 등록됨`;

  const cards = !profiles.length
    ? `<div class="people-empty">아직 등록된 사람이 없어요.<br />위 “+ 새 사람 추가”로 시작해보세요.</div>`
    : profiles
        .map(
          (p) => `
      <article class="person-card">
        <span class="person-avatar" style="background:${colorForText(p.name)}">${escapeHtml(profileInitial(p.name))}</span>
        <div class="person-info">
          <b>${escapeHtml(p.name)}</b>
          <small>${escapeHtml(p.relation || "본인")} · ${escapeHtml(genderLabel(p.gender))} · ${escapeHtml(formatBirthDate(p.birthDate))} · ${escapeHtml(profileTime(p))}</small>
        </div>
        <div class="person-actions">
          <button class="person-edit" type="button" data-person-edit="${escapeHtml(p.id)}">수정</button>
          <button class="person-del" type="button" data-person-del="${escapeHtml(p.id)}">삭제</button>
        </div>
      </article>`,
        )
        .join("");

  list.innerHTML = cards;
  list.querySelectorAll("[data-person-edit]").forEach((btn) => {
    btn.addEventListener("click", () => editProfile(btn.dataset.personEdit));
  });
  list.querySelectorAll("[data-person-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteProfile(btn.dataset.personDel));
  });
}

function deleteProfile(id) {
  const target = getProfiles().find((p) => p.id === id);
  if (target && !window.confirm(`'${target.name}' 님을 목록에서 삭제할까요?`)) return;
  const profiles = getProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  removeServerProfile(id); // 로그인 상태면 Supabase에서도 삭제
  if (selectedProfileId === id) selectedProfileId = profiles[0]?.id || null;
  renderPeople();
  renderProfileSelects();
  showToast("삭제했습니다.");
}

// ---------- 결제 내역 ----------
function renderOrders() {
  const list = document.querySelector("[data-orders-list]");
  if (!list) return;
  const orders = getOrders();
  if (!orders.length && accountLoading()) {
    list.innerHTML = `<div class="orders-empty is-loading"><span class="inline-spinner"></span>결제 내역을 불러오는 중…</div>`;
    return;
  }
  if (!orders.length) {
    list.innerHTML = `<div class="orders-empty">아직 결제 내역이 없어요.<br />상품을 선택해 분석을 결제하면 여기에 기록됩니다.</div>`;
    return;
  }
  list.innerHTML = orders
    .map((o) => {
      const st = String(o.status || "");
      const cls = st.includes("완료") ? "ok" : st.includes("실패") || st.includes("오류") ? "fail" : "pending";
      const when = o.approvedAt || o.updatedAt || o.createdAt;
      const report = getArchive().find((item) => item.orderId === o.orderId);
      const actions = window.OrderRecovery.capabilities({ ...o, hasReport: Boolean(report) });
      const purchase = recoverOrderPurchase(o);
      const reportLabel = o.reportStatus === "generating"
        ? `<span class="order-report-status pending">리포트 생성중</span>`
        : o.reportStatus === "failed"
          ? `<span class="order-report-status fail">리포트 생성 실패</span>`
          : report
            ? `<span class="order-report-status ok">리포트 완료</span>`
            : "";
      const actionButtons = [
        actions.resume && purchase ? `<button type="button" data-order-resume="${escapeHtml(o.orderId)}">결제 이어하기</button>` : "",
        actions.cancel ? `<button type="button" class="is-danger" data-order-cancel="${escapeHtml(o.orderId)}">주문 취소</button>` : "",
        actions.viewReport ? `<button type="button" data-order-report="${escapeHtml(o.orderId)}">${o.reportStatus === "complete" ? "리포트 보기" : "생성 상태 확인"}</button>` : "",
        actions.retryReport && purchase ? `<button type="button" data-order-report="${escapeHtml(o.orderId)}" data-retry="true">리포트 다시 생성</button>` : "",
      ].filter(Boolean).join("");
      return `
        <article class="order-card">
          <button class="order-card-summary" type="button" data-order-detail="${escapeHtml(o.orderId)}" aria-expanded="false">
            <header>
              <b>${escapeHtml(o.productName || "상품")}</b>
              <span class="order-amount">${escapeHtml(window.OrderRecovery.paymentSummary(o))}</span>
            </header>
            <div class="order-meta">
              <span>${escapeHtml(o.profileName || "-")} · ${shortDate(when)}</span>
              <span class="order-status ${cls}">${escapeHtml(st || "진행 중")}</span>
            </div>
            ${reportLabel}
          </button>
          <div class="order-detail" data-order-panel="${escapeHtml(o.orderId)}" hidden>
            <dl>
              <div><dt>주문번호</dt><dd>${escapeHtml(o.orderId)}</dd></div>
              <div><dt>상품금액</dt><dd>${formatWon(window.OrderRecovery.totalAmount(o))}</dd></div>
              <div><dt>토스 결제</dt><dd>${formatWon(window.OrderRecovery.cashAmount(o))}</dd></div>
              <div><dt>사용 포인트</dt><dd>${formatPoints(o.pointsUsed || 0)}</dd></div>
              <div><dt>결제 방식</dt><dd>${escapeHtml(o.payMethod === "points" ? "포인트" : o.payMethod === "mixed" ? "혼합 결제" : "토스")}</dd></div>
              <div><dt>처리 시각</dt><dd>${shortDate(when)}</dd></div>
            </dl>
            ${o.reportError ? `<p class="order-error">${escapeHtml(o.reportError)}</p>` : ""}
            ${actionButtons ? `<div class="order-actions">${actionButtons}</div>` : ""}
          </div>
        </article>`;
    })
    .join("");
  list.querySelectorAll("[data-order-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = list.querySelector(`[data-order-panel="${CSS.escape(button.dataset.orderDetail)}"]`);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
    });
  });
  list.querySelectorAll("[data-order-cancel]").forEach((button) => {
    button.addEventListener("click", () => cancelOrder(button.dataset.orderCancel, button));
  });
  list.querySelectorAll("[data-order-resume]").forEach((button) => {
    button.addEventListener("click", () => resumeOrderPayment(button.dataset.orderResume, button));
  });
  list.querySelectorAll("[data-order-report]").forEach((button) => {
    button.addEventListener("click", () => button.dataset.retry === "true"
      ? retryOrderReport(button.dataset.orderReport)
      : openOrderReport(button.dataset.orderReport));
  });
}

function recoverOrderPurchase(order) {
  if (order?.purchase?.productId && order.purchase.profile) return order.purchase;
  const productId = order?.productId;
  const product = PRODUCTS[productId];
  const profile = getProfiles().find((item) => item.name === order?.profileName);
  if (!product || !profile) return null;
  return { productId, product, profile, partner: null, pointsUsed: Number(order.pointsUsed || 0) };
}

function isExternalReportProductId(productId) {
  return Boolean(PRODUCTS[productId]?.externalReport);
}

function purchaseSnapshot(context = {}) {
  return {
    productId: context.productId,
    productName: context.product?.name || "",
    profile: context.profile || null,
    partner: context.partner || null,
    targetYear: context.targetYear || null,
    calendarPick: context.calendarPick || null,
    customer: runtimeSession?.user
      ? {
          id: runtimeSession.user.id,
          email: runtimeSession.user.email || "",
          nickname: runtimeSession.user.nickname || "",
          provider: runtimeSession.user.provider || "",
        }
      : null,
  };
}

async function cancelOrder(orderId, button) {
  if (!window.confirm("이 미결제 주문을 취소할까요?")) return;
  if (button) button.disabled = true;
  try {
    await getJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", orderId }),
    });
    upsertOrder({ orderId, status: "결제 취소" });
    if (getPendingPurchase()?.orderId === orderId) clearPendingPurchase();
    renderOrders();
    showToast("주문을 취소했습니다.");
  } catch (error) {
    if (button) button.disabled = false;
    showToast(error.message, true);
  }
}

async function resumeOrderPayment(orderId, button) {
  const order = getOrders().find((item) => item.orderId === orderId);
  const purchase = recoverOrderPurchase(order);
  if (!order || !purchase) return showToast("결제 정보를 복구할 수 없습니다. 새 주문으로 진행해주세요.", true);
  if (button) button.disabled = true;
  try {
    const resumed = await getJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume", orderId }),
    });
    const pending = { ...purchase, orderId, amount: resumed.amount, pointsUsed: resumed.pointsUsed, customerKey: resumed.customerKey };
    savePendingPurchase(pending);
    await requestExistingOrderPayment(order, pending);
  } catch (error) {
    if (button) button.disabled = false;
    showToast(`결제를 이어갈 수 없습니다: ${error.message}`, true);
  }
}

function openStoredAnalysis(item) {
  if (!item) return;
  const profile = getProfiles().find((entry) => entry.id === item.profileId);
  if (!profile) return showToast("분석 대상 프로필을 찾을 수 없습니다.", true);
  const partner = item.partnerId ? getProfiles().find((entry) => entry.id === item.partnerId) : null;
  window.clearInterval(activeAnalysisTimer);
  activeAnalysisTimer = null;
  activeAnalysisArchiveId = item.id;
  showView("analysis");
  const loading = document.querySelector("[data-analysis-loading]");
  if (loading) loading.hidden = true;
  const hint = document.querySelector("[data-scroll-hint]");
  if (hint) hint.hidden = true;
  renderAnalysisResult(item.productId, profile, partner, item.analysis || null);
}

const externalReportPollers = new Map();

function stopExternalReportPolling(orderId) {
  const timer = externalReportPollers.get(orderId);
  if (timer) window.clearTimeout(timer);
  externalReportPollers.delete(orderId);
}

async function syncExternalReport(orderId) {
  const result = await getJson(`/api/external-reports?orderId=${encodeURIComponent(orderId)}`);
  upsertOrder({
    orderId,
    reportStatus: result.reportStatus,
    reportError: result.reportError || null,
    externalReport: result.externalReport || null,
    updatedAt: Date.now(),
  });
  if (result.archive) {
    saveArchiveItem(result.archive);
  }
  return result;
}

function scheduleExternalReportPolling(orderId, { immediate = false } = {}) {
  stopExternalReportPolling(orderId);
  let attempts = 0;
  const poll = async () => {
    attempts += 1;
    try {
      const result = await syncExternalReport(orderId);
      if (document.querySelector('.view.is-active')?.dataset.view === "orders") renderOrders();
      if (result.reportStatus === "complete") {
        stopExternalReportPolling(orderId);
        showToast("운명 완전개봉 리포트가 완성되었습니다. 결제 내역에서 확인해주세요.");
        return;
      }
      if (result.reportStatus === "failed") {
        stopExternalReportPolling(orderId);
        showToast(result.reportError || "외부 심층 리포트 생성에 실패했습니다. 다시 생성을 요청해주세요.", true);
        return;
      }
    } catch {
      // 일시적인 조회 실패는 다음 폴링에서 다시 확인한다.
    }
    if (attempts >= 20) {
      stopExternalReportPolling(orderId);
      return;
    }
    externalReportPollers.set(orderId, window.setTimeout(poll, 15000));
  };
  externalReportPollers.set(orderId, window.setTimeout(poll, immediate ? 1000 : 10000));
}

async function openOrderReport(orderId) {
  const order = getOrders().find((entry) => entry.orderId === orderId);
  if (isExternalReportProductId(order?.productId)) {
    try {
      const synced = await syncExternalReport(orderId);
      const url = synced.externalReport?.shareUrl || order?.externalReport?.shareUrl;
      if (synced.reportStatus === "complete" && url) window.open(url, "_blank", "noopener");
      if (synced.archive) showToast("리포트 본문을 보관함에도 저장했습니다. 이제 챗봇 상담에서 선택할 수 있습니다.");
      else if (synced.reportStatus === "failed") showToast(synced.reportError || "외부 심층 리포트 생성에 실패했습니다. 다시 생성을 요청해주세요.", true);
      else {
        scheduleExternalReportPolling(orderId);
        showToast("외부 심층 리포트를 생성 중입니다. 완료되면 알려드리겠습니다.");
      }
    } catch (error) {
      if (order?.reportStatus === "complete" && order?.externalReport?.shareUrl) window.open(order.externalReport.shareUrl, "_blank", "noopener");
      else showToast(error.message || "외부 리포트 상태를 확인하지 못했습니다.", true);
    }
    return;
  }
  const item = getArchive().find((entry) => entry.orderId === orderId);
  if (!item) return retryOrderReport(orderId);
  openStoredAnalysis(item);
  trackEvent("archive_reopen", { archiveId: item.id, productId: item.productId, source: "orders" });
}

async function retryOrderReport(orderId) {
  const order = getOrders().find((item) => item.orderId === orderId);
  if (isExternalReportProductId(order?.productId)) {
    if (order?.reportStatus === "complete") return openOrderReport(orderId);
    try {
      const result = await getJson("/api/external-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", orderId }),
      });
      upsertOrder({
        orderId,
        reportStatus: result.reportStatus || "generating",
        reportError: null,
        externalReport: result.externalReport || order?.externalReport || null,
        updatedAt: Date.now(),
      });
      renderOrders();
      scheduleExternalReportPolling(orderId, { immediate: true });
      return showToast("외부 심층 리포트 생성을 다시 요청했습니다.");
    } catch (error) {
      return showToast(error.message || "외부 심층 리포트를 다시 요청하지 못했습니다.", true);
    }
  }
  if (order?.externalReport?.shareUrl) return openOrderReport(orderId);
  const purchase = recoverOrderPurchase(order);
  if (!purchase) return showToast("리포트 생성 정보를 복구할 수 없습니다.", true);
  startAnalysis(purchase.productId, purchase.profile, {
    orderId,
    paymentStatus: "결제 완료",
    partner: purchase.partner || null,
    targetYear: purchase.targetYear || null,
    calendarPick: purchase.calendarPick || null,
    retry: true,
  });
}

const POINT_TX_LABELS = {
  charge: "충전",
  bonus: "충전 보너스",
  spend: "상품 결제",
  refund: "결제 환원",
  admin_adjust: "관리자 조정",
};

function renderPointsView() {
  const balance = document.querySelector("[data-points-balance]");
  const tokens = document.querySelector("[data-points-tokens]");
  const tiers = document.querySelector("[data-point-tiers]");
  const history = document.querySelector("[data-point-transactions]");
  const status = document.querySelector("[data-points-status]");
  const dailyLink = document.querySelector("[data-points-daily]");
  if (!tiers || !history) return;
  const user = runtimeSession?.user;
  const points = runtimeSession?.points;
  if (dailyLink) dailyLink.hidden = !user?.id;
  if (!user?.id) {
    if (balance) balance.textContent = "로그인 필요";
    if (tokens) tokens.textContent = "로그인하면 포인트를 충전할 수 있습니다.";
    tiers.innerHTML = `<button class="primary-action" type="button" data-points-login>로그인하기</button>`;
    history.innerHTML = `<div class="empty-box">로그인 후 포인트 내역을 확인할 수 있습니다.</div>`;
    tiers.querySelector("[data-points-login]")?.addEventListener("click", openMypage);
    return;
  }
  if (!points?.enabled || !runtimeConfig?.pointsEnabled) {
    if (balance) balance.textContent = "사용 준비 중";
    if (tokens) tokens.textContent = "포인트 기능이 아직 활성화되지 않았습니다.";
    tiers.innerHTML = `<div class="empty-box">현재는 기존 토스 단독 결제를 이용해주세요.</div>`;
    history.innerHTML = "";
    return;
  }
  if (balance) balance.textContent = formatPoints(points.balance);
  if (tokens) tokens.textContent = `무료운세 재생성 토큰 ${Number(points.regenTokens || 0)}개`;
  tiers.innerHTML = (runtimeConfig.pointChargeTiers || [])
    .map((tier) => `
      <button type="button" class="point-tier" data-point-charge="${Number(tier.amount)}">
        <span>${formatWon(tier.amount)} 충전</span>
        <b>${formatPoints(tier.points)}</b>
        <small>보너스 ${Number(tier.bonusRate)}% · +${formatPoints(tier.bonus)}</small>
      </button>`)
    .join("");
  history.innerHTML = (points.transactions || []).length
    ? (points.transactions || []).map((tx) => `
        <article class="point-tx">
          <div><b>${escapeHtml(POINT_TX_LABELS[tx.type] || tx.type)}</b><small>${shortDate(tx.createdAt)}</small></div>
          <strong class="${Number(tx.amount) >= 0 ? "plus" : "minus"}">${Number(tx.amount) >= 0 ? "+" : ""}${formatPoints(tx.amount)}</strong>
        </article>`).join("")
    : `<div class="empty-box">아직 포인트 내역이 없습니다.</div>`;
  if (status) status.textContent = "";
  tiers.querySelectorAll("[data-point-charge]").forEach((button) => {
    button.addEventListener("click", () => startPointCharge(Number(button.dataset.pointCharge)));
  });
}

function startPointCharge(amount) {
  const tier = (runtimeConfig?.pointChargeTiers || []).find((item) => Number(item.amount) === Number(amount));
  if (!tier || !runtimeSession?.user?.id) return;
  const product = {
    name: `포인트 ${formatPoints(tier.points)} 충전`,
    amount: tier.amount,
    amountLabel: formatWon(tier.amount),
    paid: true,
    planId: "point-charge",
  };
  currentCheckout = { productId: "point-charge", product, profile: null, partner: null, pointsUsed: 0 };
  showView("pay");
  setupPayView(product);
}

// ---------- 비공개 1:1 문의 게시판 ----------
const SUPPORT_CATEGORY_LABELS = { error: "오류 문의", refund: "환불 요청", general: "일반 문의" };
const SUPPORT_STATUS_LABELS = { received: "접수", in_progress: "확인 중", answered: "답변 완료", closed: "종료" };
let supportState = { inquiries: [], activeId: null, loading: false, loadedForUser: null, error: "" };

function renderSupport() {
  const list = document.querySelector("[data-support-list]");
  const detail = document.querySelector("[data-support-detail]");
  const gate = document.querySelector("[data-support-login-gate]");
  const compose = document.querySelector("[data-support-compose]");
  if (!list || !detail || !gate || !compose) return;
  const user = runtimeSession?.user;
  gate.hidden = Boolean(user?.id);
  compose.textContent = user?.id ? "새 문의" : "로그인 후 문의";
  if (!user?.id) {
    list.innerHTML = "";
    detail.hidden = true;
    return;
  }
  if (supportState.loading) {
    list.innerHTML = `<div class="support-empty is-loading"><span class="inline-spinner"></span>문의 내역을 불러오는 중...</div>`;
    detail.hidden = true;
    return;
  }
  if (supportState.error) {
    list.innerHTML = `<div class="support-empty is-error">${escapeHtml(supportState.error)}<button type="button" data-support-retry>다시 불러오기</button></div>`;
    detail.hidden = true;
    return;
  }
  list.innerHTML = supportState.inquiries.length
    ? supportState.inquiries.map((item) => `
      <button class="support-list-item${item.id === supportState.activeId ? " is-active" : ""}" type="button" data-support-id="${escapeHtml(item.id)}">
        <span class="support-status is-${escapeHtml(item.status)}">${escapeHtml(SUPPORT_STATUS_LABELS[item.status] || item.status)}</span>
        <div><small>${escapeHtml(SUPPORT_CATEGORY_LABELS[item.category] || "일반 문의")} · ${escapeHtml(shortDate(item.createdAt))}</small><b>${escapeHtml(item.title)}</b></div>
        <i>›</i>
      </button>`).join("")
    : `<div class="support-empty"><b>아직 등록한 문의가 없습니다.</b><p>궁금한 점이 생기면 새 문의를 남겨주세요.</p></div>`;
  const active = supportState.inquiries.find((item) => item.id === supportState.activeId);
  if (!active) {
    detail.hidden = true;
    detail.innerHTML = "";
    return;
  }
  detail.hidden = false;
  detail.innerHTML = `
    <header><div><span>${escapeHtml(SUPPORT_CATEGORY_LABELS[active.category] || "일반 문의")}</span><h3>${escapeHtml(active.title)}</h3></div><button type="button" data-support-detail-close aria-label="상세 닫기">×</button></header>
    <div class="support-detail-meta"><span class="support-status is-${escapeHtml(active.status)}">${escapeHtml(SUPPORT_STATUS_LABELS[active.status] || active.status)}</span><time>${escapeHtml(shortDate(active.createdAt))}</time></div>
    <section><b>문의 내용</b><p>${escapeHtml(active.content).replace(/\n/g, "<br />")}</p></section>
    <section class="support-answer${active.answer ? " has-answer" : ""}"><b>관리자 답변</b><p>${active.answer ? escapeHtml(active.answer).replace(/\n/g, "<br />") : "답변을 준비하고 있습니다. 처리 상태가 바뀌면 이 화면에서 확인할 수 있습니다."}</p></section>`;
}

async function loadSupportBoard({ force = false } = {}) {
  const userId = runtimeSession?.user?.id ? String(runtimeSession.user.id) : null;
  if (!userId) {
    supportState = { inquiries: [], activeId: null, loading: false, loadedForUser: null, error: "" };
    renderSupport();
    return;
  }
  if (!force && supportState.loadedForUser === userId) return renderSupport();
  supportState = { inquiries: [], activeId: null, loading: true, loadedForUser: userId, error: "" };
  renderSupport();
  try {
    const res = await window.SajuApi.fetch("/api/support", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "문의 내역을 불러오지 못했습니다.");
    supportState.inquiries = body.inquiries || [];
  } catch (error) {
    supportState.error = error.message;
  } finally {
    supportState.loading = false;
    renderSupport();
  }
}

async function submitSupportInquiry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("[data-support-status]");
  const data = new FormData(form);
  const payload = {
    category: String(data.get("category") || "general"),
    title: String(data.get("title") || "").trim(),
    content: String(data.get("content") || "").trim(),
  };
  const setSupportStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };
  if (payload.title.length < 2) return setSupportStatus("제목을 2자 이상 입력하세요.", true);
  if (payload.content.length < 10) return setSupportStatus("문의 내용을 10자 이상 입력하세요.", true);
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;
  setSupportStatus("문의 등록 중...");
  try {
    const res = await window.SajuApi.fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "문의 등록에 실패했습니다.");
    supportState.inquiries.unshift(body.inquiry);
    supportState.activeId = body.inquiry.id;
    form.reset();
    form.hidden = true;
    setSupportStatus("");
    renderSupport();
    showToast("1:1 문의가 접수되었습니다.");
  } catch (error) {
    setSupportStatus(error.message, true);
  } finally {
    if (submit) submit.disabled = false;
  }
}

// ---------- 오늘의 무료운세 (리치) ----------
const GANZHI_INFO = {
  "甲": ["갑", "wood"], "乙": ["을", "wood"], "丙": ["병", "fire"], "丁": ["정", "fire"],
  "戊": ["무", "earth"], "己": ["기", "earth"], "庚": ["경", "metal"], "辛": ["신", "metal"],
  "壬": ["임", "water"], "癸": ["계", "water"],
  "子": ["자", "water"], "丑": ["축", "earth"], "寅": ["인", "wood"], "卯": ["묘", "wood"],
  "辰": ["진", "earth"], "巳": ["사", "fire"], "午": ["오", "fire"], "未": ["미", "earth"],
  "申": ["신", "metal"], "酉": ["유", "metal"], "戌": ["술", "earth"], "亥": ["해", "water"],
};
const EL_CLASS = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" };
function gz(ch) {
  return GANZHI_INFO[ch] || [ch, "earth"];
}

function dailyCacheKey(profileId, mood = "") {
  const d = new Date();
  const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const moodKey = encodeURIComponent(String(mood || "").trim()).slice(0, 100) || "default";
  return `saju_lab_daily_${accountScopeId}_${profileId}_${iso}_${moodKey}`;
}

const HOME_GUIDE_STEPS = Object.freeze({
  profile: {
    count: "1 / 4",
    title: "분석할 사람을 먼저 등록하세요",
    copy: "이름과 생년월일, 태어난 시간을 한 번 저장하면 다른 상품에서도 다시 입력할 필요가 없습니다.",
    action: "프로필 등록하기",
    view: "profile",
  },
  product: {
    count: "2 / 4",
    title: "궁금한 주제에 맞는 상품을 고르세요",
    copy: "기본 사주, 궁합, 대운, 연도운 중 원하는 분석을 선택하면 저장한 프로필을 고르는 화면이 열립니다.",
    action: "상품 둘러보기",
    view: "home",
    selector: ".product-grid",
  },
  orders: {
    count: "3 / 4",
    title: "결제 상태는 언제든 다시 확인할 수 있어요",
    copy: "진행 중인 주문은 이어서 결제하거나 취소할 수 있고, 완료된 주문은 상세 내역과 분석 상태를 확인할 수 있습니다.",
    action: "결제 내역 보기",
    view: "orders",
  },
  library: {
    count: "4 / 4",
    title: "완성된 결과는 보관함에 남습니다",
    copy: "페이지를 나갔다 돌아와도 같은 계정의 보관함에서 리포트를 다시 열고 챗봇 상담으로 이어갈 수 있습니다.",
    action: "보관함 열기",
    view: "library",
  },
});

function bindHomeGuide() {
  const panel = document.querySelector("[data-guide-panel]");
  if (!panel) return;
  let activeKey = "profile";
  const render = (key) => {
    const step = HOME_GUIDE_STEPS[key] || HOME_GUIDE_STEPS.profile;
    activeKey = key;
    document.querySelectorAll("[data-guide-step]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.guideStep === key);
    });
    panel.querySelector("[data-guide-count]").textContent = step.count;
    panel.querySelector("[data-guide-title]").textContent = step.title;
    panel.querySelector("[data-guide-copy]").textContent = step.copy;
    panel.querySelector("[data-guide-action]").textContent = step.action;
  };
  document.querySelectorAll("[data-guide-step]").forEach((button) => {
    button.addEventListener("click", () => render(button.dataset.guideStep));
  });
  panel.querySelector("[data-guide-action]")?.addEventListener("click", () => {
    const step = HOME_GUIDE_STEPS[activeKey];
    showView(step.view);
    if (step.selector) {
      window.setTimeout(() => document.querySelector(step.selector)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  });
  render(activeKey);
}

function startDailyFortune(profile, options = {}) {
  if (!profile) return;
  const mood = String(options.mood || "").trim().slice(0, 80);
  activeDailyProfile = profile;
  activeDailyMood = mood;
  showView("daily");
  const body = document.querySelector("[data-daily-body]");
  if (!body) return;
  const regenerate = document.querySelector("[data-daily-regenerate]");
  if (regenerate) {
    regenerate.disabled = true;
  }
  renderDailyRegeneration();

  // 같은 날 + 같은 사람 → 캐시(즉시, 포인트 추가 없음)
  const cached = readStore(dailyCacheKey(profile.id, mood), null);
  if (cached && !options.regen) {
    renderDailyFortune(profile, cached);
    return;
  }

  body.innerHTML = `
    <div class="daily-loading" role="status" aria-live="polite">
      <div class="daily-spinner"></div>
      <p>${escapeHtml(profile.name)}님의 오늘 기류를 읽는 중...</p>
      <small>사주 원국과 오늘 일진을 맞춰보고 있어요</small>
    </div>`;
  trackEvent("analysis_start", { productId: "daily-fortune", profileId: profile.id, profileName: profile.name });

  getJson("/api/saju/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: "daily-fortune", profile, mood, visitorId: visitorId(), regen: Boolean(options.regen) }),
  })
    .then((data) => {
      if (options.regen && !data.regenerated) {
        throw new Error("재생성권을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
      if (runtimeSession?.points && Number.isInteger(data.regenTokens)) {
        runtimeSession.points.regenTokens = data.regenTokens;
        renderSession();
      }
      writeStore(dailyCacheKey(profile.id, mood), data);
      renderDailyFortune(profile, data);
      trackEvent("analysis_complete", { productId: "daily-fortune", profileId: profile.id, profileName: profile.name });
    })
    .catch((error) => {
      body.innerHTML = `
        <div class="daily-loading">
          <p>오늘의 운세를 불러오지 못했어요.</p>
          <small>${escapeHtml(error.message)}</small>
          <button class="primary-action" type="button" data-view-target="fortune" style="margin-top:14px;max-width:200px">돌아가기</button>
        </div>`;
      body.querySelector("[data-view-target]")?.addEventListener("click", () => showView("fortune"));
    });
}

function pillarCell(label, pillar) {
  const normalized = window.DailyFortuneUI.normalizePillar(pillar);
  if (normalized.unknown) {
    return `
      <div class="mcell">
        <div class="mcell-label">${label}</div>
        <div class="mcell-unknown">미상</div>
      </div>`;
  }
  const stem = normalized.stemHanja;
  const branch = normalized.branchHanja;
  const [sko, sel] = gz(stem);
  const [bko, bel] = gz(branch);
  return `
    <div class="mcell">
      <div class="mcell-label">${label}</div>
      <div class="mcell-gz el-${sel}"><span class="gz-han">${escapeHtml(stem)}</span><span class="gz-ko">${escapeHtml(normalized.stemKo || sko)}</span></div>
      <div class="mcell-gz el-${bel}"><span class="gz-han">${escapeHtml(branch)}</span><span class="gz-ko">${escapeHtml(normalized.branchKo || bko)}</span></div>
    </div>`;
}

function renderDailyFortune(profile, data) {
  const body = document.querySelector("[data-daily-body]");
  if (!body) return;
  const d = data.daily || {};
  const s = data.summary || {};
  const p = s.pillars || {};
  const score = Math.max(0, Math.min(100, Number(d.overallScore || 0)));
  const todayLabel = data.today?.label || "";
  const iljin = data.todayPillar ? `${data.todayPillar.ko}(${data.todayPillar.ganzhi})` : "";

  const tags = (d.hashtags || []).map((t) => `<span>#${escapeHtml(t)}</span>`).join("");
  const cats = (d.categories || [])
    .map((c) => {
      const sc = Math.max(0, Math.min(100, Number(c.score || 0)));
      return `
        <div class="daily-cat cat-${escapeHtml(c.key)}">
          <span class="cat-emoji">${escapeHtml(c.emoji)}</span>
          <span class="cat-label">${escapeHtml(c.label)}</span>
          <div class="cat-bar"><i style="width:${sc}%"></i></div>
          <b>${sc}</b>
        </div>`;
    })
    .join("");
  const catBodies = (d.categories || [])
    .map((c) => `<div class="cat-note"><b>${escapeHtml(c.emoji)} ${escapeHtml(c.label)}</b><p>${escapeHtml(c.body)}</p></div>`)
    .join("");

  const lucky = d.lucky || {};
  const luckyHtml = `
    <div class="daily-lucky">
      <article><small>럭키 컬러</small><b>${escapeHtml(lucky.color || "-")}</b></article>
      <article><small>럭키 넘버</small><b>${escapeHtml(lucky.number || "-")}</b></article>
      <article><small>럭키 아이템</small><b>${escapeHtml(lucky.item || "-")}</b></article>
    </div>`;

  const els = [["목", "wood"], ["화", "fire"], ["토", "earth"], ["금", "metal"], ["수", "water"]];
  const elCounts = s.elements || {};
  const maxEl = Math.max(1, ...els.map(([k]) => Number(elCounts[k] || 0)));
  const elBars = els
    .map(([k, cls]) => `
      <div class="el-bar">
        <span>${k}</span>
        <div class="el-track"><i class="el-${cls}" style="height:${Math.round((Number(elCounts[k] || 0) / maxEl) * 100)}%"></i></div>
        <b>${Number(elCounts[k] || 0)}</b>
      </div>`)
    .join("");

  const sections = (d.sections || [])
    .map((sec) => `
      <article class="daily-acc-item">
        <header>${escapeHtml(sec.emoji)} ${escapeHtml(sec.title)}</header>
        <p>${escapeHtml(sec.body)}</p>
      </article>`)
    .join("");

  const quests = (d.quests || [])
    .map((q) => `<li><b>${escapeHtml(q.title)}</b><span>${escapeHtml(q.body)}</span></li>`)
    .join("");

  const food = d.food || {};
  const spot = d.luckySpot || {};

  const crossItems = [
    ["saju-analysis", "내 사주 전체가 궁금하다면?", "기질·재물·직업·관계까지 한 번에"],
    ["compatibility", "우리 사이는 몇 점?", "두 사람의 끌림과 충돌 지점"],
    ["cycle", "대운, 언제 물 들어와요?", "10년 단위 전환점 읽기"],
    ["yearly-fortune", "특정 연도가 궁금하다면?", "그 해의 큰 흐름과 타이밍"],
  ]
    .map(
      ([pid, t, sub]) => `
      <button type="button" data-daily-cross="${pid}">
        <div><b>${t}</b><small>${sub}</small></div><i>›</i>
      </button>`,
    )
    .join("");

  body.innerHTML = `
    <section class="daily-hero">
      <div class="daily-hero-top">
        <span class="daily-who">${escapeHtml(profile.name)}님${iljin ? ` · 오늘 ${escapeHtml(iljin)}` : ""}</span>
        <span class="daily-date">${escapeHtml(todayLabel)}</span>
      </div>
      <h2 class="daily-headline">${escapeHtml(d.headline || "")}</h2>
      <div class="daily-tags">${tags}</div>
      <div class="daily-score"><b>${score}</b><small>/ 100</small></div>
    </section>

    <section class="daily-cats">${cats}</section>

    ${luckyHtml}

    <section class="daily-block">
      <h3>🔮 내 사주 원국</h3>
      <div class="manse-mini">
        ${pillarCell("시주", p.hour)}
        ${pillarCell("일주", p.day)}
        ${pillarCell("월주", p.month)}
        ${pillarCell("연주", p.year)}
      </div>
      <div class="daily-meta-row">
        ${iljin ? `<span>오늘 일진 <b>${escapeHtml(iljin)}</b></span>` : ""}
        ${s.strength ? `<span>신강약 <b>${escapeHtml(s.strength)}</b></span>` : ""}
        ${s.yongsin ? `<span>용신 <b>${escapeHtml(s.yongsin)}</b></span>` : ""}
      </div>
      <div class="el-dist">${elBars}</div>
    </section>

    <section class="daily-block">
      <h3>✨ 오늘의 해설</h3>
      <div class="daily-acc">${sections}</div>
    </section>

    <section class="daily-block">
      <h3>💞 분야별 한마디</h3>
      <div class="cat-notes">${catBodies}</div>
    </section>

    ${quests ? `<section class="daily-block"><h3>🎯 오늘의 작은 실천</h3><ul class="daily-quests">${quests}</ul></section>` : ""}

    <section class="daily-block daily-food">
      <h3>🍽️ 오늘 뭐 먹지?</h3>
      <div class="food-card"><small>점심 추천</small><b>${escapeHtml(food.lunch?.name || "-")}</b><p>${escapeHtml(food.lunch?.reason || "")}</p></div>
      <div class="food-card"><small>저녁 추천</small><b>${escapeHtml(food.dinner?.name || "-")}</b><p>${escapeHtml(food.dinner?.reason || "")}</p></div>
    </section>

    <section class="daily-block">
      <h3>📍 오늘의 럭키 스팟</h3>
      <b class="spot-place">${escapeHtml(spot.place || "-")}</b>
      <p class="spot-reason">${escapeHtml(spot.reason || "")}</p>
    </section>

    <section class="daily-closing">
      <h3>🤍 마무리 한마디</h3>
      <p>${escapeHtml(d.closing || "")}</p>
    </section>

    <section class="daily-cross">
      <h3>이런 분석은 어때요?</h3>
      ${crossItems}
    </section>

    <p class="daily-foot">오늘의 무료 운세는 사람마다 하루 한 번 새로 계산돼요. 매일 들러 기류를 확인해보세요.</p>`;

  body.querySelectorAll("[data-daily-cross]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = btn.dataset.dailyCross;
      trackEvent("product_select", { productId: pid, source: "daily-cross" });
      if (pid === "compatibility") showView("compatibility");
      else openMemberModal(pid);
    });
  });
  renderDailyRegeneration();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDailyRegeneration() {
  const card = document.querySelector("[data-daily-regen-card]");
  const count = document.querySelector("[data-daily-regen-count]");
  const button = document.querySelector("[data-daily-regenerate]");
  const loggedIn = Boolean(runtimeSession?.user?.id);
  const tokens = Math.max(0, Number(runtimeSession?.points?.regenTokens || 0));
  if (card) card.hidden = !loggedIn;
  if (count) count.textContent = tokens > 0
    ? `남은 재생성권 ${tokens}개 · 오늘 운세를 새로 만들 수 있어요.`
    : "남은 재생성권이 없습니다.";
  if (button) {
    button.hidden = tokens <= 0;
    button.disabled = !activeDailyProfile;
    button.textContent = "재생성권 1개 사용";
  }
}

document.querySelector("[data-daily-regenerate]")?.addEventListener("click", () => {
  if (!activeDailyProfile || Number(runtimeSession?.points?.regenTokens || 0) <= 0) return;
  if (!window.confirm("재생성권 1개를 사용해 오늘의 무료운세를 새로 만들까요?")) return;
  startDailyFortune(activeDailyProfile, { regen: true, mood: activeDailyMood });
});

document.querySelector("[data-points-daily]")?.addEventListener("click", () => showView("fortune"));

// 화면 상단 토스트 (보이는 안내/에러)
function showToast(text, isError) {
  let el = document.querySelector(".app-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "app-toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.cssText =
    "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:99999;max-width:92%;" +
    "padding:12px 16px;border-radius:12px;font-size:13px;font-weight:800;text-align:center;" +
    "box-shadow:0 10px 28px rgba(0,0,0,.18);" +
    (isError
      ? "background:#fdecec;color:#b42318;border:1px solid #f3b4b4;"
      : "background:#e7f8ee;color:#137a43;border:1px solid #b6e6c9;");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.remove(), isError ? 9000 : 3500);
}

function renderAuthNotice() {
  const params = new URLSearchParams(window.location.search);
  const authResult = params.get("auth");
  if (!authResult) return;
  const reason = params.get("reason");
  pendingAuthNotice = { result: authResult, reason };
  history.replaceState(null, "", "/");
  if (authResult === "kakao-ok") {
    showToast("카카오 로그인 세션을 확인하는 중입니다.");
    return;
  }
  consumeAuthNotice(runtimeSession);
}

// ---------- Product catalog rendering ----------
// 서버(어드민) 설정을 사용자 화면에 적용: 상품명/가격/설명/이미지/사이트명
function applyRuntimeConfig() {
  const cfg = runtimeConfig || {};
  if (cfg.products) {
    Object.entries(cfg.products).forEach(([id, ov]) => {
      if (!PRODUCTS[id] || !ov) return;
      if (ov.name) PRODUCTS[id].name = ov.name;
      if (ov.description) PRODUCTS[id].description = ov.description;
      if (ov.amount !== undefined && ov.amount !== null) {
        const amt = Number(ov.amount);
        PRODUCTS[id].amount = amt;
        PRODUCTS[id].amountLabel = amt ? `${amt.toLocaleString("ko-KR")}원` : "0원";
        PRODUCTS[id].price = amt ? `${amt.toLocaleString("ko-KR")}원` : "무료";
        PRODUCTS[id].paid = amt > 0;
      }
    });
    renderProductCatalog();
  }
  if (cfg.images) {
    Object.entries(cfg.images).forEach(([key, url]) => {
      if (!url) return;
      document.querySelectorAll(`[data-img-key="${key}"]`).forEach((img) => {
        img.src = url;
      });
    });
    // 분석 로딩 비주얼: 가맹점이 어드민에서 올린 gif/mp4 가 있으면 기본 애니메이션을 대체
    const loadingMedia = cfg.images["loading.hero"];
    const loadingVisual = document.querySelector("[data-loading-visual]");
    if (loadingMedia && loadingVisual) {
      const safe = escapeHtml(loadingMedia);
      loadingVisual.innerHTML = /\.(mp4|webm)$/i.test(loadingMedia)
        ? `<video src="${safe}" class="loading-media" autoplay muted loop playsinline></video>`
        : `<img src="${safe}" alt="" class="loading-media" />`;
    }
  }
  if (cfg.branding?.siteName) {
    document.querySelectorAll(".brand-text").forEach((node) => {
      node.textContent = cfg.branding.siteName;
    });
  }
  renderSiteFooter(cfg.business || {});
  renderLegalBodies(cfg.legal || {}, cfg.business || {});
}

// 약관 본문 안의 {{상호명}} 등을 사업자정보로 치환
function fillBusinessPlaceholders(text, b) {
  return String(text || "")
    .replaceAll("{{상호명}}", b.name || "회사")
    .replaceAll("{{대표자명}}", b.owner || "")
    .replaceAll("{{고객센터전화}}", b.tel || "")
    .replaceAll("{{고객센터이메일}}", b.email || "")
    .replaceAll("{{개인정보보호책임자}}", b.privacyOfficer || b.owner || "");
}

// 사이트 하단 사업자정보 푸터
function renderSiteFooter(b) {
  const el = document.querySelector("[data-footer-business]");
  if (!el) return;
  const rows = [];
  if (b.name) rows.push(`상호 ${b.name}${b.owner ? ` · 대표 ${b.owner}` : ""}`);
  if (b.regNo) rows.push(`사업자등록번호 ${b.regNo}`);
  if (b.mailOrderNo) rows.push(`통신판매업신고 ${b.mailOrderNo}`);
  if (b.address) rows.push(b.address);
  const contact = [b.tel ? `고객센터 ${b.tel}` : "", b.email || ""].filter(Boolean).join(" · ");
  if (contact) rows.push(contact);
  el.innerHTML = rows.map((r) => `<span>${escapeHtml(r)}</span>`).join("");
}

// 약관/개인정보/환불 본문 렌더 (줄바꿈 → 문단)
function renderLegalBodies(legal, b) {
  ["terms", "privacy", "refund"].forEach((key) => {
    const el = document.querySelector(`[data-legal-body="${key}"]`);
    if (!el) return;
    const text = fillBusinessPlaceholders(legal[key] || "", b);
    el.innerHTML = text
      .split(/\n/)
      .map((line) => (line.trim() === "" ? "<br />" : `<p>${escapeHtml(line)}</p>`))
      .join("");
  });
}

function renderProductCatalog() {
  Object.entries(PRODUCTS).forEach(([productId, product]) => {
    document.querySelectorAll(`[data-product-name="${productId}"]`).forEach((node) => {
      node.textContent = product.name;
    });
    document.querySelectorAll(`[data-product-description="${productId}"]`).forEach((node) => {
      node.textContent = product.description;
    });
    document.querySelectorAll(`[data-product-price="${productId}"]`).forEach((node) => {
      node.textContent = product.price || PRICE_PENDING_LABEL;
    });
  });
}

// ---------- Profile select dropdowns ----------
function renderProfileSelects() {
  const profiles = getProfiles();
  document.querySelectorAll("[data-profile-select]").forEach((select) => {
    const previous = select.value;
    select.innerHTML = profiles.length
      ? profiles
          .map(
            (profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)} · ${formatBirthDate(profile.birthDate)} · ${genderLabel(profile.gender)}</option>`,
          )
          .join("")
      : `<option value="">먼저 프로필을 추가해주세요</option>`;
    if (previous && profiles.some((p) => p.id === previous)) select.value = previous;
  });
}

function renderPrimaryProfileLabel() {
  if (!primaryProfileLabel) return;
  const profile = getProfiles()[0];
  if (!profile) {
    primaryProfileLabel.textContent = "등록된 프로필이 없습니다. 먼저 사주를 추가해주세요.";
    return;
  }
  primaryProfileLabel.textContent = `${profile.name}님 · ${formatBirthDate(profile.birthDate)} · ${profileTime(profile)}`;
}


function renderMansePreview(profile) {
  if (!profileMansePreview) return;
  if (!profile || !profile.birthDate) {
    profileMansePreview.innerHTML = `<div class="empty-box">생년월일을 입력하면 입력 내용이 여기에 정리돼요.</div>`;
    return;
  }
  const timeText = profile.timeKnown === "no" ? "시간 모름" : profile.birthTime || "—";
  profileMansePreview.innerHTML = `
    <div class="input-recap">
      <div class="recap-row"><span>이름</span><b>${escapeHtml(profile.name || "—")}</b></div>
      <div class="recap-row"><span>생년월일</span><b>${escapeHtml(calendarLabel(profile.calendar))} ${escapeHtml(formatBirthDate(profile.birthDate))}</b></div>
      <div class="recap-row"><span>태어난 시각</span><b>${escapeHtml(timeText)}</b></div>
      <div class="recap-row"><span>성별</span><b>${escapeHtml(genderLabel(profile.gender))}</b></div>
      <p class="recap-note">🔮 실제 만세력(사주 원국)은 <b>결제 후</b> 중앙 만세력으로 정확히 계산돼요. 입력만 정확히 확인해 주세요.</p>
    </div>
  `;
}

// ---------- Time period grid renderer ----------
function renderTimePeriods() {
  if (!timePeriodGrid) return;
  timePeriodGrid.innerHTML = TIME_PERIODS.map(
    ([id, label, range], index) => `
      <button type="button" class="${index === 0 ? "is-active" : ""}" data-time-period="${id}">
        <b>${label}</b>
        <span>${range}</span>
      </button>
    `,
  ).join("");

  timePeriodGrid.querySelectorAll("[data-time-period]").forEach((button) => {
    button.addEventListener("click", () => {
      timePeriodGrid.querySelectorAll("[data-time-period]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      schedulePreviewUpdate();
    });
  });
}

// ---------- Segmented control handler ----------
function getSegmentedValue(name) {
  const group = document.querySelector(`[data-segmented="${name}"]`);
  if (!group) return null;
  return group.querySelector(".is-active")?.dataset.value || group.querySelector("button")?.dataset.value || null;
}

function applySegmentedDependencies() {
  const timeKnown = getSegmentedValue("timeKnown");
  const timeMode = getSegmentedValue("timeMode");
  const timeModeGroup = document.querySelector('[data-segmented="timeMode"]');
  const exactRow = exactTimeField;
  const periodGrid = timePeriodGrid;
  const yajasiGroup = document.querySelector('[data-segmented="yajasi"]');

  if (timeKnown === "no") {
    if (timeModeGroup) timeModeGroup.hidden = true;
    if (exactRow) exactRow.hidden = true;
    if (periodGrid) periodGrid.hidden = true;
    if (yajasiGroup) yajasiGroup.hidden = true;
    return;
  }
  if (timeModeGroup) timeModeGroup.hidden = false;
  if (yajasiGroup) yajasiGroup.hidden = false;
  if (timeMode === "exact") {
    if (exactRow) exactRow.hidden = false;
    if (periodGrid) periodGrid.hidden = true;
  } else {
    if (exactRow) exactRow.hidden = true;
    if (periodGrid) periodGrid.hidden = false;
  }
}

function bindSegmented() {
  document.querySelectorAll("[data-segmented]").forEach((group) => {
    group.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        group.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        applySegmentedDependencies();
        schedulePreviewUpdate();
      });
    });
  });
}

// ---------- Live profile preview ----------
let previewTimer = null;
function schedulePreviewUpdate() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    if (!profileForm) return;
    const profile = readProfileFromForm();
    renderMansePreview(profile);
  }, 80);
}

function readProfileFromForm() {
  if (!profileForm) return null;
  const data = new FormData(profileForm);
  const calendar = getSegmentedValue("calendar") || "solar";
  const timeKnown = getSegmentedValue("timeKnown") || "yes";
  const timeMode = getSegmentedValue("timeMode") || "exact";
  const yajasi = getSegmentedValue("yajasi") || "no";
  const activePeriod = timePeriodGrid?.querySelector(".is-active")?.dataset.timePeriod || "ja";
  const period = TIME_PERIODS.find(([id]) => id === activePeriod);
  return {
    id: `preview-${Date.now()}`,
    name: String(data.get("name") || "").trim(),
    relation: String(data.get("relation") || "본인").trim(),
    calendar,
    birthDate: data.get("birthDate") || "",
    gender: data.get("gender") || "F",
    timeKnown,
    timeMode,
    birthTime:
      timeKnown === "no"
        ? ""
        : timeMode === "exact"
          ? String(data.get("birthTime") || "12:00")
          : period?.[3] || "00:00",
    timePeriod: activePeriod,
    yajasi,
  };
}

// ---------- 프로필 추가/수정 ----------
let editingProfileId = null;
let openingEditProfile = false;
let profileReturnContext = null;

function setSegmented(name, value) {
  const group = document.querySelector(`[data-segmented="${name}"]`);
  if (!group) return;
  group.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.value === value));
}
function profileFormTitle() {
  return document.querySelector('[data-view="profile"] .view-title h1');
}
function profileSubmitBtn() {
  return profileForm?.querySelector('button[type="submit"]');
}
function fillProfileForm(profile) {
  if (!profileForm) return;
  const set = (sel, val) => {
    const el = profileForm.querySelector(sel);
    if (el) el.value = val;
  };
  set('[name="name"]', profile.name || "");
  const rel = profileForm.querySelector('[name="relation"]');
  if (rel && [...rel.options].some((o) => o.value === profile.relation)) rel.value = profile.relation;
  set('[name="birthDate"]', profile.birthDate || "");
  set('[name="gender"]', profile.gender || "F");
  if (profile.birthTime) set('[name="birthTime"]', profile.birthTime);
  setSegmented("calendar", profile.calendar || "solar");
  setSegmented("timeKnown", profile.timeKnown || "yes");
  setSegmented("timeMode", profile.timeMode || "exact");
  setSegmented("yajasi", profile.yajasi || "no");
  if (profile.timePeriod) {
    timePeriodGrid?.querySelectorAll("[data-time-period]").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.timePeriod === profile.timePeriod),
    );
  }
  applySegmentedDependencies();
  schedulePreviewUpdate();
}
function resetProfileForm() {
  editingProfileId = null;
  profileForm?.reset();
  setSegmented("calendar", "solar");
  setSegmented("timeKnown", "yes");
  setSegmented("timeMode", "exact");
  setSegmented("yajasi", "no");
  applySegmentedDependencies();
  const t = profileFormTitle();
  if (t) t.textContent = "새 사람 추가";
  const b = profileSubmitBtn();
  if (b) b.textContent = "저장하기";
  if (profileStatus) profileStatus.textContent = "";
  schedulePreviewUpdate();
}
function editProfile(id) {
  const target = getProfiles().find((p) => p.id === id);
  if (!target) return;
  openingEditProfile = true;
  showView("profile");
  openingEditProfile = false;
  editingProfileId = id;
  fillProfileForm(target);
  const t = profileFormTitle();
  if (t) t.textContent = "사람 정보 수정";
  const b = profileSubmitBtn();
  if (b) b.textContent = "수정 저장";
}

profileForm?.addEventListener("input", schedulePreviewUpdate);
profileForm?.addEventListener("change", schedulePreviewUpdate);

profileForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const profile = readProfileFromForm();
  if (!profile.name || !profile.birthDate) {
    if (profileStatus) profileStatus.textContent = "이름과 생년월일은 꼭 입력해주세요.";
    return;
  }
  // Normalize and validate birthDate
  profile.birthDate = normalizeBirthDate(profile.birthDate);
  if (!isValidBirthDate(profile.birthDate)) {
    if (profileStatus) profileStatus.textContent = "올바른 날짜 형식이 아니에요 (YYYY-MM-DD, 1~12월, 1~31일).";
    return;
  }
  // 수정 모드: 기존 프로필 갱신 후 인원관리로
  if (editingProfileId) {
    const editedId = editingProfileId;
    const existing = getProfiles().find((p) => p.id === editedId) || {};
    const updated = { ...existing, ...profile, id: editedId };
    const profiles = getProfiles().map((p) => (p.id === editedId ? updated : p));
    saveProfiles(profiles);
    pushProfile(updated); // 로그인 상태면 Supabase에도 갱신
    selectedProfileId = editedId;
    editingProfileId = null;
    renderProfileSelects();
    renderPrimaryProfileLabel();
    trackEvent("profile_edit", { profileId: editedId, profileName: profile.name });
    if (profileStatus) profileStatus.textContent = "수정되었어요.";
    setTimeout(() => showView("people"), 460);
    return;
  }
  // 신규 저장
  profile.id = `profile-${crypto.randomUUID()}`;
  profile.createdAt = Date.now();
  saveProfile(profile);
  selectedProfileId = profile.id;
  renderProfileSelects();
  renderPrimaryProfileLabel();
  if (profileStatus) profileStatus.textContent = "프로필이 저장되었어요. 홈에서 상품을 선택해 분석을 시작할 수 있어요.";
  trackEvent("profile_save", { profileId: profile.id, profileName: profile.name, gender: profile.gender });
  const returnContext = profileReturnContext;
  profileReturnContext = null;
  if (returnContext?.view === "compatibility") {
    setTimeout(() => {
      showView("compatibility");
      renderProfileSelects();
      const select = document.querySelector(`[data-compat-select="${returnContext.compatSlot}"]`);
      if (select) select.value = profile.id;
      const status = document.querySelector("[data-compat-status]");
      if (status) status.textContent = `${profile.name}님을 추가했습니다. 다른 한 분도 확인해주세요.`;
    }, 200);
    return;
  }
  // After save: open member modal for previously chosen product (or saju-analysis) on home
  setTimeout(() => {
    showView("home");
    openMemberModal(selectedProductId);
  }, 480);
});

// ---------- Member modal ----------
function openMemberModal(productId) {
  selectedProductId = productId;
  const product = PRODUCTS[productId] || PRODUCTS["saju-analysis"];
  const profiles = getProfiles();
  if (memberModalTitle) memberModalTitle.textContent = product.name;
  if (memberModalSubtitle) memberModalSubtitle.textContent = product.subtitle;
  if (memberList) {
    memberList.innerHTML = profiles.length
      ? profiles
          .map(
            (profile) => `
              <button type="button" class="member-row" data-select-profile="${escapeHtml(profile.id)}">
                <span class="avatar" style="background:${colorForText(profile.name)}">${escapeHtml(profileInitial(profile.name))}</span>
                <div class="member-meta">
                  <b>${escapeHtml(profile.name)}</b>
                  <small>${escapeHtml(profile.relation)} · ${escapeHtml(formatBirthDate(profile.birthDate))} · ${escapeHtml(profileTime(profile))}</small>
                </div>
                <i class="chevron">›</i>
              </button>
            `,
          )
          .join("")
      : `<div class="empty-box">등록된 프로필이 없습니다. 아래 버튼으로 먼저 추가해주세요.</div>`;
  }

  memberModal?.classList.add("is-open");
  memberModal?.removeAttribute("hidden");
  memberModal?.setAttribute("aria-hidden", "false");

  memberModal?.querySelectorAll("[data-select-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      const profile = getProfiles().find((item) => item.id === button.dataset.selectProfile);
      if (!profile) return;
      if (productId === "daily-fortune") {
        closeMemberModal();
        startDailyFortune(profile);
        return;
      }
      prepareCheckout(productId, profile);
    });
  });
}

function closeMemberModal() {
  memberModal?.classList.remove("is-open");
  memberModal?.setAttribute("aria-hidden", "true");
  memberModal?.setAttribute("hidden", "");
}

// ---------- Checkout ----------
function selectedCalendarPick() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem("saju_lab_calendar_pick") || "null");
    const purpose = String(parsed?.purpose || "").trim();
    const dates = Array.isArray(parsed?.dates)
      ? [...new Set(parsed.dates.map(String))].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort()
      : [];
    return purpose && dates.length >= 2 && dates.length <= 10 ? { purpose, dates } : null;
  } catch {
    return null;
  }
}

function prepareCheckout(productId, profile, partner = null) {
  const product = PRODUCTS[productId] || PRODUCTS["saju-analysis"];
  if (product.paid && !productPriceLoaded(product)) {
    showToast("상품 가격 정보를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", true);
    return;
  }
  currentCheckout = {
    productId,
    product,
    profile,
    partner,
    targetYear: productId === "yearly-fortune" ? selectedYearlyTarget() : null,
    calendarPick: productId === "auspicious-date" ? selectedCalendarPick() : null,
  };
  closeMemberModal();
  trackEvent("checkout_view", {
    productId,
    productName: product.name,
    targetYear: currentCheckout.targetYear,
    profileId: profile.id,
    profileName: profile.name,
    amount: product.amount,
  });

  const productEl = document.querySelector("[data-checkout-product]");
  const priceEl = document.querySelector("[data-checkout-price]");
  const amountEl = document.querySelector("[data-checkout-amount]");
  const descEl = document.querySelector("[data-checkout-description]");
  const profileEl = document.querySelector("[data-checkout-profile]");
  if (productEl) productEl.textContent = currentCheckout.targetYear ? `${product.name} · ${currentCheckout.targetYear}년` : product.name;
  if (priceEl) priceEl.textContent = product.price;
  if (amountEl) amountEl.textContent = product.amountLabel;
  if (descEl) {
    const selection = currentCheckout.calendarPick;
    descEl.textContent = selection
      ? `${product.description} · ${selection.purpose} · ${selection.dates.join(", ")}`
      : product.description;
  }
  if (profileEl) {
    const renderOne = (p) => `
      <span class="avatar" style="background:${colorForText(p.name)}">${escapeHtml(profileInitial(p.name))}</span>
      <div>
        <b>${escapeHtml(p.name)}님</b>
        <p>${escapeHtml(p.relation || '본인')} · ${calendarLabel(p.calendar)} · ${formatBirthDate(p.birthDate)} · ${profileTime(p)} · ${genderLabel(p.gender)}</p>
      </div>
    `;
    profileEl.innerHTML = partner
      ? `<div class="checkout-pair">${renderOne(profile)}<span class="pair-x">×</span>${renderOne(partner)}</div>`
      : renderOne(profile);
  }

  const terms = document.querySelector("[data-checkout-terms]");
  const payButton = document.querySelector("[data-checkout-pay]");
  const freeButton = document.querySelector("[data-checkout-free]");
  if (terms) terms.checked = false;
  if (payButton) {
    payButton.hidden = !product.paid;
    payButton.disabled = false;
    payButton.textContent = `${product.amountLabel} 결제하기`;
  }
  if (freeButton) {
    freeButton.hidden = product.paid;
    freeButton.disabled = false;
  }
  document.querySelector("[data-checkout-status]")?.replaceChildren();
  showView("checkout");
}

// 주문확인 → 결제 페이지(2단계). 결제 위젯은 이 화면에서만 렌더한다.
function setupPayView(product) {
  const prod = document.querySelector("[data-pay-product]");
  const amt = document.querySelector("[data-pay-amount]");
  const confirm = document.querySelector("[data-pay-confirm]");
  if (prod) prod.textContent = product.name;
  if (amt) amt.textContent = product.amountLabel;
  if (confirm) confirm.textContent = `${product.amountLabel} 결제하기`;
  document.querySelector("[data-pay-status]")?.replaceChildren();
  const pointPanel = document.querySelector("[data-point-payment]");
  const pointInput = document.querySelector("[data-point-use]");
  const pointUseAll = document.querySelector("[data-point-use-all]");
  const canUsePoints = currentCheckout?.productId !== "point-charge" && Boolean(runtimeSession?.user?.id && runtimeSession?.points?.enabled);
  if (pointPanel) pointPanel.hidden = !canUsePoints;
  if (pointInput) {
    pointInput.value = "0";
    pointInput.max = String(Math.min(Number(product.amount || 0), Number(runtimeSession?.points?.balance || 0)));
  }
  if (pointUseAll) pointUseAll.disabled = !canUsePoints || Number(pointInput?.max || 0) <= 0;
  currentCheckout.pointsUsed = 0;
  updatePointPayment();
}

function pointPaymentBreakdown() {
  const price = Number(currentCheckout?.product?.amount || 0);
  const balance = Number(runtimeSession?.points?.balance || 0);
  const requested = Number(currentCheckout?.pointsUsed || 0);
  const pointsUsed = Math.max(0, Math.min(price, balance, Number.isFinite(requested) ? Math.floor(requested) : 0));
  return { price, pointsUsed, cashAmount: price - pointsUsed };
}

function updatePointPayment() {
  if (!currentCheckout) return;
  const breakdown = pointPaymentBreakdown();
  currentCheckout.pointsUsed = breakdown.pointsUsed;
  const input = document.querySelector("[data-point-use]");
  const useAll = document.querySelector("[data-point-use-all]");
  const balance = document.querySelector("[data-point-balance]");
  const cash = document.querySelector("[data-pay-cash]");
  const amount = document.querySelector("[data-pay-amount]");
  const confirm = document.querySelector("[data-pay-confirm]");
  const widgetBox = document.querySelector("[data-toss-widget]");
  if (input && Number(input.value) !== breakdown.pointsUsed) input.value = String(breakdown.pointsUsed);
  if (useAll) useAll.disabled = window.PointPayment.fullUse(runtimeSession?.points?.balance, breakdown.price) <= 0;
  if (balance) balance.textContent = formatPoints(runtimeSession?.points?.balance || 0);
  if (cash) cash.textContent = formatWon(breakdown.cashAmount);
  if (amount) amount.textContent = currentCheckout.productId === "point-charge" ? formatWon(breakdown.price) : `${formatWon(breakdown.cashAmount)} + ${formatPoints(breakdown.pointsUsed)}`;
  if (confirm) confirm.textContent = breakdown.cashAmount === 0 ? `${formatPoints(breakdown.pointsUsed)}로 결제하기` : `${formatWon(breakdown.cashAmount)} 결제하기`;
  if (breakdown.cashAmount === 0) {
    if (widgetBox) widgetBox.hidden = true;
    document.querySelector("[data-pay-status]")?.replaceChildren();
  } else {
    setupCheckoutWidget({ ...currentCheckout.product, amount: breakdown.cashAmount });
  }
}

document.querySelector("[data-point-use]")?.addEventListener("input", (event) => {
  if (!currentCheckout) return;
  currentCheckout.pointsUsed = Number(event.currentTarget.value || 0);
  updatePointPayment();
});

document.querySelector("[data-point-use-all]")?.addEventListener("click", () => {
  if (!currentCheckout) return;
  currentCheckout.pointsUsed = window.PointPayment.fullUse(
    runtimeSession?.points?.balance,
    currentCheckout.product?.amount,
  );
  updatePointPayment();
});


// 주문확인 화면의 "결제하기" → 결제 페이지로 이동(다음 페이지에서 결제수단 선택)
document.querySelector("[data-checkout-pay]")?.addEventListener("click", () => {
  if (!currentCheckout) return;
  showView("pay");
  setupPayView(currentCheckout.product);
});
// 결제 페이지의 "결제하기" → 실제 결제 요청
document.querySelector("[data-pay-confirm]")?.addEventListener("click", () => {
  if (!currentCheckout) return; // 약관동의는 결제위젯이 자체 처리
  beginTossPayment(currentCheckout.product.planId, document.querySelector("[data-pay-confirm]"), currentCheckout);
});
document.querySelector("[data-pay-back]")?.addEventListener("click", () =>
  showView(
    currentCheckout?.productId === "followup"
      ? "followup"
      : currentCheckout?.productId === "point-charge"
        ? "points"
        : isChatCreditProductId(currentCheckout?.productId)
          ? "chat"
          : "checkout",
  ),
);

document.querySelector("[data-checkout-free]")?.addEventListener("click", () => {
  if (!currentCheckout) return;
  startAnalysis(currentCheckout.productId, currentCheckout.profile, {
    paymentStatus: "무료",
    partner: currentCheckout.partner || null,
    targetYear: currentCheckout.targetYear || null,
    calendarPick: currentCheckout.calendarPick || null,
  });
});

// ---------- Toss payment ----------
async function loadTossSdk() {
  // Wait briefly in case the head <script> is still loading
  const start = Date.now();
  while (!window.TossPayments && Date.now() - start < 1500) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (window.TossPayments) return window.TossPayments;
  // Fallback: inject if the original script was blocked
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v2/standard";
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error("토스페이먼츠 SDK를 불러오지 못했습니다. 네트워크/광고 차단을 확인해주세요."));
    document.head.appendChild(script);
  });
  if (!window.TossPayments) throw new Error("토스페이먼츠 SDK 초기화 실패");
  return window.TossPayments;
}

// 결제위젯(인라인 iframe) — 결제수단 선택 + 약관동의를 페이지 안에서 처리(새 창 이동 X).
// 키가 결제위젯 키가 아니면(=결제창 키) 자동으로 새 창 결제로 폴백한다.
let tossWidgets = null;
let tossWidgetsReady = false;
let tossWidgetSupported = true;
function isWidgetKeyError(e) {
  return /결제위젯/.test(e?.message || "");
}
async function ensureTossWidgets(amount) {
  if (!runtimeConfig?.tossClientKey) throw new Error("Toss 클라이언트 키가 없습니다.");
  const TossPayments = await loadTossSdk();
  try {
    if (!tossWidgets) {
      const tp = TossPayments(runtimeConfig.tossClientKey);
      tossWidgets = tp.widgets({ customerKey: TossPayments.ANONYMOUS || "ANONYMOUS" });
    }
    await tossWidgets.setAmount({ currency: "KRW", value: Number(amount) || 0 });
    if (!tossWidgetsReady) {
      await Promise.all([
        tossWidgets.renderPaymentMethods({
          selector: "#toss-payment-method",
          variantKey: runtimeConfig?.tossVariantKey || "DEFAULT", // 토스 어드민에서 만든 결제 UI 연결(노코드)
        }),
        tossWidgets.renderAgreement({ selector: "#toss-agreement", variantKey: "AGREEMENT" }),
      ]);
      tossWidgetsReady = true;
    }
    return tossWidgets;
  } catch (e) {
    tossWidgets = null;
    tossWidgetsReady = false;
    throw e;
  }
}

// 체크아웃 진입 시 위젯 노출(유료) / 자체 약관(무료) 전환
async function setupCheckoutWidget(product) {
  const widgetBox = document.querySelector("[data-toss-widget]");
  const termsRow = document.querySelector("[data-checkout-terms-row]");
  const status = document.querySelector("[data-pay-status]"); // 결제 페이지 상태줄(사용자가 보는 곳)
  if (termsRow) termsRow.hidden = true; // 약관동의는 위젯/결제창이 자체 처리
  if (!product.paid) {
    if (widgetBox) widgetBox.hidden = true;
    return;
  }
  try {
    await ensureTossWidgets(product.amount);
    tossWidgetSupported = true;
    if (widgetBox) widgetBox.hidden = false;
    if (status) status.textContent = "";
  } catch (e) {
    if (widgetBox) widgetBox.hidden = true;
    if (isWidgetKeyError(e)) {
      // 결제위젯 미지원 키 → "결제하기" 시 새 창(결제창)으로 진행
      tossWidgetSupported = false;
      if (status) status.textContent = "“결제하기”를 누르면 새 창에서 결제가 진행됩니다.";
    } else if (status) {
      status.textContent = `결제 위젯을 불러오지 못했어요: ${e.message}`;
    }
  }
}

async function beginTossPayment(planId, sourceButton, context = null) {
  const button = sourceButton || document.querySelector("[data-checkout-pay]");
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "결제창 준비 중...";
    }
    setPaymentStatus("결제 주문을 만들고 있습니다.");

    const order = await getJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        amount: context?.product?.amount,
        pointsUsed: context?.pointsUsed || 0,
        orderName: context?.product ? `${context.product.name}${context.profile?.name ? ` · ${context.profile.name}` : ""}` : undefined,
        visitorId: visitorId(),
        sessionId: sessionId(),
        productId: context?.productId,
        profileName: context?.profile?.name || null,
        purchaseSnapshot: context ? purchaseSnapshot(context) : null,
      }),
    });

    const purchase = context
      ? {
          productId: context.productId,
          product: context.product,
          profile: context.profile || null,
          partner: context.partner || null,
          targetYear: context.targetYear || null,
          calendarPick: context.calendarPick || null,
          orderId: order.orderId,
          orderName: order.orderName,
          amount: order.amount,
          price: order.price,
          pointsUsed: order.pointsUsed,
          payMethod: order.payMethod,
          customerKey: order.customerKey,
          createdAt: Date.now(),
          // 추가 질문 상담: 결제 후 답변 생성에 필요한 정보(만세력 재사용)
          question: context.question || null,
          analysisId: context.analysisId || null,
          manse: context.manse || null,
          summary: context.summary || null,
        }
      : null;

    if (purchase) {
      savePendingPurchase(purchase);
      upsertOrder({
        orderId: order.orderId,
        productId: context.productId,
        productName: context.product.name,
        profileName: context.profile?.name || (isChatCreditProductId(context.productId) ? "AI 챗봇 상담" : "포인트 충전"),
        amount: order.price,
        cashAmount: order.amount,
        pointsUsed: order.pointsUsed,
        payMethod: order.payMethod,
        purchase,
        status: order.paidWithPoints ? "결제 완료" : "결제 진행중",
        customer: runtimeSession?.user?.nickname || "비회원",
      });
    }

    if (order.paidWithPoints && purchase) {
      if (runtimeSession?.points) runtimeSession.points.balance = Number(order.pointBalance || 0);
      renderSession();
      clearPendingPurchase();
      if (isChatCreditProductId(purchase.productId)) {
        await completeChatCreditPurchase({ purchase, orderId: order.orderId, fulfillment: order.fulfillment });
      } else if (isExternalReportProductId(purchase.productId)) {
        completeExternalReportPurchase({ purchase, orderId: order.orderId, fulfillment: order.fulfillment });
      } else if (purchase.productId === "followup") {
        await runFollowupAnswer(purchase);
      } else {
        startAnalysis(purchase.productId, purchase.profile, {
          orderId: order.orderId,
          paymentStatus: "포인트 결제 완료",
          partner: purchase.partner || null,
          targetYear: purchase.targetYear || null,
          calendarPick: purchase.calendarPick || null,
        });
      }
      return;
    }

    if (!runtimeConfig?.tossClientKey) throw new Error("Toss 클라이언트 키가 없습니다.");

    const successUrl = `${location.origin}/payments/success`;
    const failUrl = `${location.origin}/payments/fail`;
    const orderName = purchase ? `${context.product.name}${context.profile?.name ? ` · ${context.profile.name}` : ""}` : order.orderName;
    const customerName = runtimeSession?.user?.nickname || context?.profile?.name || "사주언박싱-mini 고객";

    trackEvent("payment_start", { orderId: order.orderId, productId: context?.productId, amount: order.amount });

    // 1순위: 인라인 결제위젯에서 선택한 수단 + 약관동의로 결제
    if (tossWidgetSupported) {
      try {
        const widgets = await ensureTossWidgets(order.amount);
        await widgets.requestPayment({ orderId: order.orderId, orderName, customerName, successUrl, failUrl });
        return;
      } catch (e) {
        if (!isWidgetKeyError(e)) throw e;
        tossWidgetSupported = false; // 결제위젯 미지원 키 → 결제창 폴백
      }
    }

    // 폴백: 결제창(새 창) 방식
    const TossPayments = await loadTossSdk();
    const payment = TossPayments(runtimeConfig.tossClientKey).payment({
      customerKey: order.customerKey || TossPayments.ANONYMOUS || "ANONYMOUS",
    });
    await payment.requestPayment({
      method: "CARD",
      amount: { value: order.amount, currency: "KRW" },
      orderId: order.orderId,
      orderName,
      customerName,
      successUrl,
      failUrl,
      windowTarget: "self",
    });
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = context?.product ? `${context.product.amountLabel} 결제하기` : "결제하기";
    }
    document.querySelector("[data-pay-status]")?.replaceChildren(document.createTextNode(`결제 시작 실패: ${error.message}`));
    setPaymentStatus(`결제 시작 실패: ${error.message}`);
    trackEvent("payment_error", { message: error.message, productId: context?.productId, amount: context?.product?.amount });
  }
}

async function requestExistingOrderPayment(order, purchase) {
  if (!runtimeConfig?.tossClientKey) throw new Error("Toss 클라이언트 키가 없습니다.");
  const amount = Number(purchase.amount ?? order.cashAmount ?? window.OrderRecovery.cashAmount(order));
  if (!(amount > 0)) throw new Error("토스로 결제할 금액이 없습니다.");
  const orderName = purchase.orderName || `${purchase.product?.name || order.productName || "사주 리포트"}${purchase.profile?.name ? ` · ${purchase.profile.name}` : ""}`;
  const customerName = runtimeSession?.user?.nickname || purchase.profile?.name || "사주언박싱-mini 고객";
  const successUrl = `${location.origin}/payments/success`;
  const failUrl = `${location.origin}/payments/fail`;
  trackEvent("payment_resume", { orderId: order.orderId, productId: order.productId, amount });

  if (tossWidgetSupported) {
    try {
      const widgets = await ensureTossWidgets(amount);
      await widgets.requestPayment({ orderId: order.orderId, orderName, customerName, successUrl, failUrl });
      return;
    } catch (error) {
      if (!isWidgetKeyError(error)) throw error;
      tossWidgetSupported = false;
    }
  }

  const TossPayments = await loadTossSdk();
  const payment = TossPayments(runtimeConfig.tossClientKey).payment({
    customerKey: purchase.customerKey || TossPayments.ANONYMOUS || "ANONYMOUS",
  });
  await payment.requestPayment({
    method: "CARD",
    amount: { value: amount, currency: "KRW" },
    orderId: order.orderId,
    orderName,
    customerName,
    successUrl,
    failUrl,
    windowTarget: "self",
  });
}


// ---------- Analysis rendering ----------
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderParagraphs(body) {
  return String(body ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

// 중앙 만세력 API 결과(full = ComputeBaziResult) → 만세력 보드 표시용 4기둥 배열
function mapManseToBoard(full) {
  const order = [
    ["시주", "hour"],
    ["일주", "day"],
    ["월주", "month"],
    ["연주", "year"],
  ];
  return order.map(([label, key]) => {
    const p = (full.pillar && full.pillar[key]) || {};
    const stem = p.stem || "";
    const branch = p.branch || "";
    const stemKo = STEMS_KO[STEMS.indexOf(stem)] || "";
    const branchKo = BRANCHES_KO[BRANCHES.indexOf(branch)] || "";
    const hidden = p.hiddenStems
      ? [p.hiddenStems.yeogi, p.hiddenStems.junggi, p.hiddenStems.bongi].filter(Boolean)
      : [];
    const sh = (full.shinsal && full.shinsal[`${key}Shensha`]) || {};
    const stars = Array.isArray(sh.bojoShinsal) ? sh.bojoShinsal : [];
    const relations = [p.napeum, p.pillarStrength].filter(Boolean);
    return {
      label,
      stem,
      stemKo,
      branch,
      branchKo,
      stemTenGod: p.stemTenGod || "",
      branchTenGod: p.branchTenGod || "",
      stemColor: STEM_COLOR[stem] || { bg: "#fada7a", fg: "#57564f" },
      branchColor: BRANCH_COLOR[branch] || { bg: "#fada7a", fg: "#57564f" },
      hiddenStems: hidden,
      twelveStage: p.twelveStage || "",
      sinsal: sh.year || "",
      stars,
      relations,
    };
  });
}

// 개운 카드 — 나를 살리는 기운/색/숫자/방향(사주마다 달라짐). 쉬운 말 위주.
const ELEMENT_GLOSS = { 목: "나무", 화: "불", 토: "흙", 금: "쇠·금속", 수: "물" };
function luckyCardHtml(lucky) {
  if (!lucky || !lucky.element) return "";
  const gloss = (el) => (ELEMENT_GLOSS[el] ? `${ELEMENT_GLOSS[el]}(${el})` : el);
  const numberText = lucky.numberFocus
    ? `${lucky.number || ""} (특히 ${lucky.numberFocus})`
    : lucky.number || "-";
  const assist =
    lucky.assistElement && lucky.assistElement !== lucky.element
      ? `<small class="lucky-assist">도와주는 기운 ${escapeHtml(gloss(lucky.assistElement))} · ${escapeHtml(lucky.assistColor || "")}</small>`
      : "";
  return `
    <div class="report-lucky">
      <div class="report-lucky-head">
        <span class="lucky-badge">나에게 힘이 되는 것</span>
        <b>${escapeHtml(gloss(lucky.element))} 기운</b>
      </div>
      <div class="report-lucky-grid">
        <article><small>행운 색</small><b>${escapeHtml(lucky.color || "-")}</b></article>
        <article><small>행운 숫자</small><b>${escapeHtml(numberText)}</b></article>
        <article><small>행운 방향</small><b>${escapeHtml(lucky.direction || "-")}</b></article>
      </div>
      ${assist}
      ${lucky.why ? `<p class="lucky-why">${escapeHtml(lucky.why)}</p>` : ""}
      ${lucky.personalNote ? `<p class="lucky-note">✦ ${escapeHtml(lucky.personalNote)}</p>` : ""}
    </div>`;
}

function renderAnalysisResult(productId, profile, partner = null, data = null) {
  const product = PRODUCTS[productId] || PRODUCTS["saju-analysis"];

  document.querySelector("[data-analysis-kicker]").textContent = product.category;
  document.querySelector("[data-analysis-title]").textContent =
    productId === "compatibility" && partner
      ? `${profile.name}님 × ${partner.name}님의 ${product.name}`
      : `${profile.name}님의 ${product.name}`;
  const chipsHtml =
    productId === "compatibility" && partner
      ? `<span>${escapeHtml(profile.name)}님 × ${escapeHtml(partner.name)}님</span>
         <span>${formatBirthDateLong(profile.birthDate)}</span>
         <span>${formatBirthDateLong(partner.birthDate)}</span>`
      : `<span>${formatBirthDateLong(profile.birthDate)}</span>
         <span>${calendarLabel(profile.calendar)}</span>
         <span>${escapeHtml(profileTime(profile))}</span>
         <span>${genderLabel(profile.gender)}</span>
         <span>${escapeHtml(profile.relation)}</span>`;
  document.querySelector("[data-analysis-chips]").innerHTML = chipsHtml;

  // 가짜 폴백 금지 — 실제 만세력(중앙 API 응답)이 없으면 결과를 만들지 않고 안내만 한다.
  // (중앙 API 키가 없거나 포인트가 없으면 새 분석은 여기까지 오지 못하고 .catch 에서 막힘)
  if (!data || !data.manse) {
    document.querySelector("[data-analysis-manse]").innerHTML = "";
    document.querySelector("[data-analysis-sections]").innerHTML =
      `<div class="empty-box">분석 결과를 불러올 수 없습니다.<br />만세력 연결(API 키·포인트)을 확인해 주세요.</div>`;
    document.querySelector("[data-analysis-report]").hidden = false;
    document.querySelector("[data-analysis-related]").hidden = false;
    return;
  }
  const pillars = mapManseToBoard(data.manse);
  const sections = data.sections || [];

  document.querySelector("[data-analysis-manse]").innerHTML = `
    <div class="manse-grid">
      ${pillars
        .map(
          (pillar) => `
            <article class="manse-column">
              <div class="manse-label">${pillar.label}</div>
              <div class="manse-cell" style="background:${pillar.stemColor.bg};color:${pillar.stemColor.fg}">
                <strong>${pillar.stem}</strong>
                <span>${pillar.stemKo}</span>
                <small>${pillar.stemTenGod}</small>
              </div>
              <div class="manse-cell" style="background:${pillar.branchColor.bg};color:${pillar.branchColor.fg}">
                <strong>${pillar.branch}</strong>
                <span>${pillar.branchKo}</span>
                <small>${pillar.branchTenGod}</small>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="manse-info-grid">
      ${pillars.map((p) => `<div>${p.hiddenStems.join("<br />")}</div>`).join("")}
      ${pillars.map((p) => `<div>${p.twelveStage}</div>`).join("")}
      ${pillars.map((p) => `<div>${p.sinsal}</div>`).join("")}
      ${pillars.map((p) => `<div class="manse-info-stars">${p.stars.join("<br />")}</div>`).join("")}
      ${pillars.map((p) => `<div class="manse-info-stars">${p.relations.join("<br />")}</div>`).join("")}
    </div>
  `;

  const headlineHtml = data?.headline
    ? `<p class="report-headline">${escapeHtml(data.headline)}</p>`
    : "";
  const luckyHtml = productId === "compatibility" ? compatCardHtml(data) : luckyCardHtml(data?.lucky);
  const timelineHtml =
    productId === "cycle" ? cycleTimelineHtml(data?.context) : productId === "yearly-fortune" ? yearlyStripHtml(data?.context) : "";
  const sectionsHtml = sections
    .map((section, index) => {
      const id = section.id || `s${index}`;
      const placeholderBody = String(section.body || "").trim() === "이 부분은 잠시 후 다시 펼쳐 주세요.";
      const hasBody = section.body && String(section.body).trim() && !placeholderBody;
      const failed = placeholderBody || section.status === "failed" || section.error;
      const bodyHtml = hasBody
        ? renderParagraphs(section.body)
        : failed
          ? `<div class="section-error">
              <p>이 부분은 아직 완성되지 않았어요.</p>
              <small>${escapeHtml(section.error || "섹션 생성에 실패했습니다.")}</small>
              <button type="button" class="section-retry-button" data-section-retry="${escapeHtml(id)}">이 부분 다시 생성</button>
            </div>`
          : `<div class="section-loading"><span></span><span></span><span></span></div>`;
      return `
        <details class="report-section" data-section-id="${escapeHtml(id)}" ${index < 3 ? "open" : ""}>
          <summary><span>${escapeHtml(section.icon)}</span>${escapeHtml(section.title)}<i class="report-chevron" aria-hidden="true">›</i></summary>
          <div class="section-body">${bodyHtml}</div>
        </details>
      `;
    })
    .join("");
  document.querySelector("[data-analysis-sections]").innerHTML = headlineHtml + luckyHtml + timelineHtml + sectionsHtml;

  document.querySelector("[data-analysis-report]").hidden = false;
  document.querySelector("[data-analysis-related]").hidden = false;

  // 공유: 현재 리포트 저장 + 공유 버튼 노출
  lastReport = { productId, profileName: partner ? `${profile.name} × ${partner.name}` : profile.name, data, sections, archiveId: activeAnalysisArchiveId };
  lastShareUrl = null;
  const shareStatus = document.querySelector("[data-share-status]");
  if (shareStatus) shareStatus.textContent = "";
  const shareBox = document.querySelector("[data-report-share]");
  if (shareBox) shareBox.hidden = false;
}

// ── 리포트 공유 ──────────────────────────────────────
async function ensureShareUrl() {
  if (lastShareUrl) return lastShareUrl;
  if (!lastReport?.data) throw new Error("공유할 리포트가 없습니다.");
  const { productId, profileName, data, sections } = lastReport;
  const body = await getJson("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
    productId,
    productName: (PRODUCTS[productId] || {}).name || "사주 리포트",
    profileName,
    headline: data.headline || "",
    sections: (sections || []).map((s) => ({ icon: s.icon, title: s.title, body: s.body })),
    lucky: data.lucky || null,
    score: data.score ?? null,
    scoreLabel: data.scoreLabel || null,
    }),
  });
  if (!body.url) throw new Error(body.message || "공유 링크 생성에 실패했습니다.");
  lastShareUrl = body.url;
  return lastShareUrl;
}

function fallbackCopy(url) {
  navigator.clipboard?.writeText(url);
  const status = document.querySelector("[data-share-status]");
  if (status) status.textContent = "링크를 복사했어요 (카톡에 붙여넣기)";
}

function shareKakao(url, title) {
  const key = runtimeConfig?.kakaoJsKey;
  if (!key) return fallbackCopy(url);
  const send = () => {
    try {
      if (!Kakao.isInitialized()) Kakao.init(key);
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: { title, description: "사주언박싱-mini 리포트", imageUrl: `${location.origin}/assets/generated/banners/heukya-premium-hero.jpg`, link: { mobileWebUrl: url, webUrl: url } },
      });
    } catch {
      fallbackCopy(url);
    }
  };
  if (window.Kakao) return send();
  const script = document.createElement("script");
  script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
  script.crossOrigin = "anonymous";
  script.onload = send;
  script.onerror = () => fallbackCopy(url);
  document.head.appendChild(script);
}

async function shareReport(platform) {
  const status = document.querySelector("[data-share-status]");
  if (status) status.textContent = "공유 링크 준비 중...";
  try {
    const url = await ensureShareUrl();
    const title = lastReport?.data?.headline || `${lastReport?.profileName || ""}님의 사주 리포트`;
    if (platform === "copy") {
      await navigator.clipboard.writeText(url);
      if (status) status.textContent = "링크를 복사했어요";
    } else if (platform === "x") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
      if (status) status.textContent = "";
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener");
      if (status) status.textContent = "";
    } else if (platform === "kakao") {
      shareKakao(url, title);
    }
  } catch (e) {
    if (status) status.textContent = e.message;
  }
}

document.querySelector("[data-report-share]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-share]");
  if (button) shareReport(button.dataset.share);
});

// 2단계: 섹션 본문이 도착하면 해당 아코디언 자리에 채운다(점진적 렌더)
function fillSectionBody(id, body) {
  const host = document.querySelector(`[data-section-id="${id}"] .section-body`);
  if (host) host.innerHTML = renderParagraphs(body);
}

function fillSectionLoading(id) {
  const host = document.querySelector(`[data-section-id="${id}"] .section-body`);
  if (host) host.innerHTML = `<div class="section-loading"><span></span><span></span><span></span></div>`;
}

function fillSectionFailed(id, error) {
  const host = document.querySelector(`[data-section-id="${id}"] .section-body`);
  if (!host) return;
  host.innerHTML = `
    <div class="section-error">
      <p>이 부분은 아직 완성되지 않았어요.</p>
      <small>${escapeHtml(error || "섹션 생성에 실패했습니다.")}</small>
      <button type="button" class="section-retry-button" data-section-retry="${escapeHtml(id)}">이 부분 다시 생성</button>
    </div>`;
}

function refreshStoredAnalysis(item) {
  const profile = getProfiles().find((entry) => entry.id === item.profileId);
  if (!profile) return;
  const partner = item.partnerId ? getProfiles().find((entry) => entry.id === item.partnerId) : null;
  activeAnalysisArchiveId = item.id;
  renderAnalysisResult(item.productId, profile, partner, item.analysis || null);
}

async function retryReportSection(sectionId, trigger = null) {
  const archiveId = lastReport?.archiveId || activeAnalysisArchiveId;
  const item = getArchive().find((entry) => entry.id === archiveId);
  if (!item) return showToast("보관함 리포트를 찾을 수 없습니다.", true);

  const profile = getProfiles().find((entry) => entry.id === item.profileId);
  if (!profile) return showToast("분석 대상 프로필을 찾을 수 없습니다.", true);
  const partner = item.partnerId ? getProfiles().find((entry) => entry.id === item.partnerId) : null;
  const sections = item.analysis?.sections || [];
  const section = sections.find((entry) => String(entry.id) === String(sectionId));
  const context = item.analysis?.context;
  if (!section || !context) return showToast("이전 생성 정보를 찾을 수 없어 이 부분만 다시 만들 수 없습니다.", true);

  if (trigger) trigger.disabled = true;
  fillSectionLoading(sectionId);
  try {
    const allTitles = sections.map((entry) => entry.title).filter(Boolean);
    const response = await getJson("/api/saju/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: item.productId, profile, partner, context, section, otherTitles: allTitles }),
    }, SECTION_RETRY_TIMEOUT_MS);
    const updated = updateArchiveItem(item.id, (draft) => {
      const next = window.ReportRecovery.mergeSection(draft, sectionId, response.body || "");
      const hasFailed = (next.analysis?.sections || []).some((entry) => entry.status === "failed" || !String(entry.body || "").trim());
      return window.ReportRecovery.finish(next, hasFailed ? "failed" : "complete", hasFailed ? "일부 리포트 생성이 완료되지 않았습니다." : null);
    });
    if (updated) refreshStoredAnalysis(updated);
    showToast("해당 섹션을 다시 생성했습니다.");
  } catch (error) {
    fillSectionFailed(sectionId, error.message);
    const updated = updateArchiveItem(item.id, (draft) =>
      window.ReportRecovery.finish(window.ReportRecovery.markSectionFailed(draft, sectionId, error.message), "failed", error.message),
    );
    if (updated) refreshStoredAnalysis(updated);
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

document.querySelector("[data-analysis-sections]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section-retry]");
  if (button) retryReportSection(button.dataset.sectionRetry, button);
});

// 대운 타임라인 — 나이 마디만 보여주는 띠(용어 노출 X), 현재 구간 강조
function cycleTimelineHtml(ctx) {
  const items = ctx && ctx.대운타임라인;
  if (!Array.isArray(items) || !items.length) return "";
  const curAge = ctx?.현재대운?.age;
  let curIdx = -1;
  items.forEach((it, i) => { if (typeof curAge === "number" && it.시작나이 <= curAge) curIdx = i; });
  const nodes = items
    .map((it, i) => `<div class="tl-node${i === curIdx ? " is-now" : ""}"><span class="tl-age">${Number(it.시작나이)}세</span>${i === curIdx ? '<b class="tl-now">지금</b>' : ""}</div>`)
    .join("");
  return `<div class="report-timeline"><h3>10년 단위 흐름</h3><div class="tl-track">${nodes}</div></div>`;
}

// 연도별 운세 — 다가오는 해 카드(연도+나이), 올해 강조
function yearlyStripHtml(ctx) {
  const ys = ctx && ctx.세운;
  if (!Array.isArray(ys) || !ys.length) return "";
  const targetYear = Number(ctx?.대상연도 || ys[0]?.연도);
  const currentYear = new Date().getFullYear();
  const cards = ys
    .slice(0, 8)
    .map((y) => {
      const year = Number(y.연도);
      const suffix = year === currentYear ? " · 올해" : year === targetYear ? " · 선택 연도" : "";
      return `<div class="yr-card is-now"><b>${escapeHtml(String(y.연도))}</b><small>${Number(y.나이)}세${suffix}</small></div>`;
    })
    .join("");
  return `<div class="report-timeline"><h3>${targetYear ? `${targetYear}년 운세 기준` : "연도별 운세 기준"}</h3><div class="yr-track">${cards}</div></div>`;
}

// 궁합 점수 카드 — 점수 게이지 + 한 줄 라벨 + 해시태그(재미 요소)
function compatCardHtml(data) {
  if (!data || typeof data.score !== "number") return "";
  const score = Math.max(0, Math.min(100, Number(data.score) || 0));
  const tags = (data.hashtags || []).map((t) => `<span>#${escapeHtml(t)}</span>`).join("");
  return `
    <div class="report-compat">
      <div class="compat-score"><b>${score}</b><small>점</small></div>
      <div class="compat-gauge"><i style="width:${score}%"></i></div>
      ${data.scoreLabel ? `<p class="compat-label">${escapeHtml(data.scoreLabel)}</p>` : ""}
      ${tags ? `<div class="compat-tags">${tags}</div>` : ""}
    </div>`;
}

function createAnalysisDraft({ productId, product, profile, partner, orderId, paymentStatus, data }) {
  return window.ReportRecovery.createDraft({
    id: orderId ? `analysis-${orderId}` : `analysis-${crypto.randomUUID()}`,
    orderId: orderId || null,
    productId,
    productName: product.name,
    profileName: partner ? `${profile.name} × ${partner.name}` : profile.name,
    profileId: profile.id,
    partnerId: partner?.id || null,
    partnerName: partner?.name || null,
    paymentStatus: paymentStatus || "결제 완료",
    data: {
      ...data,
      context: data.context || undefined,
      targetYear: data.targetYear || data.context?.대상연도 || undefined,
    },
  });
}

function saveAnalysisDraft(draft, { reportStatus = draft.generationStatus, reportError = draft.generationError } = {}) {
  activeAnalysisArchiveId = draft.id;
  saveArchive(draft, { sync: false });
  analysisDraftSync = analysisDraftSync
    .then(() => pushUserData("archive", draft))
    .catch(() => {});
  if (draft.orderId) {
    upsertOrder({
      orderId: draft.orderId,
      reportStatus,
      reportError: reportError || null,
      archiveId: draft.id,
    });
  }
  return draft;
}

function startAnalysis(productId, profile, meta = {}) {
  const product = PRODUCTS[productId] || PRODUCTS["saju-analysis"];
  const partner = meta.partner || null;
  let analysisDraft = null;
  if (meta.orderId) upsertOrder({ orderId: meta.orderId, reportStatus: "generating", reportError: null });
  trackEvent("analysis_start", {
    productId,
    productName: product.name,
    profileId: profile.id,
    profileName: profile.name,
    orderId: meta.orderId || null,
  });
  window.clearTimeout(activeAnalysisTimer);
  window.clearTimeout(analysisLoadingHideTimer);
  analysisLoadingHideTimer = null;
  paymentReturn = Boolean(meta.paymentReturn);
  showView("analysis");

  const loading = document.querySelector("[data-analysis-loading]");
  const progress = document.querySelector("[data-analysis-progress]");
  const progressLabel = document.querySelector("[data-analysis-progress-label]");
  const message = document.querySelector("[data-analysis-message]");
  const setProgress = (value) => {
    const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (progress) progress.style.width = `${percent}%`;
    if (progressLabel) progressLabel.textContent = `${percent}%`;
  };

  if (loading) loading.hidden = false;
  const scrollHint = document.querySelector("[data-scroll-hint]");
  if (scrollHint) scrollHint.hidden = false;
  document.querySelector("[data-analysis-report]").hidden = true;
  document.querySelector("[data-analysis-related]").hidden = true;
  document.querySelector("[data-analysis-chips]").innerHTML = "";
  document.querySelector("[data-analysis-title]").textContent = `${profile.name}님의 ${product.name}`;
  document.querySelector("[data-analysis-kicker]").textContent = product.category;
  document.querySelector("[data-analysis-manse]").innerHTML = "";
  setProgress(5);
  if (message) message.textContent = "만세력과 리포트 구성을 준비하는 중입니다...";

  let planProgressTicks = 0;
  let planProgressTimer = window.setInterval(() => {
    planProgressTicks += 1;
    setProgress(window.AnalysisStream.progressForPlanWait(planProgressTicks));
  }, 1000);

  const finishLoading = () => {
    window.clearTimeout(activeAnalysisTimer);
    activeAnalysisTimer = null;
    window.clearInterval(planProgressTimer);
    planProgressTimer = null;
  };

  const hideAnalysisLoading = () => {
    if (loading) loading.hidden = true;
    if (scrollHint) scrollHint.hidden = true;
  };

  const completeAnalysisLoading = (finalMessage = "리포트 생성을 완료했습니다.") => {
    setProgress(100);
    if (message) message.textContent = finalMessage;
    window.clearTimeout(analysisLoadingHideTimer);
    analysisLoadingHideTimer = window.setTimeout(() => {
      hideAnalysisLoading();
      analysisLoadingHideTimer = null;
    }, 300);
  };

  const complete = () =>
    trackEvent("analysis_complete", { productId, productName: product.name, profileId: profile.id, profileName: profile.name, orderId: meta.orderId || null });

  let streamCompleted = false;
  const handleStreamEvent = ({ event, data: payload }) => {
    if (event === "started") {
      setProgress(payload.progress || 5);
      if (message) message.textContent = "입력 정보를 확인했습니다. 만세력을 계산하는 중입니다...";
      return;
    }
    if (event === "manse_ready") {
      setProgress(payload.progress || 20);
      if (message) message.textContent = "만세력 계산을 마쳤습니다. 리포트 구성을 설계합니다...";
      return;
    }
    if (event === "plan_started") {
      setProgress(payload.progress || 25);
      if (message) message.textContent = "이 사주에 맞는 리포트 구성을 만들고 있습니다...";
      return;
    }
    if (event === "heartbeat") {
      if (message && payload.stage === "plan_started") message.textContent = "리포트 구성을 검증하고 있습니다...";
      return;
    }
    if (event === "plan_ready") {
      const data = payload.data;
      setProgress(payload.progress || 40);
      if (message) message.textContent = `구성을 마쳤습니다. ${payload.total || data.sections.length}개 해설을 동시에 작성합니다...`;
      analysisDraft = createAnalysisDraft({
        productId,
        product,
        profile,
        partner,
        orderId: meta.orderId,
        paymentStatus: meta.paymentStatus,
        data,
      });
      saveAnalysisDraft(analysisDraft, { reportStatus: "generating" });
      renderAnalysisResult(productId, profile, partner, data);
      return;
    }
    if (event === "section_ready") {
      if (!analysisDraft || !payload.section) return;
      const { id, body } = payload.section;
      fillSectionBody(id, body || "");
      analysisDraft = window.ReportRecovery.mergeSection(analysisDraft, id, body || "");
      saveAnalysisDraft(analysisDraft, { reportStatus: "generating" });
      setProgress(window.AnalysisStream.progressForSections(payload.completed, payload.total));
      if (message) message.textContent = `해설 ${payload.completed}/${payload.total}개를 완성해 보관함에 저장했습니다.`;
      return;
    }
    if (event === "error") {
      throw new Error(payload.message || "분석 처리 중 오류가 발생했습니다.");
    }
    if (event === "complete") {
      if (!analysisDraft) throw new Error("리포트 설계 결과를 받지 못했습니다.");
      streamCompleted = true;
      analysisDraft = window.ReportRecovery.finish(analysisDraft);
      saveAnalysisDraft(analysisDraft, { reportStatus: "complete", reportError: null });
      finishLoading();
      completeAnalysisLoading();
      complete();
      paymentReturn = false;
    }
  };

  // plan 요청과 section 요청을 함수별로 분리한다. 한 Vercel 함수가 전체 리포트를
  // 끝까지 기다리지 않아 공급자 지연이 전체 타임아웃으로 번지지 않는다.
  const analysisController = new AbortController();
  activeAnalysisTimer = window.setTimeout(() => analysisController.abort(), 30000);
  window.SajuApi.fetch("/api/saju/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: analysisController.signal,
    body: JSON.stringify({
      productId,
      profile,
      partner,
      orderId: meta.orderId || null,
      visitorId: visitorId(),
      targetYear: meta.targetYear || null,
      calendarPick: meta.calendarPick || null,
      stream: false,
    }),
  })
    .then(async (response) => {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        await window.AnalysisStream.consume(response, handleStreamEvent);
        if (!streamCompleted) throw new Error("분석 연결이 완료 전에 종료되었습니다. 결제내역에서 다시 시도해주세요.");
        return null;
      }
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`분석 서버 요청에 실패했습니다. (${response.status || 500})`);
      }
      if (!response.ok) throw new Error(data.message || data.error || "분석 요청에 실패했습니다.");
      return data;
    })
    .then(async (data) => {
      if (!data) return;
      finishLoading();
      setProgress(40);

      // ── 2단계(plan): 제목·개운 먼저 그리고, 본문은 섹션별 병렬 호출로 채운다(점진적 UX) ──
      if (data.mode === "plan" && Array.isArray(data.sections)) {
        analysisDraft = createAnalysisDraft({
          productId,
          product,
          profile,
          partner,
          orderId: meta.orderId,
          paymentStatus: meta.paymentStatus,
          data,
        });
        saveAnalysisDraft(analysisDraft, { reportStatus: "generating" });
        renderAnalysisResult(productId, profile, partner, data); // 제목 placeholder 표시

        const allTitles = data.sections.map((s) => s.title);
        const sections = analysisDraft.analysis.sections.map((s) => ({ ...s }));
        const batches = window.AnalysisBatching.chunkSections(sections);
        let sectionFailures = 0;
        let sectionsCompleted = 0;
        const markSectionCompleted = () => {
          sectionsCompleted += 1;
          setProgress(window.AnalysisStream.progressForSections(sectionsCompleted, sections.length));
          if (message) message.textContent = `해설 ${sectionsCompleted}/${sections.length}개를 완성해 보관함에 저장했습니다.`;
        };
        const requestSingleSection = (s) =>
          getJson("/api/saju/section", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, profile, partner, context: data.context, section: s, otherTitles: allTitles }),
          }, SECTION_RETRY_TIMEOUT_MS)
            .then((r) => {
              s.body = r.body || "";
              fillSectionBody(s.id, s.body);
              analysisDraft = window.ReportRecovery.mergeSection(analysisDraft, s.id, s.body);
              saveAnalysisDraft(analysisDraft, { reportStatus: "generating" });
              markSectionCompleted();
            })
            .catch((error) => {
              sectionFailures += 1;
              fillSectionFailed(s.id, error.message);
              analysisDraft = window.ReportRecovery.markSectionFailed(analysisDraft, s.id, error.message);
              analysisDraft = window.ReportRecovery.finish(analysisDraft, "failed", error.message);
              saveAnalysisDraft(analysisDraft, { reportStatus: "failed", reportError: error.message });
              markSectionCompleted();
            });

        await Promise.all(
          batches.map(async (batch) => {
            try {
              const result = await getJson("/api/saju/section", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, profile, partner, context: data.context, sections: batch, otherTitles: allTitles }),
              }, 45000);
              const bodies = new Map((result.sections || []).map((item) => [item.id, item.body]));
              for (const section of batch) {
                const body = bodies.get(section.id);
                if (!body) throw new Error(`섹션 응답 누락: ${section.id}`);
                section.body = body;
                fillSectionBody(section.id, body);
                analysisDraft = window.ReportRecovery.mergeSection(analysisDraft, section.id, body);
                saveAnalysisDraft(analysisDraft, { reportStatus: "generating" });
                markSectionCompleted();
              }
            } catch {
              await Promise.all(batch.map((s) => requestSingleSection(s)));
            }
          }),
        );

        if (sectionFailures > 0) {
          analysisDraft = window.ReportRecovery.finish(analysisDraft, "failed", "일부 리포트 생성이 완료되지 않았습니다.");
          saveAnalysisDraft(analysisDraft, { reportStatus: "failed", reportError: analysisDraft.generationError });
          completeAnalysisLoading("리포트 작성을 마쳤습니다. 실패한 해설은 다시 생성할 수 있습니다.");
        } else {
          analysisDraft = window.ReportRecovery.finish(analysisDraft);
          saveAnalysisDraft(analysisDraft, { reportStatus: "complete", reportError: null });
          completeAnalysisLoading();
          complete();
        }
        paymentReturn = false;
        return;
      }

      // ── 기존 1샷(궁합·대운 등 / 폴백): 섹션에 body 포함 ──
      renderAnalysisResult(productId, profile, partner, data);
      analysisDraft = createAnalysisDraft({
        productId,
        product,
        profile,
        partner,
        orderId: meta.orderId,
        paymentStatus: meta.paymentStatus,
        data,
      });
      analysisDraft = window.ReportRecovery.finish(analysisDraft);
      saveAnalysisDraft(analysisDraft, { reportStatus: "complete", reportError: null });
      completeAnalysisLoading();
      complete();
      paymentReturn = false;
    })
    .catch((error) => {
      if (error?.name === "AbortError") error = new Error("분석 시간이 초과되었습니다. 결제내역에서 다시 시도할 수 있습니다.");
      finishLoading();
      if (progressLabel) progressLabel.textContent = "오류";
      if (message) message.textContent = `분석을 불러오지 못했어요: ${error.message}`;
      if (analysisDraft) {
        analysisDraft = window.ReportRecovery.finish(analysisDraft, "failed", error.message);
        saveAnalysisDraft(analysisDraft, { reportStatus: "failed", reportError: error.message });
      } else if (meta.orderId) {
        upsertOrder({ orderId: meta.orderId, reportStatus: "failed", reportError: error.message });
      }
      trackEvent("analysis_error", { productId, message: error.message });
    });
}

// ---------- Archive ----------
function renderArchive() {
  if (!archiveList) return;
  const archive = pruneArchiveRetention(); // 1개월 지난 분석은 제거하고 남은 것만
  if (!archive.length && accountLoading()) {
    archiveList.innerHTML = `<div class="empty-box is-loading"><span class="inline-spinner"></span>보관함을 불러오는 중…</div>`;
    return;
  }
  const filtered = libraryFilter === "all" ? archive : archive.filter((item) => item.productId === libraryFilter);
  if (!filtered.length) {
    const emptyMsg = archive.length
      ? "선택한 분류의 결과가 없습니다."
      : "아직 보관된 분석 결과가 없습니다.";
    const ctaBtn = archive.length
      ? ""
      : `<button class="primary-action" style="margin-top:16px" onclick="showView('home')">첫 사주 분석 받으러 가기</button>`;
    archiveList.innerHTML = `<div class="empty-box">${emptyMsg}${ctaBtn}</div>`;
    return;
  }
  archiveList.innerHTML = filtered
    .map(
      (item) => `
        <button type="button" class="archive-card" data-archive-id="${escapeHtml(item.id)}">
          <header>
            <span class="archive-product">${escapeHtml(item.productName)}</span>
            <span class="archive-status">${escapeHtml(item.generationStatus === "failed" ? "일부 생성 실패 · 재시도 가능" : item.generationStatus === "generating" ? "생성 중" : item.paymentStatus || "결제 완료")}</span>
          </header>
          <b>${escapeHtml(item.profileName)}님</b>
          <small>${shortDate(item.createdAt)}</small>
        </button>
      `,
    )
    .join("");

  archiveList.querySelectorAll("[data-archive-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = getArchive().find((entry) => entry.id === button.dataset.archiveId);
      if (!item) return;
      openStoredAnalysis(item);
      trackEvent("archive_reopen", { archiveId: item.id, productId: item.productId });
    });
  });
}

// ---------- Payment result ----------
function setPaymentResult(title, message, detail, ok = false, icon) {
  const view = document.querySelector('[data-view="payment"]');
  const loading = icon === "loading";
  if (paymentIcon) {
    paymentIcon.innerHTML = loading
      ? '<span class="payment-spinner" aria-hidden="true"></span>'
      : escapeHtml(icon || (ok ? "✅" : "⚠️"));
  }
  if (paymentTitle) paymentTitle.textContent = title;
  if (paymentMessage) paymentMessage.textContent = message;
  if (paymentDetail) {
    if (Array.isArray(detail) && detail.length) {
      paymentDetail.innerHTML =
        `<div class="payment-receipt">` +
        detail
          .map(
            ([k, v]) =>
              `<div class="receipt-row${/금액/.test(k) ? " is-amount" : ""}"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`,
          )
          .join("") +
        `</div>`;
    } else if (typeof detail === "string" && detail) {
      paymentDetail.innerHTML = `<p class="payment-note">${escapeHtml(detail)}</p>`;
    } else {
      paymentDetail.innerHTML = "";
    }
  }
  if (paymentRef) {
    paymentRef.hidden = true;
    paymentRef.textContent = "";
  }
  view?.classList.toggle("is-success", ok);
  view?.classList.toggle("is-loading", loading);
  if (paymentContinueButton) {
    paymentContinueButton.hidden = true;
    paymentContinueButton.textContent = "결제 확인됨, 분석 시작";
    paymentContinueButton.onclick = null;
  }
  showView("payment");
}

// 주문번호를 짧고 덜 위협적으로 (예: saju_ff8d…507a) — 문의 시 참고용
function shortOrderId(orderId) {
  const id = String(orderId || "");
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

async function confirmReturnedPayment() {
  const url = new URL(location.href);
  if (url.pathname === "/payments/fail") {
    const pending = getPendingPurchase();
    if (pending) {
      upsertOrder({
        orderId: pending.orderId,
        productId: pending.productId,
        productName: pending.product?.name,
        profileName: pending.profile?.name,
        amount: pending.amount,
        status: "결제 실패",
      });
      clearPendingPurchase();
    }
    trackEvent("payment_fail", {
      orderId: pending?.orderId,
      productId: pending?.productId,
      message: url.searchParams.get("message") || "payment failed",
    });
    setPaymentResult(
      "결제가 완료되지 않았습니다",
      url.searchParams.get("message") || "다시 시도해주세요.",
      "상품 선택 화면에서 다시 결제할 수 있습니다.",
    );
    history.replaceState(null, "", "/");
    return;
  }

  if (url.pathname !== "/payments/success") return;

  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amount = url.searchParams.get("amount");
  const pending = getPendingPurchase();

  try {
    setPaymentResult("결제 확인 중", "토스 결제 승인 결과를 확인하고 있어요.", "", false, "loading");
    const result = await getJson("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    trackEvent("payment_success", { orderId, amount: Number(amount), productId: pending?.productId });
    history.replaceState(null, "", "/"); // 주소창을 즉시 홈으로 정리(새로고침/로고 클릭 시 갇힘 방지)

    upsertOrder({
      orderId,
      productId: pending?.productId,
      productName: pending?.product?.name || result.orderName,
      profileName: pending?.profile?.name || "-",
      amount: Number(pending?.price ?? amount),
      pointsUsed: Number(pending?.pointsUsed || result.pointsUsed || 0),
      status: "결제 완료",
      paymentKey: result.paymentKey,
      customer: runtimeSession?.user?.nickname || "비회원",
      approvedAt: Date.now(),
    });

    if (pending?.productId === "point-charge") {
      if (runtimeSession?.points && Number.isFinite(Number(result.pointBalance))) {
        runtimeSession.points.balance = Number(result.pointBalance);
      }
      clearPendingPurchase();
      await refreshPoints();
      setPaymentResult(
        "포인트 충전 완료!",
        `${formatPoints(result.pointsAdded || 0)}가 적립되었습니다.`,
        [
          ["충전 원금", formatWon(amount)],
          ["적립 포인트", formatPoints(result.pointsAdded || 0)],
          ["현재 잔액", formatPoints(runtimeSession?.points?.balance || result.pointBalance || 0)],
        ],
        true,
        "🪙",
      );
      if (paymentRef) {
        paymentRef.hidden = false;
        paymentRef.textContent = `주문번호 ${shortOrderId(orderId)} · 문의 시 알려주세요`;
      }
      return;
    }

    if (Number(pending?.pointsUsed || result.pointsUsed || 0) > 0) await refreshPoints();

    // 추가 질문 상담: 결제 완료 후 저장된 만세력으로 답변 생성 → 추가 질문 화면으로
    if (pending?.productId === "followup") {
      if (paymentRef) {
        paymentRef.hidden = false;
        paymentRef.textContent = `주문번호 ${shortOrderId(orderId)} · 문의 시 알려주세요`;
      }
      await runFollowupAnswer({ ...pending, orderId });
      return;
    }

    if (isChatCreditProductId(pending?.productId)) {
      await completeChatCreditPurchase({ purchase: pending, orderId, fulfillment: result.fulfillment });
      return;
    }

    if (isExternalReportProductId(pending?.productId)) {
      completeExternalReportPurchase({ purchase: pending, orderId, fulfillment: result.fulfillment });
      return;
    }

    setPaymentResult(
      "결제 완료! 🎉",
      "잠시 후 분석이 자동으로 시작됩니다.",
      [
        ["상품", pending?.product?.name || "선택 상품"],
        ["대상", pending?.profile?.name || "프로필"],
        ["토스 결제", formatWon(amount)],
        ...(Number(pending?.pointsUsed || 0) > 0 ? [["사용 포인트", formatPoints(pending.pointsUsed)]] : []),
      ],
      true,
      "🎉",
    );
    if (paymentRef) {
      paymentRef.hidden = false;
      paymentRef.textContent = `주문번호 ${shortOrderId(orderId)} · 문의 시 알려주세요`;
    }

    if (pending && paymentContinueButton) {
      // 결제했는데 결과를 못 받는 일이 없도록 자동으로 분석 시작. 버튼은 수동 진행/재시도용.
      const startNow = () => {
        const purchase = getPendingPurchase();
        if (!purchase) return; // 이미 시작됨 → 중복 분석 방지
        clearPendingPurchase();
        history.replaceState(null, "", "/");
        startAnalysis(purchase.productId, purchase.profile, {
          orderId,
          paymentStatus: "결제 완료",
          partner: purchase.partner || null,
          targetYear: purchase.targetYear || null,
          calendarPick: purchase.calendarPick || null,
          paymentReturn: true,
        });
      };
      paymentContinueButton.hidden = false;
      paymentContinueButton.onclick = startNow;
      setTimeout(startNow, 1200); // 결제완료 화면 잠깐 보여준 뒤 자동 시작
    }
  } catch (error) {
    trackEvent("payment_confirm_error", {
      orderId,
      amount: Number(amount),
      message: error.message,
      productId: pending?.productId,
    });
    upsertOrder({
      orderId,
      productName: pending?.product?.name || "선택 상품",
      profileName: pending?.profile?.name || "-",
      amount: Number(amount),
      status: "승인 오류",
    });
    history.replaceState(null, "", "/"); // 실패해도 주소창은 홈으로(새로고침 시 재확인 루프 방지)
    setPaymentResult(
      "결제 확인에 실패했습니다",
      error.message,
      "결제는 완료되었는데 화면이 멈췄다면 고객센터에 주문번호를 남겨주세요.",
    );
  }
}

// ---------- 택일 calendar ----------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function renderCalendar() {
  const titleEl = document.querySelector("[data-calendar-title]");
  const gridEl = document.querySelector("[data-calendar-grid]");
  if (!gridEl) return;
  const { year, month, picked } = calendarState;
  if (titleEl) titleEl.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0(Sun) ~ 6(Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  let html =
    "<span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>";

  // Leading muted days (previous month)
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    html += `<button type="button" class="muted" disabled>${day}</button>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toISODate(year, month, day);
    const classes = [];
    if (iso === todayISO) classes.push("today");
    const dateObj = new Date(year, month, day);
    if (dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate())) classes.push("muted");
    if (picked.has(iso)) classes.push("picked");
    html += `<button type="button" class="${classes.join(" ")}" data-calendar-day="${iso}">${day}</button>`;
  }

  // Trailing muted to round out 7 columns
  const totalCells = startWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i += 1) {
    html += `<button type="button" class="muted" disabled>${i}</button>`;
  }
  gridEl.innerHTML = html;

  gridEl.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const iso = button.dataset.calendarDay;
      if (calendarState.picked.has(iso)) {
        calendarState.picked.delete(iso);
      } else {
        if (calendarState.picked.size >= 10) {
          const status = document.querySelector("[data-calendar-status]");
          if (status) status.textContent = "최대 10일까지만 선택할 수 있어요.";
          return;
        }
        calendarState.picked.add(iso);
      }
      const status = document.querySelector("[data-calendar-status]");
      if (status) status.textContent = "";
      renderCalendar();
    });
  });
}

function bindCalendar() {
  document.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
    calendarState.month -= 1;
    if (calendarState.month < 0) {
      calendarState.month = 11;
      calendarState.year -= 1;
    }
    renderCalendar();
  });
  document.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
    calendarState.month += 1;
    if (calendarState.month > 11) {
      calendarState.month = 0;
      calendarState.year += 1;
    }
    renderCalendar();
  });
  document.querySelector("[data-purpose-row]")?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-purpose-row] button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      calendarState.purpose = button.dataset.purpose || button.textContent.trim();
    });
  });
  document.querySelector("[data-calendar-confirm]")?.addEventListener("click", () => {
    const status = document.querySelector("[data-calendar-status]");
    if (calendarState.picked.size < 2) {
      if (status) status.textContent = "최소 2일 이상 후보 날짜를 선택해주세요.";
      return;
    }
    if (calendarState.picked.size > 10) {
      if (status) status.textContent = "최대 10일까지만 선택할 수 있어요.";
      return;
    }
    if (status) status.textContent = "";
    sessionStorage.setItem(
      "saju_lab_calendar_pick",
      JSON.stringify({ purpose: calendarState.purpose, dates: [...calendarState.picked].sort() }),
    );
    openMemberModal("auspicious-date");
  });
}

// ---------- Fortune mood chips ----------
function bindFortuneMood() {
  const group = document.querySelector("[data-fortune-mood]");
  if (!group) return;
  const custom = document.querySelector("[data-fortune-mood-custom]");
  const customInput = document.querySelector("[data-fortune-mood-input]");
  const status = document.querySelector("[data-fortune-status]");
  // Restore last selected mood
  const saved = sessionStorage.getItem(FORTUNE_MOOD_KEY);
  const savedCustom = sessionStorage.getItem(FORTUNE_MOOD_CUSTOM_KEY) || "";
  if (customInput) customInput.value = savedCustom;
  if (saved) {
    group.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.mood === saved);
    });
    if (custom) custom.hidden = saved !== "직접 입력";
  }
  group.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      group.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      const mood = button.dataset.mood || button.textContent.trim();
      sessionStorage.setItem(FORTUNE_MOOD_KEY, mood);
      if (custom) custom.hidden = mood !== "직접 입력";
      if (mood === "직접 입력") customInput?.focus();
      if (status) status.textContent = "";
    });
  });
  customInput?.addEventListener("input", () => {
    sessionStorage.setItem(FORTUNE_MOOD_CUSTOM_KEY, customInput.value.trim().slice(0, 80));
    if (status) status.textContent = "";
  });
  document.querySelector("[data-fortune-start]")?.addEventListener("click", () => {
    const profileId = document.querySelector('[data-view="fortune"] [data-profile-select]')?.value;
    const profile = getProfiles().find((item) => item.id === profileId);
    const mood = fortuneMoodValue();
    if (!profile) {
      if (status) status.textContent = "오늘 운세를 볼 프로필을 먼저 추가해주세요.";
      return;
    }
    if (!mood) {
      if (status) status.textContent = "지금 가장 가까운 마음을 선택하거나 직접 입력해주세요.";
      customInput?.focus();
      return;
    }
    startDailyFortune(profile, { mood });
  });
}

function fortuneMoodValue() {
  const active = document.querySelector("[data-fortune-mood] .is-active");
  const mood = active?.dataset.mood || "";
  if (mood === "직접 입력") {
    return String(document.querySelector("[data-fortune-mood-input]")?.value || "").trim().slice(0, 80);
  }
  return mood;
}

// ---------- 추가 질문 상담(결제형) ----------
// 보관함에서 구매한 분석을 고르고, 질문 1회권(990원)을 결제하면, 그 분석의 만세력을
// 그대로 재사용해(만세력 재계산·포인트 차감 없이) AI가 답변한다. Q&A는 그 분석에 저장된다.
let followupSelectedId = null;

// 만세력이 저장돼 추가 질문이 가능한 분석만(오늘의 무료운세 등 manse 없는 항목 제외)
function followupArchive() {
  return getArchive().filter((a) => a?.analysis && (a.analysis.manse || a.analysis.summary));
}

// AI 답변을 문단 단위로 렌더(빈 줄=문단 구분, 단일 줄바꿈=줄바꿈). 단어 중간 잘림은 CSS(keep-all)로 방지.
function formatAnswer(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function renderFollowup() {
  const box = document.querySelector("[data-followup-body]");
  if (!box) return;
  const items = followupArchive();
  // 로컬에 분석이 있으면 즉시 표시. 로컬이 비고 서버 동기화 대기 중일 때만 스피너.
  if (!items.length && accountLoading()) {
    box.innerHTML = `<div class="empty-box is-loading"><span class="inline-spinner"></span>보관함을 불러오는 중…</div>`;
    return;
  }
  if (!items.length) {
    box.innerHTML = `<div class="empty-box">아직 추가 질문할 분석이 없어요.<br />먼저 사주 분석을 받으면, 그 사주로 더 깊은 질문을 이어갈 수 있어요.
      <button class="primary-action" style="margin-top:16px" onclick="showView('home')">분석 받으러 가기</button></div>`;
    return;
  }
  if (!followupSelectedId || !items.find((a) => a.id === followupSelectedId)) {
    followupSelectedId = items[0].id;
  }
  const sel = items.find((a) => a.id === followupSelectedId);
  const options = items
    .map(
      (a) =>
        `<option value="${escapeHtml(a.id)}"${a.id === followupSelectedId ? " selected" : ""}>${escapeHtml(a.productName)} · ${escapeHtml(a.profileName)} (${escapeHtml(shortDate(a.createdAt))})</option>`,
    )
    .join("");
  const followups = sel.analysis?.followups || [];
  const history = followups
    .map(
      (f) => `
      <article class="qa-item">
        <p class="qa-q"><b>Q</b> ${escapeHtml(f.question)}</p>
        <div class="qa-a">${formatAnswer(f.answer)}</div>
        <small class="qa-date">${escapeHtml(shortDate(f.at))}</small>
      </article>`,
    )
    .join("");

  box.innerHTML = `
    <label class="followup-label" for="followup-select">질문할 분석 선택</label>
    <select id="followup-select" class="followup-select" data-followup-select>${options}</select>
    <div class="followup-ask">
      <label class="followup-label" for="followup-input">${escapeHtml(sel.profileName)}님께 더 궁금한 점 (질문 1개)</label>
      <textarea id="followup-input" class="followup-input" data-followup-input rows="3" maxlength="500" placeholder="예) 올해 이직해도 괜찮을까요?  지금 만나는 사람과는 잘 맞을까요?"></textarea>
      <button class="primary-action" type="button" data-followup-pay>질문 1회권 · 990원 결제하고 물어보기</button>
    </div>
    ${followups.length ? `<div class="followup-history"><h3>이 분석에서 나눈 질문 ${followups.length}개</h3>${history}</div>` : ""}`;

  box.querySelector("[data-followup-select]")?.addEventListener("change", (e) => {
    followupSelectedId = e.target.value;
    renderFollowup();
  });
  box.querySelector("[data-followup-pay]")?.addEventListener("click", () => startFollowupCheckout(sel));
}

// 보관함/분석결과 화면에서 "추가 질문" 진입(특정 분석 선택 상태로)
function openFollowup(archiveId) {
  if (archiveId) followupSelectedId = archiveId;
  showView("followup");
}

// 질문 입력 → 질문 1회권 결제 페이지로(결제 후 답변 생성)
function startFollowupCheckout(item) {
  const input = document.querySelector("[data-followup-input]");
  const question = (input?.value || "").trim();
  if (!question) {
    showToast("질문을 입력해주세요.");
    input?.focus();
    return;
  }
  const product = PRODUCTS.followup;
  if (!productPriceLoaded(product)) {
    showToast("상품 가격 정보를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", true);
    return;
  }
  const profile =
    getProfiles().find((p) => p.id === item.profileId) || { id: item.profileId || "followup", name: item.profileName };
  currentCheckout = {
    productId: "followup",
    product,
    profile,
    partner: null,
    question,
    analysisId: item.id,
    manse: item.analysis?.manse || null,
    summary: item.analysis?.summary || null,
  };
  showView("pay");
  setupPayView(product);
}

// 결제 완료 후: 저장된 만세력으로 답변 생성 → 그 분석에 Q&A 저장 → 화면 표시
async function runFollowupAnswer(pending) {
  showView("followup");
  const box = document.querySelector("[data-followup-body]");
  if (box) {
    box.innerHTML = `<div class="empty-box is-loading"><span class="inline-spinner"></span>${escapeHtml(pending.profile?.name || "고객")}님의 사주로 답변을 쓰는 중…</div>`;
  }
  try {
    const item = getArchive().find((a) => a.id === pending.analysisId);
    const manse = pending.manse || item?.analysis?.manse || null;
    const summary = pending.summary || item?.analysis?.summary || null;
    const qaHistory = (item?.analysis?.followups || []).map((f) => ({ question: f.question, answer: f.answer }));
    const res = await getJson("/api/saju/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "followup", profile: pending.profile, manse, summary, question: pending.question, history: qaHistory }),
    });
    const entry = { question: pending.question, answer: res.answer, at: Date.now(), orderId: pending.orderId };
    clearPendingPurchase();
    if (item) {
      updateArchiveItem(item.id, (a) => ({
        ...a,
        analysis: { ...a.analysis, followups: [...(a.analysis?.followups || []), entry] },
      }));
      followupSelectedId = item.id;
      renderFollowup();
    } else if (box) {
      // 보관함 항목을 못 찾는 드문 경우: 답변만 바로 표시
      box.innerHTML = `<article class="qa-item"><p class="qa-q"><b>Q</b> ${escapeHtml(entry.question)}</p><div class="qa-a">${formatAnswer(entry.answer)}</div></article>`;
    }
    showToast("답변이 도착했어요.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    clearPendingPurchase();
    if (box) {
      box.innerHTML = `<div class="empty-box">답변 생성 중 문제가 생겼어요: ${escapeHtml(e.message)}<br />결제는 완료되었으니, 주문번호와 함께 문의해 주시면 도와드릴게요.</div>`;
    }
  }
}

function bindFollowup() {
  // 진입 시 렌더는 showView("followup")에서 처리. 여기선 별도 바인딩 없음(이벤트는 renderFollowup에서).
}

// ---------- AI 챗봇 상담(질의응답권형) ----------
function isChatCreditProductId(productId) {
  return /^chat-qa-(1|3|5|10)$/.test(String(productId || ""));
}

function stopChatStream() {
  chatState.stream?.close?.();
  chatState.stream = null;
  chatState.streamRunId = null;
}

function resetChatState() {
  stopChatStream();
  closeChatReportPreview({ immediate: true, restoreFocus: false });
  chatState = {
    catalog: null,
    sessions: [],
    activeSessionId: null,
    detail: null,
    stream: null,
    streamRunId: null,
    requestVersion: Number(chatState?.requestVersion || 0) + 1,
  };
}

function setChatStatus(message, error = false) {
  const node = document.querySelector("[data-chat-status]");
  if (!node) return;
  node.textContent = message || "";
  node.classList.toggle("is-error", Boolean(error));
}

function chatRunStatusLabel(status) {
  return status === "queued"
    ? "답변 준비 중"
    : status === "running"
      ? "답변 작성 중"
      : status === "failed"
        ? "답변 실패 · 질문권 환원"
        : status === "completed"
          ? "답변 완료"
          : "";
}

function renderChatAssistantContent(content) {
  if (window.ChatMarkdown?.render) return window.ChatMarkdown.render(content || "");
  return escapeHtml(content || "").replace(/\n/g, "<br />");
}

function renderChatReportPreview() {
  const report = chatState.detail?.report;
  const preview = window.ChatReportPreview?.normalizeReport?.(report || {});
  const title = document.querySelector("[data-chat-report-preview-title]");
  const meta = document.querySelector("[data-chat-report-preview-meta]");
  const body = document.querySelector("[data-chat-report-preview-body]");
  if (title) title.textContent = preview?.productName || "리포트 내용보기";
  if (meta) meta.textContent = preview?.profileName ? `${preview.profileName}님의 리포트` : "선택한 상담 리포트";
  if (body) {
    body.innerHTML = window.ChatReportPreview?.render?.(report || {})
      || '<p class="chat-report-preview-empty">저장된 리포트 내용을 불러오지 못했습니다.</p>';
    body.scrollTop = 0;
  }
}

function openChatReportPreview() {
  const overlay = document.querySelector("[data-chat-report-preview]");
  if (!overlay || !chatState.detail?.report) return;
  if (chatReportPreviewHideTimer) window.clearTimeout(chatReportPreviewHideTimer);
  renderChatReportPreview();
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    overlay.querySelector(".chat-report-preview-close")?.focus();
  });
}

function closeChatReportPreview({ immediate = false, restoreFocus = true } = {}) {
  const overlay = document.querySelector("[data-chat-report-preview]");
  if (!overlay) return;
  if (chatReportPreviewHideTimer) window.clearTimeout(chatReportPreviewHideTimer);
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  const finish = () => {
    if (!overlay.classList.contains("is-open")) overlay.hidden = true;
    chatReportPreviewHideTimer = null;
  };
  if (immediate) finish();
  else chatReportPreviewHideTimer = window.setTimeout(finish, 300);
  if (restoreFocus && !immediate) document.querySelector("[data-chat-report-preview-open]")?.focus();
}

function activeChatRun() {
  const runs = chatState.detail?.runs || [];
  return [...runs].reverse().find((run) => run.status === "queued" || run.status === "running") || null;
}

function buildClientChatTurns(detail = chatState.detail) {
  const messages = detail?.messages || [];
  const runs = detail?.runs || [];
  const byId = new Map(messages.map((message) => [message.id, message]));
  const turns = runs.map((run) => ({
    id: run.id,
    run,
    user: byId.get(run.userMessageId) || null,
    assistant: byId.get(run.assistantMessageId) || null,
  }));
  const linked = new Set(turns.flatMap((turn) => [turn.user?.id, turn.assistant?.id]).filter(Boolean));
  const localMessages = messages.filter((message) => !linked.has(message.id) && String(message.id || "").startsWith("local-"));
  for (let index = 0; index < localMessages.length; index += 2) {
    turns.push({
      id: localMessages[index]?.clientRequestId || `local-turn-${index}`,
      run: null,
      user: localMessages[index] || null,
      assistant: localMessages[index + 1] || null,
    });
  }
  return turns;
}

function renderChatState() {
  const loggedIn = Boolean(runtimeSession?.user?.id);
  const login = document.querySelector("[data-chat-login]");
  const workspace = document.querySelector("[data-chat-workspace]");
  if (login) login.hidden = loggedIn;
  if (workspace) workspace.hidden = !loggedIn;
  if (!loggedIn) return;

  const view = document.querySelector('[data-view="chat"]');
  const roomOpen = Boolean(chatState.detail?.session);
  view?.classList.toggle("is-room-open", roomOpen);
  const previewButton = document.querySelector("[data-chat-report-preview-open]");
  if (previewButton) {
    previewButton.hidden = !roomOpen || !chatState.detail?.report;
    previewButton.disabled = !roomOpen || !chatState.detail?.report;
  }
  const lobby = document.querySelector("[data-chat-lobby]");
  if (lobby) lobby.hidden = roomOpen;

  const balance = Number(chatState.catalog?.balance ?? chatState.detail?.balance ?? 0);
  document.querySelectorAll("[data-chat-balance]").forEach((node) => {
    node.textContent = `${balance.toLocaleString("ko-KR")}건`;
  });
  const composerBalance = document.querySelector("[data-chat-composer-balance]");
  if (composerBalance) composerBalance.textContent = `남은 질문 ${balance.toLocaleString("ko-KR")}건`;

  const productsHost = document.querySelector("[data-chat-products]");
  if (productsHost) {
    const products = chatState.catalog?.products || [];
    productsHost.innerHTML = products.length
      ? products.map((product) => {
          const discounted = Number(product.discountRate || 0) > 0;
          return `
            <button class="chat-credit-product" type="button" data-chat-buy="${escapeHtml(product.id)}">
              <b>${escapeHtml(product.name)}</b>
              <span>${escapeHtml(formatWon(product.amount))}</span>
              ${discounted ? `<del>${escapeHtml(formatWon(product.regularAmount))}</del><small>${escapeHtml(product.discountRate)}% 할인</small>` : `<small>건당 500원</small>`}
            </button>`;
        }).join("")
      : `<div class="empty-box">구매 가능한 질의응답권을 불러오지 못했습니다.</div>`;
  }

  const reports = followupArchive();
  const reportSelect = document.querySelector("[data-chat-report-select]");
  const createButton = document.querySelector("[data-chat-session-create]");
  const reportHelp = document.querySelector("[data-chat-report-help]");
  if (reportSelect) {
    reportSelect.innerHTML = reports.length
      ? reports.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.productName)} · ${escapeHtml(item.profileName)} (${escapeHtml(shortDate(item.createdAt))})</option>`).join("")
      : `<option value="">상담 가능한 보관함 리포트가 없습니다</option>`;
  }
  if (createButton) createButton.disabled = !reports.length;
  if (reportHelp) {
    reportHelp.textContent = reports.length
      ? "보관함 리포트 하나마다 별도의 대화방이 만들어집니다."
      : "먼저 유료 사주 리포트를 생성해 보관함에 저장해주세요.";
  }

  const sessionsHost = document.querySelector("[data-chat-sessions]");
  if (sessionsHost) {
    sessionsHost.innerHTML = chatState.sessions.length
      ? chatState.sessions.map((session) => `
          <button type="button" class="${session.id === chatState.activeSessionId ? "is-active" : ""}" data-chat-session-id="${escapeHtml(session.id)}">
            ${escapeHtml(session.title)}${session.latestRun?.status === "running" || session.latestRun?.status === "queued" ? " · 답변 중" : ""}
          </button>`).join("")
      : "";
  }

  const conversation = document.querySelector("[data-chat-conversation]");
  if (!chatState.detail?.session) {
    if (conversation) conversation.hidden = true;
    return;
  }
  if (conversation) conversation.hidden = false;
  const title = document.querySelector("[data-chat-title]");
  if (title) title.textContent = chatState.detail.session.title || "AI 챗봇 상담";
  const reportContext = document.querySelector("[data-chat-report-context]");
  if (reportContext) {
    const report = chatState.detail.report || {};
    reportContext.textContent = [report.productName, report.profileName].filter(Boolean).join(" · ") || "선택한 보관함 리포트";
  }
  const running = activeChatRun();
  const status = document.querySelector("[data-chat-run-status]");
  if (status) status.textContent = chatRunStatusLabel(running?.status);

  const messagesHost = document.querySelector("[data-chat-messages]");
  if (messagesHost) {
    const turns = buildClientChatTurns();
    messagesHost.innerHTML = turns.length
      ? turns.map((turn) => {
          const user = turn.user;
          const assistant = turn.assistant;
          const failed = assistant?.status === "failed";
          const pending = assistant && (assistant.status === "queued" || assistant.status === "streaming");
          const answer = failed
            ? assistant.errorMessage || "답변 생성에 실패했습니다. 차감된 질문권은 자동으로 돌아옵니다."
            : assistant?.content || (pending ? "답변을 준비하고 있어요" : "");
          return `<article class="chat-turn" data-chat-turn="${escapeHtml(turn.id)}">
            ${user ? `<div class="chat-bubble is-user">${escapeHtml(user.content || "").replace(/\n/g, "<br />")}</div>` : ""}
            ${assistant ? `<div class="chat-bubble is-assistant${pending ? " is-pending" : ""}${failed ? " is-error" : ""}">${renderChatAssistantContent(answer)}</div>` : ""}
          </article>`;
        }).join("")
      : `<p class="chat-empty-message">이 리포트에 대해 궁금한 점을 물어보세요.<br />외부 정보 없이 선택한 리포트만 근거로 답합니다.</p>`;
    messagesHost.scrollTop = messagesHost.scrollHeight;
  }

  const input = document.querySelector("[data-chat-input]");
  const send = document.querySelector("[data-chat-send]");
  const blocked = Boolean(running) || balance < 1;
  if (input) input.disabled = Boolean(running);
  if (send) {
    send.disabled = blocked;
    send.textContent = running ? "답변 작성 중" : balance < 1 ? "질의응답권 구매 필요" : "질문 보내기";
  }
}

async function loadChatView(preferredSessionId = chatState.activeSessionId) {
  renderChatState();
  if (!runtimeSession?.user?.id) {
    setChatStatus("로그인하면 질의응답권 구매와 대화를 시작할 수 있습니다.");
    return;
  }
  const version = Number(chatState.requestVersion || 0) + 1;
  chatState.requestVersion = version;
  setChatStatus("챗봇 상담 정보를 불러오는 중...");
  try {
    const [catalog, sessionPayload] = await Promise.all([
      getJson("/api/chat/catalog"),
      getJson("/api/chat/sessions"),
    ]);
    if (version !== chatState.requestVersion) return;
    chatState.catalog = catalog;
    chatState.sessions = sessionPayload.sessions || [];
    const activeId = preferredSessionId && chatState.sessions.some((session) => session.id === preferredSessionId)
      ? preferredSessionId
      : null;
    chatState.activeSessionId = activeId;
    chatState.detail = activeId ? await getJson(`/api/chat/sessions/${encodeURIComponent(activeId)}`) : null;
    if (version !== chatState.requestVersion) return;
    if (chatState.detail && chatState.catalog) chatState.catalog.balance = Number(chatState.detail.balance || 0);
    renderChatState();
    setChatStatus("");
    resumeActiveChatStream();
  } catch (error) {
    if (version !== chatState.requestVersion) return;
    setChatStatus(error.message || "챗봇 상담 정보를 불러오지 못했습니다.", true);
    renderChatState();
  }
}

function closeChatRoom() {
  stopChatStream();
  closeChatReportPreview({ immediate: true, restoreFocus: false });
  chatState.activeSessionId = null;
  chatState.detail = null;
  renderChatState();
  setChatStatus("");
}

function updateChatStreamRecord(runId, record) {
  const detail = chatState.detail;
  if (!detail) return;
  const run = (detail.runs || []).find((item) => item.id === runId);
  if (!run) return;
  let message = (detail.messages || []).find((item) => item.id === run.assistantMessageId);
  if (!message) {
    message = { id: run.assistantMessageId, role: "assistant", content: "", status: "queued" };
    detail.messages.push(message);
  }
  if (record.event === "status") {
    run.status = record.data.status || "running";
    message.status = "streaming";
  } else if (record.event === "replace" || record.event === "delta") {
    message.content = record.data.content ?? `${message.content || ""}${record.data.delta || ""}`;
    message.status = record.data.status === "completed" ? "completed" : "streaming";
    run.status = record.data.status || "running";
  } else if (record.event === "complete") {
    message.content = record.data.content || message.content;
    message.status = "completed";
    run.status = "completed";
  } else if (record.event === "error") {
    message.status = "failed";
    message.errorMessage = record.data.message || "답변 생성에 실패했습니다.";
    run.status = "failed";
  }
  renderChatState();
  if (record.event === "complete" || record.event === "error") {
    stopChatStream();
    loadChatView(chatState.activeSessionId);
  }
}

function resumeActiveChatStream() {
  const run = activeChatRun();
  if (!run || chatState.streamRunId === run.id || !window.ChatStream) return;
  stopChatStream();
  chatState.streamRunId = run.id;
  chatState.stream = window.ChatStream.connect({
    runId: run.id,
    onEvent: (record) => updateChatStreamRecord(run.id, record),
    onDisconnect: () => setChatStatus("실시간 연결을 다시 시도하고 있습니다..."),
  });
}

async function createChatSession() {
  const archiveId = document.querySelector("[data-chat-report-select]")?.value;
  if (!archiveId) {
    setChatStatus("상담할 보관함 리포트를 먼저 선택해주세요.", true);
    return;
  }
  setChatStatus("선택한 리포트로 대화방을 만드는 중...");
  try {
    const payload = await getJson("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveId }),
    });
    await loadChatView(payload.session.id);
  } catch (error) {
    setChatStatus(error.message || "대화방을 만들지 못했습니다.", true);
  }
}

async function sendChatMessage() {
  const input = document.querySelector("[data-chat-input]");
  const question = String(input?.value || "").trim();
  if (!chatState.activeSessionId || !chatState.detail) return;
  if (Number(chatState.catalog?.balance || 0) < 1) {
    setChatStatus("질문을 보내려면 위에서 질의응답권을 먼저 구매해주세요.", true);
    return;
  }
  if (!question) {
    setChatStatus("질문 내용을 입력해주세요.", true);
    input?.focus();
    return;
  }
  const requestId = `chat-${crypto.randomUUID()}`;
  const optimisticUserId = `local-user-${requestId}`;
  const optimisticAssistantId = `local-assistant-${requestId}`;
  chatState.detail.messages.push(
    { id: optimisticUserId, role: "user", content: question, status: "completed", clientRequestId: requestId },
    { id: optimisticAssistantId, role: "assistant", content: "", status: "queued" },
  );
  if (input) input.value = "";
  renderChatState();
  setChatStatus("");
  try {
    const result = await getJson(`/api/chat/sessions/${encodeURIComponent(chatState.activeSessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientRequestId: requestId, question }),
    });
    const userMessage = chatState.detail.messages.find((message) => message.id === optimisticUserId);
    const assistantMessage = chatState.detail.messages.find((message) => message.id === optimisticAssistantId);
    if (userMessage) userMessage.id = result.userMessageId;
    if (assistantMessage) assistantMessage.id = result.assistantMessageId;
    chatState.detail.runs.push({
      id: result.runId,
      sessionId: chatState.activeSessionId,
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
      status: "queued",
      creditStatus: "reserved",
    });
    chatState.catalog.balance = Number(result.balance || 0);
    renderChatState();
    resumeActiveChatStream();
  } catch (error) {
    const assistantMessage = chatState.detail.messages.find((message) => message.id === optimisticAssistantId);
    if (assistantMessage) {
      assistantMessage.status = "failed";
      assistantMessage.errorMessage = error.message || "질문을 보내지 못했습니다. 다시 시도해주세요.";
    }
    setChatStatus(error.message || "질문을 보내지 못했습니다.", true);
    renderChatState();
  }
}

function startChatCreditCheckout(productId) {
  const row = (chatState.catalog?.products || []).find((product) => product.id === productId);
  if (!row) {
    setChatStatus("선택한 질의응답권 상품을 찾지 못했습니다.", true);
    return;
  }
  const product = {
    ...row,
    price: formatWon(row.amount),
    amountLabel: formatWon(row.amount),
    paid: true,
    planId: null,
    category: "AI 챗봇 상담",
    description: `${row.questions}개의 질문을 선택한 리포트 기반 AI 챗봇에서 사용할 수 있습니다.`,
  };
  currentCheckout = { productId: row.id, product, profile: null, partner: null, pointsUsed: 0 };
  showView("pay");
  setupPayView(product);
}

async function completeChatCreditPurchase({ purchase, orderId, fulfillment }) {
  clearPendingPurchase();
  const fulfilled = fulfillment?.status === "fulfilled";
  if (fulfilled && chatState.catalog) chatState.catalog.balance = Number(fulfillment.balance || 0);
  setPaymentResult(
    fulfilled ? "질의응답권 구매 완료!" : "결제 완료 · 질의응답권 적립 확인 중",
    fulfilled
      ? `${Number(fulfillment.creditsAdded || purchase.product?.questions || 0).toLocaleString("ko-KR")}건이 계정에 적립되었습니다.`
      : "결제는 완료됐지만 질문권 적립을 재확인하고 있습니다. 결제 내역은 안전하게 보관됩니다.",
    [
      ["상품", purchase.product?.name || "AI 챗봇 질의응답권"],
      ["결제 금액", formatWon(purchase.price ?? purchase.product?.amount ?? 0)],
      ["적립 상태", fulfilled ? "적립 완료" : "확인 중"],
    ],
    fulfilled,
    fulfilled ? "🤖" : "⏳",
  );
  if (paymentRef) {
    paymentRef.hidden = false;
    paymentRef.textContent = `주문번호 ${shortOrderId(orderId)} · 문의 시 알려주세요`;
  }
  if (paymentContinueButton) {
    paymentContinueButton.hidden = false;
    paymentContinueButton.textContent = "AI 챗봇 상담으로 이동";
    paymentContinueButton.onclick = () => showView("chat");
  }
}

function completeExternalReportPurchase({ purchase, orderId, fulfillment }) {
  clearPendingPurchase();
  const externalReport = fulfillment?.externalOrderId
    ? {
        provider: fulfillment.provider || "saju-web",
        externalOrderId: fulfillment.externalOrderId,
        shareToken: fulfillment.shareToken || "",
        shareUrl: fulfillment.shareUrl || "",
        status: fulfillment.externalStatus || fulfillment.status || "queued",
      }
    : null;
  upsertOrder({
    orderId,
    productId: purchase.productId,
    productName: purchase.product?.name,
    profileName: purchase.profile?.name || "-",
    amount: purchase.price ?? purchase.product?.amount ?? 0,
    pointsUsed: purchase.pointsUsed || 0,
    payMethod: purchase.payMethod,
    status: "결제 완료",
    reportStatus: fulfillment?.status === "submitted" ? "generating" : "failed",
    reportError: fulfillment?.status === "submitted" ? null : fulfillment?.error || "외부 리포트 주문 생성 확인이 필요합니다.",
    externalReport,
    updatedAt: Date.now(),
  });
  setPaymentResult(
    fulfillment?.status === "submitted" ? "결제 완료 · 리포트 생성 시작" : "결제 완료 · 리포트 생성 확인 필요",
    fulfillment?.status === "submitted"
      ? "외부 전문 서비스에서 심층 리포트 제작을 시작했습니다."
      : "결제는 완료됐지만 외부 리포트 주문 상태를 다시 확인해야 합니다.",
    [
      ["상품", purchase.product?.name || "운명 완전개봉"],
      ["대상", purchase.profile?.name || "프로필"],
      ["생성 상태", fulfillment?.status === "submitted" ? "외부 서비스 생성중" : "확인 필요"],
    ],
    fulfillment?.status === "submitted",
    fulfillment?.status === "submitted" ? "🔮" : "⏳",
  );
  if (paymentRef) {
    paymentRef.hidden = false;
    paymentRef.textContent = `주문번호 ${shortOrderId(orderId)} · 문의 시 알려주세요`;
  }
  if (paymentContinueButton) {
    paymentContinueButton.hidden = false;
    paymentContinueButton.textContent = "결제 내역으로 이동";
    paymentContinueButton.onclick = () => showView("orders");
  }
  if (fulfillment?.status === "submitted") scheduleExternalReportPolling(orderId);
  pushUserData("order", getOrders().find((order) => order.orderId === orderId));
}

function bindChat() {
  const view = document.querySelector('[data-view="chat"]');
  view?.addEventListener("click", (event) => {
    const buy = event.target.closest("[data-chat-buy]");
    if (buy) return startChatCreditCheckout(buy.dataset.chatBuy);
    if (event.target.closest("[data-chat-session-create]")) return createChatSession();
    if (event.target.closest("[data-chat-report-preview-open]")) return openChatReportPreview();
    if (event.target.closest("[data-chat-report-preview-close]")) return closeChatReportPreview();
    if (event.target.closest("[data-chat-room-back]")) return closeChatRoom();
    const sessionButton = event.target.closest("[data-chat-session-id]");
    if (sessionButton) loadChatView(sessionButton.dataset.chatSessionId);
  });
  document.querySelector("[data-chat-composer]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage();
  });
}

// ---------- Year / cycle interactions ----------
function selectedYearlyTarget() {
  const active = document.querySelector("[data-year-panel] button.is-active");
  const year = Number(active?.dataset.year);
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

function bindYearAndCycle() {
  // Year buttons toggle
  document.querySelector("[data-year-panel]")?.querySelectorAll("button").forEach((button, index) => {
    const year = new Date().getFullYear() + index;
    button.dataset.year = String(year);
    button.textContent = String(year);
    button.classList.toggle("is-active", index === 0);
  });
  document.querySelector("[data-year-panel]")?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-year-panel] button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
    });
  });
  // Cycle li toggle
  document.querySelector("[data-cycle-list]")?.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      document.querySelectorAll("[data-cycle-list] li").forEach((item) => item.classList.remove("is-active"));
      li.classList.add("is-active");
    });
  });
  document.querySelector("[data-year-checkout]")?.addEventListener("click", () => {
    openMemberModal("yearly-fortune");
  });
  document.querySelector("[data-cycle-checkout]")?.addEventListener("click", () => {
    openMemberModal("cycle");
  });
}

// ---------- Compatibility checkout ----------
function bindCompatibility() {
  document.querySelector('[data-view="compatibility"]')?.addEventListener("click", (event) => {
    const add = event.target.closest("[data-compat-add]");
    if (!add) return;
    profileReturnContext = { view: "compatibility", compatSlot: add.dataset.compatAdd };
    selectedProductId = "compatibility";
    showView("profile");
  });
  document.querySelector("[data-compat-checkout]")?.addEventListener("click", () => {
    const selectA = document.querySelector('[data-compat-select="a"]');
    const selectB = document.querySelector('[data-compat-select="b"]');
    const status = document.querySelector("[data-compat-status]");
    const profiles = getProfiles();
    const profileA = profiles.find((p) => p.id === selectA?.value);
    const profileB = profiles.find((p) => p.id === selectB?.value);
    if (!profileA || !profileB) {
      if (status) status.textContent = "두 분의 프로필을 모두 선택해주세요.";
      return;
    }
    if (profileA.id === profileB.id) {
      if (status) status.textContent = "서로 다른 두 분을 선택해주세요.";
      return;
    }
    if (status) status.textContent = "";
    const product = PRODUCTS.compatibility;
    currentCheckout = { productId: "compatibility", product, profile: profileA, partner: profileB };
    trackEvent("checkout_view", {
      productId: "compatibility",
      productName: product.name,
      profileId: profileA.id,
      profileName: profileA.name,
      partnerName: profileB.name,
      amount: product.amount,
    });
    prepareCheckout("compatibility", profileA, profileB);
  });
}

// ---------- birthDate input mask + validation ----------
function normalizeBirthDate(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function bindBirthDateMask() {
  const input = profileForm?.querySelector('input[name="birthDate"]');
  if (!input) return;
  input.addEventListener("input", () => {
    const normalized = normalizeBirthDate(input.value);
    if (normalized !== input.value) input.value = normalized;
    if (profileStatus) {
      if (input.value.length === 10 && !isValidBirthDate(input.value)) {
        profileStatus.textContent = "올바른 날짜 형식이 아니에요 (YYYY-MM-DD, 1~12월, 1~31일).";
      } else {
        profileStatus.textContent = "";
      }
    }
  });
}

// ---------- Library filters ----------
function bindLibraryFilters() {
  document.querySelector("[data-library-filters]")?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-library-filters] button")
        .forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      libraryFilter = button.dataset.libraryFilter || "all";
      renderArchive();
    });
  });
}

// ---------- Global event wiring ----------
document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => {
    closeMemberModal();
    // 결제 결과(/payments/*) 주소에 머물러 있으면 홈으로 정리(로고/뒤로 눌러도 못 빠져나가는 문제 방지)
    if (/^\/payments\//.test(location.pathname)) history.replaceState(null, "", "/");
    showView(button.dataset.viewTarget);
  });
});

slideButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeSlide = Number(button.dataset.slideTarget) || 0;
    showSlide(button.dataset.slideTarget);
    restartBannerAutoplay();
  });
});

// 히어로 배너 — 좌우 화살표 + 터치 스와이프
function stepSlide(delta) {
  if (!slides.length) return;
  activeSlide = (activeSlide + delta + slides.length) % slides.length;
  showSlide(String(activeSlide));
  restartBannerAutoplay();
}
document.querySelector("[data-slide-prev]")?.addEventListener("click", () => stepSlide(-1));
document.querySelector("[data-slide-next]")?.addEventListener("click", () => stepSlide(1));

const bannerCarousel = document.querySelector(".banner-carousel");
if (bannerCarousel) {
  let touchStartX = 0;
  let touchStartY = 0;
  bannerCarousel.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });
  bannerCarousel.addEventListener("touchend", (event) => {
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    // 가로 이동이 세로보다 크고 40px 이상일 때만 스와이프로 인정(스크롤 오작동 방지)
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) stepSlide(dx < 0 ? 1 : -1);
  }, { passive: true });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    productCards.forEach((card) => {
      card.classList.toggle(
        "is-hidden",
        button.dataset.filter !== "all" && card.dataset.category !== button.dataset.filter,
      );
    });
  });
});

let bannerAutoplayTimer = null;
function restartBannerAutoplay() {
  window.clearInterval(bannerAutoplayTimer);
  bannerAutoplayTimer = window.setInterval(() => {
    if (!document.querySelector('[data-view="home"]')?.classList.contains("is-active")) return;
    if (!slides.length) return;
    activeSlide = (activeSlide + 1) % slides.length;
    showSlide(String(activeSlide));
  }, 5200);
}
restartBannerAutoplay();

authButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (runtimeSession?.user) return;
    window.location.href = window.SajuApi.url("/api/auth/kakao/start");
  });
});

logoutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await window.SajuApi.fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    applyVerifiedSession(guestSession(), { silent: true });
    closeMypage();
    setPaymentStatus("로그아웃되었습니다.");
    showToast("로그아웃되었습니다.");
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshAuthSession("visibility", { force: true });
});

window.addEventListener("pageshow", (event) => {
  refreshAuthSession(event.persisted ? "pageshow-bfcache" : "pageshow", { force: Boolean(event.persisted), silent: true });
});

window.addEventListener("focus", () => {
  refreshAuthSession("focus");
});

// 마이페이지 드로어 열기/닫기 (상단 칩 + 햄버거 버튼)
document.querySelectorAll("[data-mypage-open]").forEach((btn) => {
  btn.addEventListener("click", openMypage);
});
document.querySelectorAll("[data-mypage-close]").forEach((btn) => {
  btn.addEventListener("click", closeMypage);
});
document.querySelector("[data-signup-form]")?.addEventListener("submit", signupWithEmail);
document.querySelector("[data-signup-form] input[name='phone']")?.addEventListener("input", (event) => {
  event.currentTarget.value = formatPhoneNumber(event.currentTarget.value);
});
document.querySelector("[data-signup-login]")?.addEventListener("click", openMypage);

document.querySelector("[data-support-compose]")?.addEventListener("click", () => {
  if (!runtimeSession?.user?.id) return openMypage();
  const form = document.querySelector("[data-support-form]");
  if (form) {
    form.hidden = false;
    form.querySelector("input[name='title']")?.focus();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
document.querySelector("[data-support-login]")?.addEventListener("click", openMypage);
document.querySelector("[data-support-cancel]")?.addEventListener("click", () => {
  const form = document.querySelector("[data-support-form]");
  if (form) form.hidden = true;
});
document.querySelector("[data-support-form]")?.addEventListener("submit", submitSupportInquiry);
document.querySelector("[data-support-list]")?.addEventListener("click", (event) => {
  const retry = event.target.closest("[data-support-retry]");
  if (retry) return loadSupportBoard({ force: true });
  const button = event.target.closest("[data-support-id]");
  if (!button) return;
  supportState.activeId = button.dataset.supportId;
  renderSupport();
  document.querySelector("[data-support-detail]")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("[data-support-detail]")?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-support-detail-close]")) return;
  supportState.activeId = null;
  renderSupport();
});
// ESC 로 드로어 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.querySelector("[data-chat-report-preview]")?.classList.contains("is-open")) {
    closeChatReportPreview();
    return;
  }
  if (e.key === "Escape" && mypageDrawer && !mypageDrawer.hasAttribute("hidden")) closeMypage();
});

document.querySelectorAll("[data-product-id]").forEach((button) => {
  button.addEventListener("click", () => {
    const productId = button.dataset.productId;
    if (!PRODUCTS[productId]) return;
    trackEvent("product_select", { productId, productName: PRODUCTS[productId].name, source: "button" });
    // Compatibility requires two profiles: route to dedicated view instead of single-profile modal
    if (productId === "compatibility") {
      showView("compatibility");
      return;
    }
    openMemberModal(productId);
  });
});

document.querySelectorAll("[data-member-modal-close]").forEach((button) => {
  button.addEventListener("click", closeMemberModal);
});

// Close member modal on backdrop click
memberModal?.addEventListener("click", (event) => {
  if (event.target === memberModal) closeMemberModal();
});

// ---------- Boot ----------
async function boot() {
  sessionStorage.setItem(
    "saju_lab_landing_page",
    sessionStorage.getItem("saju_lab_landing_page") || location.pathname + location.search,
  );
  sessionStorage.setItem(
    "saju_lab_referrer",
    sessionStorage.getItem("saju_lab_referrer") || document.referrer || "",
  );
  // 결제창에서 돌아온 경우 홈이 깜빡이지 않도록 즉시 결제결과 화면을 띄운다
  if (/^\/payments\/(success|fail)/.test(location.pathname)) {
    setPaymentResult("결제 결과 확인 중", "잠시만 기다려 주세요...", "", false, "loading");
  }
  applyAuthHint(); // 상단 로그인 칩을 직전 상태로 즉시 표시(로그인 깜빡임 방지)
  migrateLegacyData(); // 예전 공유 데이터 → guest 네임스페이스로 1회 이관(누수 방지)
  renderProductCatalog();
  seedProfiles();
  selectedProfileId = getProfiles()[0]?.id || null;
  bindSegmented();
  renderTimePeriods();
  applySegmentedDependencies();
  bindCalendar();
  bindFortuneMood();
  bindHomeGuide();
  bindFollowup();
  bindChat();
  bindYearAndCycle();
  bindCompatibility();
  bindBirthDateMask();
  bindLibraryFilters();
  // Initialize preview from current form defaults
  schedulePreviewUpdate();
  renderArchive();
  renderProfileSelects();
  renderPrimaryProfileLabel();
  renderAuthNotice();

  try {
    runtimeConfig = await getJson("/api/config");
  } catch {
    runtimeConfig = {
      tossClientKey: "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm",
      tossMode: "test",
      kakaoEnabled: false,
    };
  }
  await refreshAuthSession("boot", { force: true, silent: true });
  if (!runtimeSession) applyVerifiedSession(guestSession(), { silent: true });

  applyRuntimeConfig();
  const legalPath = location.pathname.replace(/^\/+/, "").toLowerCase();
  if (["terms", "privacy", "refund"].includes(legalPath)) showView(legalPath);
  // 결제 확인은 지체 없이 즉시 실행(동기화 끝나길 기다리면 "결제 확인 중"이 길게 돈다).
  // 동기화는 백그라운드 — syncKind가 merge 방식이라 결제확인과 동시 실행해도 주문이 안 사라진다.
  await confirmReturnedPayment();
  trackEvent("page_view", { title: document.title });
}

boot();

window.addEventListener("pagehide", () => {
  trackEvent(
    "page_exit",
    { view: currentViewName, durationMs: Date.now() - currentViewStartedAt },
    { beacon: true },
  );
});
