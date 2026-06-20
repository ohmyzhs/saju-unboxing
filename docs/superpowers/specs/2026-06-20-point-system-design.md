# 사용자 포인트 시스템 설계

## 목표

로그인 회원이 포인트를 미리 충전해 두고, 사이트 내 분석 상품을 그 포인트로
결제할 수 있게 한다. 충전에는 정액 보너스를 준다. 관리자는 회원별 포인트를
조회·관리(임의 충전/차감)하고, 무료 사주 재생성 토큰을 부여할 수 있다.

포인트 단위는 1pt = 1원. 모든 금액·잔액은 정수 원/포인트로 다룬다.
포인트는 로그인 계정(`user_id`)에 귀속된다. 게스트(미로그인)는 포인트를
쓸 수 없고 기존 토스 결제만 사용한다.

## 데이터 모델

### user_points (계정별 잔액)

- `user_id` text primary key — 로그인 계정 식별(카카오/이메일 공통)
- `balance` integer not null default 0 — 현재 포인트 잔액(>= 0 불변식)
- `regen_tokens` integer not null default 0 — 무료사주 재생성 토큰 수
- `updated_at` timestamptz default now()

### point_transactions (감사 로그)

- `id` uuid primary key default uuid_generate_v4()
- `user_id` text not null
- `type` text not null — `charge`(충전 원금) | `bonus`(충전 보너스) | `spend`(상품 결제) | `refund`(결제 취소 환원) | `admin_adjust`(관리자 수동)
- `amount` integer not null — 부호 있음(+충전/보너스/환원, −결제/차감)
- `balance_after` integer not null — 거래 직후 잔액(감사용 스냅샷)
- `ref` text — 연관 주문번호 또는 관리자 메모
- `created_at` timestamptz default now()
- 인덱스: `(user_id, created_at desc)`

### orders 확장

- `points_used` integer not null default 0 — 이 주문에서 포인트로 결제한 금액
- `pay_method` text default 'toss' — `toss` | `points` | `mixed`
- 충전 주문 구분: `product_id = 'point-charge'`, `amount = 충전 원금`

### 원자적 잔액 변경 (RPC)

동시 차감·중복 차감 경합을 막기 위해 Postgres 함수로 잔액을 변경한다.

```sql
adjust_points(p_user_id text, p_delta int, p_type text, p_ref text)
  returns int  -- 변경 후 잔액
```

- 대상 행을 `select ... for update`로 잠그고 `balance + p_delta` 계산.
- 결과가 음수면 예외(잔액 부족) → 호출부가 잡아 400 처리.
- 같은 트랜잭션에서 `point_transactions` 한 줄 기록(`balance_after` 포함).
- 행이 없으면 default 0에서 생성 후 적용.
- `regen_tokens`는 별도 RPC `adjust_regen_tokens(p_user_id, p_delta)`로 동일 패턴.

## 충전 (고정 티어 · 토스 선결제)

티어는 정확히 3개. 보너스는 충전 원금 기준 정률.

| 충전 원금 | 보너스 | 적립 포인트 |
|---|---|---|
| 5,000원 | 20% | 6,000pt |
| 10,000원 | 30% | 13,000pt |
| 20,000원 | 50% | 30,000pt |

티어 표는 서버 상수로 단일 정의(프론트는 표시용으로만 참조, 적립 금액은
서버가 확정). 임의 금액 충전은 허용하지 않는다.

흐름:

1. 로그인 회원이 충전 화면에서 티어 선택 → 토스 결제(충전 원금) 시작.
   `product_id = 'point-charge'`, `amount = 원금`인 주문 생성.
2. 토스 승인(`payments/confirm.js`)에서 충전 주문이면:
   - `adjust_points(+원금, 'charge', orderId)`
   - `adjust_points(+보너스, 'bonus', orderId)`
   - 주문 status `DONE`.
3. 잔액·내역은 보관함/마이페이지에서 조회.

미로그인 상태에서 충전 시작 시 로그인 유도.

## 결제 (포인트 + 토스 혼합)

분석 상품 결제 화면에 결제수단 영역을 둔다.

- 현재 포인트 잔액 표시.
- "포인트 사용" 입력(0 ~ min(잔액, 상품가)). 남은 금액 = 상품가 − 사용 포인트.
- 남은 금액 0 → 토스 없이 즉시 주문 승인(`pay_method='points'`).
- 남은 금액 > 0 → 그 금액만 토스 결제(`pay_method='mixed'`), 0이면 `toss`.

주문 승인 시점(포인트 전액 결제는 주문 생성 시, 혼합은 토스 confirm 시):

1. `adjust_points(−points_used, 'spend', orderId)` — 실패(잔액 부족) 시 주문 거절.
2. 주문에 `points_used`, `pay_method` 저장.
3. 토스 결제가 동반된 혼합 주문에서 토스가 실패하면 차감한 포인트를
   `adjust_points(+points_used, 'refund', orderId)`로 환원.

기존 토스 단독 결제 경로는 그대로 유지(포인트 미사용 = `points_used=0`).

## 어드민 — 회원 포인트 관리

`/api/admin/[action].js`에 `points` 액션 추가(관리자 인증 필요).

- 회원 목록: `user_points`를 계정 라벨(`orders.user_label` 등)과 조인해
  잔액·재생성토큰 표시. 회원 선택 시 `point_transactions` 내역.
- 수동 충전/차감: 금액 입력(+/−) → `adjust_points(delta, 'admin_adjust', 메모)`.
  차감 결과가 음수면 거절.
- 재생성 토큰 부여: `adjust_regen_tokens(+N)`.

어드민 UI는 신규 "회원 포인트" 패널(탭)에 둔다. 기존 "고객 관리" 패널은 변경하지 않는다.

## 무료 사주 재생성 (1회용 토큰)

`daily-fortune`은 같은 사람·같은 날 캐시를 재사용한다(`handleDaily`).
관리자가 회원에 재생성 토큰을 부여하면, 그 회원은 캐시를 무시하고 재생성할 수
있다.

- 사용자가 결과 화면에서 "다시 생성"(토큰 보유 시에만 노출) 요청.
- `analyze`의 daily 경로가 `regen=true` + 토큰 보유를 확인하면 캐시 조회를
  건너뛰고 새로 생성, 성공 시 `adjust_regen_tokens(−1)`.
- 토큰 0이면 버튼 미노출/요청 거절(기존 캐시 반환).

## 오류 처리

- 잔액 부족: 400 + 한국어 메시지("포인트가 부족합니다"), 충전 유도.
- 토스 취소/실패: 동반 차감 포인트 환원(refund tx). 멱등 처리(중복 환원 방지).
- 동시 차감: `adjust_points` 행 잠금으로 경합 차단.
- 미로그인 포인트 사용/충전: 로그인 유도, 서버에서도 거절.
- Supabase 미설정: 포인트 기능 비활성(기존 토스 단독 결제로 폴백).
- 운영 응답에 내부 스택·민감 설정 비노출.

## 전환 범위

- 스키마: `user_points`, `point_transactions`, `adjust_points`/`adjust_regen_tokens`
  RPC, `orders` 컬럼 추가(`schema.sql`에 idempotent 추가).
- API: 포인트 잔액/내역 조회, 충전 주문 생성, 결제 차감 연동(`orders.js`,
  `payments/confirm.js`), 어드민 `points` 액션, daily 재생성 분기.
- 프론트: 충전 화면(티어 3버튼), 잔액 표시, 결제 화면 포인트 사용 입력,
  daily "다시 생성" 버튼.
- 어드민: 회원 포인트 조회·수동 충전/차감·토큰 부여 UI.
- 기존 토스 단독 결제·게스트 결제·무료운세 기본 흐름은 유지.

## 테스트와 완료 조건

제품 코드보다 테스트를 먼저 작성한다.

- 보너스 계산: 5,000→6,000 / 10,000→13,000 / 20,000→30,000.
- `adjust_points`: 가산·차감·음수 거절·잔액 스냅샷·트랜잭션 기록.
- 동시 차감 경합에서 잔액이 음수로 가지 않음.
- 포인트 전액 결제 시 토스 미호출, 혼합 시 남은 금액만 토스.
- 토스 실패 시 포인트 환원(멱등).
- 어드민 수동 충전/차감/토큰 부여가 잔액·내역에 반영.
- 재생성 토큰 보유 시 daily 캐시 무시·재생성·토큰 1 차감, 토큰 0이면 캐시 반환.
- 미로그인·Supabase 미설정 폴백.

완료 조건:

- 회원이 3개 티어로 충전 시 보너스 포함 적립, 내역 기록.
- 결제 화면에서 포인트+토스 혼합·포인트 전액 결제가 동작.
- 어드민에서 회원별 잔액·내역 조회 및 수동 충전/차감·토큰 부여.
- 관리자가 허용한 회원이 무료사주를 토큰으로 재생성.
- JavaScript 문법 검사와 전체 자동화 테스트 통과.

## 범위 밖

- 포인트 환불(현금 환급)·유효기간·만료 정책.
- 임의 금액 충전, 추천인/쿠폰 등 추가 적립.
- 다중 통화·세금 처리.
- 포인트 양도·선물.
