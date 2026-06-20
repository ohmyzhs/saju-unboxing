# 사용자 포인트 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 회원이 포인트를 충전하고 분석 상품을 포인트 또는 포인트+토스로 결제하며, 관리자가 잔액과 무료운세 재생성 토큰을 관리하게 한다.

**Architecture:** Postgres RPC가 잔액 변경과 감사 로그를 원자적으로 처리한다. Node 공용 모듈이 티어·RPC·결제 규칙을 제공하고 기존 주문, 토스 승인, 세션, 관리자, 일일운세 API가 이를 사용한다. Vercel 함수 수를 늘리지 않기 위해 사용자 잔액 조회는 `/api/session`, 포인트 주문은 `/api/orders`, 관리 기능은 `/api/admin/points`에 합친다.

**Tech Stack:** Node.js ESM, Vercel Functions, Supabase/Postgres, Toss Payments, Vanilla JavaScript, node:test

---

## 파일 구조

- `api/_lib/points.js`: 충전 티어, 잔액·내역 조회, 포인트·토큰 RPC 호출, 오류 변환
- `api/_lib/adminPoints.js`: 관리자 회원 포인트 조회·조정 요청 처리
- `supabase/schema.sql`: 포인트 테이블, 주문 컬럼, 원자적 RPC와 멱등 인덱스
- `api/orders.js`: 서버 가격 확정, 포인트 전액 결제와 혼합 주문 준비
- `api/payments/confirm.js`: 혼합 결제 차감·실패 환원, 충전 보너스 적립
- `api/session.js`: 로그인 회원의 포인트 잔액·내역 반환
- `api/saju/analyze.js`: 무료운세 재생성 토큰 예약·실패 환원·성공 차감
- `api/admin/[action].js`: `points` 액션 라우팅
- `api/config.js`: 공개 충전 티어와 포인트 활성 상태 반환
- `public/index.html`, `public/app.js`, `public/styles.css`: 충전 화면, 잔액, 포인트 사용, 재생성 버튼
- `public/admin.html`, `public/admin.js`: 회원 포인트 관리 탭
- `test/point-*.test.js`, `test/daily-regen.test.js`: 도메인·결제·UI 계약 회귀 테스트

### Task 1: 원자적 포인트 저장소와 공용 모듈

**Files:**
- Create: `api/_lib/points.js`
- Modify: `supabase/schema.sql`
- Create: `test/point-system.test.js`

- [ ] **Step 1: 충전 티어와 결제 계산 실패 테스트 작성**

```js
import { POINT_CHARGE_TIERS, paymentBreakdown, chargeTier } from "../api/_lib/points.js";

test("충전 티어는 5000→6000, 10000→13000, 20000→30000이다", () => {
  assert.deepEqual(POINT_CHARGE_TIERS.map((x) => [x.amount, x.points]), [
    [5000, 6000], [10000, 13000], [20000, 30000],
  ]);
});

test("사용 포인트를 잔액과 상품가 사이로 제한한다", () => {
  assert.deepEqual(paymentBreakdown(990, 1200, 500), { price: 990, pointsUsed: 500, cashAmount: 490, payMethod: "mixed" });
  assert.equal(chargeTier(7000), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/point-system.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 최소 공용 모듈 구현**

`POINT_CHARGE_TIERS`, `chargeTier(amount)`, `paymentBreakdown(price, requested, balance)`,
`getPointAccount(sb, userId)`, `adjustPoints(sb, args)`,
`adjustRegenTokens(sb, args)`, `isInsufficientPoints(error)`를 구현한다.

```js
export const POINT_CHARGE_TIERS = Object.freeze([
  { amount: 5000, bonus: 1000, points: 6000, bonusRate: 20 },
  { amount: 10000, bonus: 3000, points: 13000, bonusRate: 30 },
  { amount: 20000, bonus: 10000, points: 30000, bonusRate: 50 },
]);
```

- [ ] **Step 4: 스키마와 RPC 추가**

`user_points`, `point_transactions`, `(user_id, created_at desc)` 인덱스,
`orders.points_used`, `orders.pay_method`를 idempotent SQL로 추가한다.
`adjust_points`는 사용자 행 생성 후 `FOR UPDATE` 잠금, 동일
`user_id/type/ref` 거래 재사용, 음수 잔액 거절, 거래 스냅샷 기록을 한
트랜잭션에서 수행한다. `adjust_regen_tokens`도 행 잠금 후 음수를 거절한다.

- [ ] **Step 5: 통과 확인**

Run: `node --test test/point-system.test.js`
Expected: PASS

### Task 2: 주문 생성과 포인트 전액 결제

**Files:**
- Modify: `api/orders.js`
- Modify: `api/_lib/toss.js`
- Create: `test/point-orders.test.js`

- [ ] **Step 1: 주문 결제 결정 실패 테스트 작성**

```js
test("포인트 전액 결제는 현금 0과 points 결제수단을 반환한다", () => {
  assert.deepEqual(resolveOrderPayment({ price: 990, requestedPoints: 990, balance: 2000 }), {
    price: 990, pointsUsed: 990, cashAmount: 0, payMethod: "points",
  });
});

test("혼합 결제는 토스에 남은 금액만 보낸다", () => {
  assert.equal(resolveOrderPayment({ price: 990, requestedPoints: 400, balance: 400 }).cashAmount, 590);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/point-orders.test.js`
Expected: FAIL because `resolveOrderPayment` is not exported

- [ ] **Step 3: 서버 가격과 주문 결제 결정 구현**

`resolveProductPrice(config, productId, plan)`은 서버 `site_config.products` 가격을
우선 사용하고, 없으면 서버 `PLANS` 가격을 사용한다. `point-charge`는 정확한
충전 티어만 허용한다. `resolveOrderPayment`는 공용 `paymentBreakdown`을 호출한다.

- [ ] **Step 4: 주문 핸들러 연동**

로그인·Supabase가 있을 때만 포인트 사용과 충전을 허용한다. 포인트 전액이면
`adjust_points(-points_used, 'spend', orderId)` 후 주문을 즉시 `결제 완료`로
저장하고 `paidWithPoints=true`를 반환한다. 혼합·토스 주문은 현금 잔액을
`orders.amount`에, 사용 예정 포인트를 `points_used`에 저장한다.

- [ ] **Step 5: 통과 확인**

Run: `node --test test/point-orders.test.js test/point-system.test.js`
Expected: PASS

### Task 3: 토스 승인, 충전 적립, 혼합 실패 환원

**Files:**
- Modify: `api/payments/confirm.js`
- Create: `test/point-payments.test.js`

- [ ] **Step 1: 승인 서비스 실패 테스트 작성**

```js
test("혼합 결제는 포인트 차감 뒤 남은 금액만 토스 승인한다", async () => {
  const calls = [];
  await confirmOrderPayment({
    order: { id: "o1", amount: 590, points_used: 400, pay_method: "mixed", user_id: "u1" },
    paymentKey: "pk", requestedAmount: 590,
    adjust: async (x) => calls.push(x),
    confirm: async (order) => ({ paymentKey: "pk", totalAmount: order.amount }),
    markDone: async () => {},
  });
  assert.equal(calls[0].delta, -400);
});

test("토스 실패 시 차감 포인트를 refund로 한 번 환원한다", async () => {
  const calls = [];
  await assert.rejects(() => confirmOrderPayment({
    order: { id: "o2", amount: 590, points_used: 400, pay_method: "mixed", user_id: "u1" },
    paymentKey: "pk", requestedAmount: 590,
    adjust: async (x) => calls.push(x),
    confirm: async () => { throw new Error("승인 실패"); },
    markDone: async () => {},
  }), /승인 실패/);
  assert.deepEqual(calls.map((x) => x.type), ["spend", "refund"]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/point-payments.test.js`
Expected: FAIL because `confirmOrderPayment` is not exported

- [ ] **Step 3: 혼합 승인 서비스 구현**

금액·주문 상태를 검증하고 혼합이면 멱등 `spend` 후 토스를 승인한다. 토스
실패 시 멱등 `refund`를 호출하고 오류를 다시 던진다. 이미 완료된 주문은
재승인하지 않고 저장 결과를 반환한다.

- [ ] **Step 4: 충전 승인 구현**

`product_id='point-charge'`는 토스 승인 후 서버 티어를 다시 확인하고
`charge` 원금, `bonus` 보너스를 같은 주문번호 참조로 각각 적립한다. 주문을
완료 처리한 뒤 새 잔액과 적립 포인트를 응답한다.

- [ ] **Step 5: 통과 확인**

Run: `node --test test/point-payments.test.js`
Expected: PASS

### Task 4: 세션 잔액 조회와 무료운세 재생성 토큰

**Files:**
- Modify: `api/session.js`
- Modify: `api/saju/analyze.js`
- Create: `test/daily-regen.test.js`

- [ ] **Step 1: 재생성 결정 실패 테스트 작성**

```js
test("토큰이 있으면 캐시를 건너뛰고 하나를 예약한다", async () => {
  const state = await reserveDailyRegeneration({ requested: true, userId: "u1", sb: {}, tokenBalance: 1, adjust: async () => 0 });
  assert.deepEqual(state, { regenerate: true, remainingTokens: 0 });
});

test("토큰이 없으면 캐시를 그대로 사용할 수 있다", async () => {
  const state = await reserveDailyRegeneration({ requested: true, userId: "u1", sb: {}, tokenBalance: 0, adjust: async () => 0 });
  assert.equal(state.regenerate, false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/daily-regen.test.js`
Expected: FAIL because helper is missing

- [ ] **Step 3: 세션 응답 확장**

`GET /api/session`은 기존 `user`와 함께 `{ enabled, balance, regenTokens,
transactions }`를 `points`로 반환한다. Supabase 미설정 또는 미마이그레이션은
`enabled=false`로 반환해 기존 로그인 흐름을 유지한다.

- [ ] **Step 4: 재생성 토큰 예약과 보상 구현**

`regen=true`이며 로그인 회원의 토큰이 있으면 생성 전에 원자적으로 1개를
예약하고 캐시를 건너뛴다. AI 생성 실패 시 토큰을 다시 더한다. 성공 시 예약된
차감이 최종 상태가 된다. 토큰이 없으면 기존 캐시 경로를 유지한다.

- [ ] **Step 5: 통과 확인**

Run: `node --test test/daily-regen.test.js`
Expected: PASS

### Task 5: 사용자 충전·포인트 결제 UI

**Files:**
- Modify: `api/config.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Create: `test/point-ui.test.js`

- [ ] **Step 1: UI 계약 실패 테스트 작성**

```js
test("포인트 충전 화면과 결제 입력과 재생성 버튼 자리가 있다", () => {
  const html = readFileSync("public/index.html", "utf8");
  assert.match(html, /data-view="points"/);
  assert.match(html, /data-point-use/);
  assert.match(html, /data-daily-regenerate/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/point-ui.test.js`
Expected: FAIL on missing `data-view="points"`

- [ ] **Step 3: 공개 설정과 마이페이지 구현**

`/api/config`에 서버 티어와 `pointsEnabled`를 추가한다. 마이페이지에 잔액과
재생성 토큰을 표시하고 “포인트 충전” 메뉴를 추가한다. 충전 화면은 서버가
내려준 3개 티어만 렌더한다. 미로그인은 로그인 안내, 비활성 상태는 기존 토스
결제 안내를 표시한다.

- [ ] **Step 4: 결제 화면 구현**

로그인 회원에게 잔액과 포인트 사용 입력을 표시한다. 입력은 상품가와 잔액을
넘지 않게 제한한다. 전액 포인트면 토스 위젯을 숨기고 주문 API 성공 즉시 분석을
시작한다. 혼합이면 남은 금액으로 토스 위젯과 주문을 실행한다.

- [ ] **Step 5: 충전 반환과 일일운세 재생성 구현**

충전 토스 성공은 분석을 시작하지 않고 적립 결과와 새 잔액을 표시한다.
일일운세 결과는 토큰이 있을 때만 “다시 생성”을 표시하고 `regen=true`로
로컬·서버 캐시를 우회한다.

- [ ] **Step 6: 통과 확인**

Run: `node --test test/point-ui.test.js && npm run check`
Expected: PASS

### Task 6: 관리자 회원 포인트 관리

**Files:**
- Create: `api/_lib/adminPoints.js`
- Modify: `api/admin/[action].js`
- Modify: `public/admin.html`
- Modify: `public/admin.js`
- Modify: `public/styles.css`
- Create: `test/admin-points.test.js`

- [ ] **Step 1: 관리자 계약 실패 테스트 작성**

```js
test("관리자 화면에 회원 포인트 탭과 조정 입력이 있다", () => {
  const html = readFileSync("public/admin.html", "utf8");
  assert.match(html, /data-admin-tab="points"/);
  assert.match(html, /data-point-adjust/);
  assert.match(html, /data-regen-adjust/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/admin-points.test.js`
Expected: FAIL on missing points tab

- [ ] **Step 3: 관리자 API 구현**

`GET`은 회원 잔액·토큰과 주문에서 찾은 최신 계정 라벨을 반환하고 선택 회원의
거래 내역을 반환한다. `POST operation=adjust`는 `admin_adjust`,
`operation=regen`은 토큰 RPC를 호출한다. 0 조정, 미등록 사용자, 음수 결과를
한국어 400 오류로 거절한다.

- [ ] **Step 4: 관리자 UI 구현**

운영 메뉴에 “회원 포인트” 탭을 추가한다. 회원 선택, 거래 내역, 금액 +/− 조정,
관리 메모, 토큰 부여 폼을 구현하고 성공 후 해당 회원 데이터를 다시 조회한다.

- [ ] **Step 5: 통과 확인**

Run: `node --test test/admin-points.test.js && npm run check`
Expected: PASS

### Task 7: 전체 회귀 검증과 문서 정리

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `SETUP.md`

- [ ] **Step 1: 문법 검사 범위 확장**

`npm run check`에 `api/_lib/points.js`, `api/_lib/adminPoints.js`,
`api/orders.js`, `api/payments/confirm.js`, `api/session.js`를 추가한다.

- [ ] **Step 2: 운영 적용 문서 작성**

Supabase SQL Editor에서 갱신된 `supabase/schema.sql`을 실행해야 포인트 기능이
활성화된다는 점, 티어, 관리자 경로, 미설정 시 토스 단독 폴백을 한국어로
README와 SETUP에 기록한다.

- [ ] **Step 3: 전체 테스트 실행**

Run: `npm test`
Expected: 모든 테스트 PASS, fail 0

- [ ] **Step 4: 전체 문법 검사 실행**

Run: `npm run check`
Expected: exit 0

- [ ] **Step 5: 변경 범위 검사**

Run: `git diff --check && git status --short`
Expected: 공백 오류 없음, 포인트 시스템 관련 파일만 변경
