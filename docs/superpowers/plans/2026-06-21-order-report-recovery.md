# 주문·리포트 복구 및 포인트 운영 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결제·리포트 생성 실패를 사용자가 복구할 수 있게 하고 무료운세 및 관리자 포인트 기능의 사용성과 응답 속도를 개선한다.

**Architecture:** 서버 주문 API에 소유권 검증 취소 동작을 추가하고, 브라우저 계정별 주문 미러에는 결제 컨텍스트와 별도 리포트 상태를 저장한다. 리포트는 설계 응답 시 초안을 보관하고 섹션별로 갱신하며, 관리자 회원 목록과 상세 조회를 분리한다.

**Tech Stack:** Node.js ESM, Vercel Functions, Supabase, Vanilla JavaScript, Node test runner

---

### Task 1: 주문 취소와 관리자 결제 데이터 계약

**Files:**
- Create: `api/_lib/orderLifecycle.js`
- Modify: `api/orders.js`
- Modify: `api/admin/[action].js`
- Test: `test/order-lifecycle.test.js`
- Test: `test/admin-orders.test.js`

- [x] **Step 1: Write the failing tests**

`test/order-lifecycle.test.js`에 미결제 주문만 취소되고 다른 사용자 또는 결제 완료 주문은 거절되는 테스트를 작성한다. `test/admin-orders.test.js`에는 `mapOrder`가 `points_used`, `pay_method`, 현금 금액을 반환하는 테스트를 작성한다.

- [x] **Step 2: Run tests to verify RED**

Run: `node --test test/order-lifecycle.test.js test/admin-orders.test.js`

Expected: `orderLifecycle.js`와 내보낸 매핑 함수가 없어 실패한다.

- [x] **Step 3: Implement the server contract**

`cancelOwnedOrder({ order, userId, update })`는 주문 존재, 소유권, 결제 상태를 검사한 뒤 `결제 취소`로 갱신한다. `api/orders.js`는 `{ action: "cancel", orderId }` 요청을 처리한다. `mapOrder`를 export하고 `pointsUsed`, `payMethod`, `cashAmount`를 포함한다.

- [x] **Step 4: Run tests to verify GREEN**

Run: `node --test test/order-lifecycle.test.js test/admin-orders.test.js`

Expected: 두 파일의 모든 테스트 통과.

### Task 2: 관리자 회원 상세 조회 분리와 폼 오류 수정

**Files:**
- Modify: `api/_lib/adminPoints.js`
- Modify: `public/admin.html`
- Modify: `public/admin.js`
- Modify: `public/styles.css`
- Test: `test/admin-points.test.js`

- [x] **Step 1: Write the failing tests**

선택 회원 요청이 전체 회원·주문 쿼리를 반복하지 않는 테스트와 관리자 스크립트가 제출 전에 `event.currentTarget`을 보관하고 상세만 새로고침하는 정적 계약 테스트를 추가한다.

- [x] **Step 2: Run test to verify RED**

Run: `node --test test/admin-points.test.js`

Expected: 상세 전용 조회와 안전한 폼 참조가 없어 실패한다.

- [x] **Step 3: Implement detail-only loading and improved controls**

`GET /api/admin/points?userId=...`는 선택 계정만 반환하고, 목록 요청만 전체 회원을 조회한다. 클라이언트는 회원 검색, 선택 강조, 상세 로딩, 빠른 포인트 조정, 토큰 `+1` 버튼을 제공한다. `const form = event.currentTarget`을 `await` 전에 저장하고 성공 후 상세만 갱신한다.

- [x] **Step 4: Run test to verify GREEN**

Run: `node --test test/admin-points.test.js`

Expected: 관리자 포인트 테스트 통과.

### Task 3: 결제 내역 상세·취소·이어하기·리포트 재시도

**Files:**
- Create: `public/order-recovery.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `package.json`
- Test: `test/order-recovery-ui.test.js`

- [x] **Step 1: Write the failing tests**

주문 상태별 가능 행동, 현금·포인트 표시, 결제 컨텍스트 보존을 검증하는 순수 함수 테스트와 HTML/스크립트 연결 테스트를 작성한다.

- [x] **Step 2: Run test to verify RED**

Run: `node --test test/order-recovery-ui.test.js`

Expected: `OrderRecovery` 모듈과 주문 상세 행동이 없어 실패한다.

- [x] **Step 3: Implement order recovery UI**

`public/order-recovery.js`에 `capabilities(order)`, `paymentSummary(order)`, `isPaid(order)`를 정의한다. 주문 카드에 상세 토글을 추가하고 결제 대기는 기존 주문 ID로 토스 결제를 재요청한다. 취소는 서버 API 성공 후 로컬 주문을 갱신한다. 결제 완료는 보관함 리포트를 열고, 없거나 실패하면 저장된 컨텍스트로 리포트만 다시 생성한다.

- [x] **Step 4: Run test to verify GREEN**

Run: `node --test test/order-recovery-ui.test.js`

Expected: 주문 복구 UI 테스트 통과.

### Task 4: 리포트 초안 체크포인트와 요청 제한 시간

**Files:**
- Modify: `public/app.js`
- Test: `test/report-recovery.test.js`

- [x] **Step 1: Write the failing tests**

분석 설계 직후 초안을 저장하고, 섹션별 초안을 갱신하며, 실패 시 주문을 `reportStatus: "failed"`로 남기는 정적 계약 테스트를 작성한다. `getJson` 제한 시간도 검증한다.

- [x] **Step 2: Run test to verify RED**

Run: `node --test test/report-recovery.test.js`

Expected: 체크포인트 함수와 제한 시간이 없어 실패한다.

- [x] **Step 3: Implement durable generation**

`getJson`에 선택적 제한 시간을 추가한다. `startAnalysis`는 주문을 생성중으로 바꾸고, plan 응답 직후 고정된 archive ID로 초안을 저장한다. 각 섹션 성공·실패 때 같은 초안을 갱신하며 마지막에 완료 상태를 기록한다. 최상위 실패는 주문에 오류 메시지와 재시도 상태를 남긴다.

- [x] **Step 4: Run test to verify GREEN**

Run: `node --test test/report-recovery.test.js`

Expected: 리포트 복구 테스트 통과.

### Task 5: 무료운세 재생성권 안내 개선

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `test/point-ui.test.js`

- [x] **Step 1: Write the failing test**

무료운세 결과 상단 재생성권 카드, 남은 토큰 수, 확인 후 재생성, 포인트 화면 이동 버튼을 검증한다.

- [x] **Step 2: Run test to verify RED**

Run: `node --test test/point-ui.test.js`

Expected: 상단 카드와 명시적 사용 흐름이 없어 실패한다.

- [x] **Step 3: Implement regeneration guidance**

무료운세 화면 제목 아래에 토큰 카드와 버튼을 배치하고 `renderDailyRegeneration()`에서 세션 상태를 갱신한다. 버튼은 확인 후 `regen: true`를 호출한다. 포인트 화면에는 무료운세 이동 버튼을 추가한다.

- [x] **Step 4: Run test to verify GREEN**

Run: `node --test test/point-ui.test.js`

Expected: 포인트 UI 테스트 통과.

### Task 6: 전체 검증과 운영 화면 확인

**Files:**
- Modify: `docs/superpowers/plans/2026-06-21-order-report-recovery.md`

- [x] **Step 1: Run all automated verification**

Run: `npm test && npm run check && git diff --check`

Expected: 모든 테스트 통과, 문법 및 공백 오류 없음.

- [x] **Step 2: Review the requirement checklist**

결제 이어하기·취소·상세·리포트 재시도, 초안 보관, 무료운세 재생성 카드, 관리자 폼 오류, 상세 성능, 포인트 결제 표시가 각각 코드와 테스트에 연결됐는지 확인한다.

- [x] **Step 3: Commit implementation**

```bash
git add api public test package.json docs/superpowers/plans/2026-06-21-order-report-recovery.md
git commit -m "fix: recover paid report workflows"
```
