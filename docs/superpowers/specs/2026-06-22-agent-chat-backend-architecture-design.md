# 챗봇 상담과 분리형 Vercel 백엔드 설계

## 목표

현재 한 Vercel 프로젝트에 섞여 있는 정적 프론트엔드와 서버리스 API를 같은 Git 저장소 안의 두 Vercel 프로젝트로 분리한다. 새 `챗봇상담`은 선택한 리포트만 근거로 대화하는 유료 AI Agent로 구현하고, 사용자가 화면을 나가거나 배포가 발생해도 질문 처리와 답변 저장이 계속되게 한다. 기존 990원 `추가상담`은 별도 기능으로 유지하되 같은 내구성 원칙으로 복구 가능하게 만든다.

상용 운영은 Vercel Pro를 전제로 한다. 프론트엔드는 정적 배포를 유지하고, 백엔드는 Vercel Functions, Workflow, Queues와 Supabase를 조합한다. Workflow와 Queues가 Beta인 점을 고려해 업무 상태와 최종 데이터는 항상 Supabase에도 저장하고, 실행기만 나중에 컨테이너 서비스로 교체할 수 있게 경계를 둔다.

## 확정된 상품 정책

챗봇 질의응답권은 로그인 회원만 구매하고 사용할 수 있다.

| 상품 ID | 질문 수 | 정상가 | 할인 | 결제 금액 |
| --- | ---: | ---: | ---: | ---: |
| `chat-qa-1` | 1건 | 500원 | 없음 | 500원 |
| `chat-qa-3` | 3건 | 1,500원 | 없음 | 1,500원 |
| `chat-qa-5` | 5건 | 2,500원 | 10% | 2,250원 |
| `chat-qa-10` | 10건 | 5,000원 | 20% | 4,000원 |

- 한 번의 사용자 질문 전송이 1건이다. Agent 내부의 모델 재호출이나 도구 호출은 추가 차감하지 않는다.
- 질문을 저장하면서 1건을 원자적으로 예약 차감한다.
- 답변이 정상 완료되면 예약을 사용 완료로 확정한다.
- AI 공급자 오류, 함수 오류, 영구적인 Workflow 실패는 1건을 자동 환원한다.
- 브라우저 재전송, 새로고침, 페이지 이동, Workflow 재시도는 같은 `clientRequestId`를 사용해 중복 차감하지 않는다.
- 포인트 결제, 토스 결제, 혼합 결제 모두 기존 주문 흐름을 사용한다. 결제 완료 후 질의응답권 적립은 주문번호 기준으로 멱등 처리한다.

## 기존 추가상담과 챗봇상담의 경계

두 기능은 상품, 화면, 데이터, 생성 방식이 서로 다르다.

### 기존 추가상담

- 기존 가격 990원과 `followup` 상품을 유지한다.
- 주문 한 건으로 미리 입력한 질문 한 개에 장문의 단일 답변을 만든다.
- 연속 대화, 잔여 질문권, Agent 도구 반복을 사용하지 않는다.
- 질문과 답변은 `followup_requests`에 서버 저장하고 주문 상세와 추가상담 화면에서 다시 찾을 수 있게 한다.
- 결제 직후 별도 Workflow를 시작하므로 결제 완료 화면을 벗어나도 생성이 계속된다.

### 새 챗봇상담

- 질의응답권을 먼저 구매한 뒤 리포트를 선택해 대화방을 연다.
- 같은 대화방에서 질문할 때마다 질의응답권을 1건씩 사용한다.
- 선택한 리포트의 데이터와 현재 대화 이력만 사용하는 제한형 AI Agent다.
- 답변을 SSE로 점진 표시하며 모든 질문, 답변, 실행 상태를 서버에 저장한다.
- 화면을 나갔다 돌아오면 진행 중 상태나 완성된 답변을 그대로 복구한다.

두 기능은 Workflow 실행 기반과 AI 전송 모듈만 공유한다. 테이블, API 계약, 프롬프트, UI는 합치지 않는다.

## 저장소와 배포 구조

같은 저장소를 다음 구조로 바꾼다.

```text
apps/
  web/                  # 현재 public 정적 SPA와 웹 전용 설정
    public/
    scripts/
    vercel.json
    package.json
  api/                  # 인증, 주문, 리포트, 상담, Agent 백엔드
    api/
    src/http/
    src/domain/
    src/workflows/
    src/agent/
    vercel.json
    package.json
packages/
  contracts/            # 웹과 API가 공유하는 순수 JSON 계약과 상수
supabase/
test/
package.json            # 워크스페이스 공통 명령
```

Vercel 프로젝트는 같은 `main` 브랜치를 Production Branch로 사용한다.

1. `saju-web`: Root Directory `apps/web`, 정적 파일만 배포한다.
2. `saju-api`: Root Directory `apps/api`, Functions와 Workflow를 배포한다.

웹은 빌드 시 `SAJU_API_BASE_URL`을 `runtime-config.js`에 기록하고 모든 API 요청에 `credentials: "include"`를 사용한다. 운영에서는 `https://api.<서비스도메인>` 같은 백엔드 전용 도메인을 사용한다. 백엔드는 허용된 웹 Origin만 자격 증명 CORS로 허용하고, 상태 변경 요청은 `Origin`도 검사한다. 로그인 쿠키는 백엔드 호스트 전용 `HttpOnly`, `Secure`, `SameSite=Lax`로 발급한다.

비밀키, Supabase service role, AI API 키, 토스 secret은 API 프로젝트에만 둔다. 웹 프로젝트에는 공개 런타임 설정과 토스 client key만 둔다.

## 백엔드 함수 구성

공개 REST API는 하나의 catch-all gateway 함수로 통합한다. 인증, JSON 파싱, CORS, 오류 응답을 공통 미들웨어로 처리하고 실제 로직은 `src/domain` 서비스에 둔다. Workflow 단계와 Queue consumer는 Vercel이 별도 함수로 컴파일하므로 HTTP 라우트 수를 불필요하게 늘리지 않는다.

기존 경로는 프론트 전환 위험을 줄이기 위해 그대로 제공한다.

- `/api/config`, `/api/session`, `/api/profiles`, `/api/orders`
- `/api/payments/confirm`, `/api/saju/analyze`, `/api/saju/section`
- `/api/admin/*`, `/api/share`, `/api/track`

새 경로는 다음과 같다.

- `GET /api/chat/catalog`: 질의응답권 상품과 현재 잔액
- `GET /api/chat/sessions`: 사용자의 대화방 목록과 마지막 실행 상태
- `POST /api/chat/sessions`: 선택한 보관함 리포트로 대화방 생성 또는 기존 대화방 반환
- `GET /api/chat/sessions/:id`: 리포트 요약, 메시지, 잔액 반환
- `POST /api/chat/sessions/:id/messages`: 질문 저장, 1건 예약, Workflow 시작 후 `202` 반환
- `GET /api/chat/runs/:id/events`: `Last-Event-ID`를 지원하는 SSE 이벤트 스트림
- `POST /api/chat/runs/:id/retry`: 환원된 실패 질문을 동일 내용으로 다시 예약해 재시도
- `GET /api/followups`: 기존 추가상담 요청 목록과 상태
- `POST /api/followups`: 결제 완료된 주문의 추가상담 실행 보장 또는 실패 건 재시도

모든 챗봇 경로는 세션 사용자와 리소스 소유권을 함께 검사한다. 추가상담은 로그인 소유권 또는 해당 주문의 recovery token을 검사한다. 클라이언트가 보낸 `userId`, 잔액, 결제 완료 여부는 신뢰하지 않으며 비회원 추가상담의 리포트 본문만 제한된 스키마로 받는다.

## 데이터 모델

### 질의응답권

`chat_credit_accounts`

- `user_id text primary key`
- `balance integer not null check (balance >= 0)`
- `updated_at timestamptz`

`chat_credit_transactions`

- `id uuid primary key`
- `user_id text not null`
- `type text`: `purchase`, `reserve`, `refund`, `admin_adjust`
- `amount integer not null`
- `balance_after integer not null`
- `ref text not null`
- `metadata jsonb`
- `created_at timestamptz`
- `(user_id, type, ref)` unique

`reserve_chat_credit(user_id, message_id)` RPC는 계정 행을 잠그고 잔액 확인, 1건 차감, 거래 로그 기록을 한 트랜잭션으로 처리한다. `refund_chat_credit(user_id, message_id)` RPC는 예약 거래가 있고 기존 환원이 없을 때만 1건을 돌려준다.

실제 질문 전송은 더 큰 `enqueue_chat_message(user_id, session_id, client_request_id, question)` RPC가 담당한다. 이 RPC가 대화방 소유권 확인, 사용자/assistant 메시지 생성, run 생성, `reserve_chat_credit` 실행을 하나의 DB 트랜잭션으로 묶어 메시지만 생기거나 잔액만 빠지는 중간 상태를 만들지 않는다. 질문은 공백 제거 후 1~1,000자로 제한한다.

### 챗봇 대화

`chat_sessions`

- `id uuid primary key`
- `user_id text not null`
- `source_archive_id text not null`
- `report_snapshot jsonb not null`
- `title text not null`
- `status text`: `active`, `archived`
- `created_at`, `updated_at`, `last_message_at`
- `(user_id, source_archive_id)` unique

대화방 생성 시 서버가 `user_data(kind='archive')`에서 소유권을 확인하고 리포트 전체를 `report_snapshot`으로 고정한다. 이후 원본 보관함 항목이 변경되거나 삭제되어도 해당 대화의 근거는 바뀌지 않는다. 같은 리포트를 다시 선택하면 기존 대화방을 이어서 연다.

`chat_messages`

- `id uuid primary key`
- `session_id uuid not null`
- `role text`: `user`, `assistant`
- `content text not null default ''`
- `status text`: `queued`, `streaming`, `completed`, `failed`
- `reply_to uuid`
- `client_request_id text`
- `error_code`, `error_message`
- `created_at`, `completed_at`
- 사용자 메시지는 `(session_id, client_request_id)` unique

`chat_runs`

- `id uuid primary key`
- `session_id`, `user_message_id`, `assistant_message_id`
- `workflow_run_id text`
- `status text`: `queued`, `running`, `completed`, `failed`
- `credit_status text`: `reserved`, `consumed`, `refund_pending`, `refunded`
- `model text`, `attempt_count integer`, `usage jsonb`
- `started_at`, `completed_at`
- `user_message_id` unique

`chat_stream_events`

- `run_id uuid not null`
- `seq integer not null`
- `type text`: `status`, `delta`, `replace`, `complete`, `error`
- `payload jsonb not null`
- `created_at timestamptz`
- `(run_id, seq)` primary key

최종 답변은 `chat_messages.content`가 정본이다. 이벤트는 SSE 재연결을 위한 임시 로그이며 완료 후 7일이 지난 이벤트는 정리한다.

### 기존 추가상담

`followup_requests`

- `id uuid primary key`
- `order_id text unique not null`
- `user_id text`
- `visitor_id text`
- `access_token_hash text`
- `source_archive_id text not null`
- `report_snapshot jsonb not null`
- `question text not null`
- `answer text not null default ''`
- `status text`: `payment_pending`, `queued`, `running`, `completed`, `failed`, `canceled`
- `workflow_run_id`, `model`, `error_code`, `error_message`
- `created_at`, `started_at`, `completed_at`, `updated_at`

추가상담 주문 생성 시 서버가 먼저 `followup_requests(payment_pending)`와 리포트 스냅샷을 저장한다. 로그인 회원은 `user_data` 소유권을 확인해 서버 데이터를 복사한다. 기존 비회원 구매 흐름은 유지하되 클라이언트 리포트의 크기와 스키마를 제한해 저장하고, 새로 발급한 고강도 recovery token의 해시만 서버에 보관한다. 비회원은 같은 브라우저에 저장된 token으로만 상태와 답변을 다시 읽을 수 있다. 결제되지 않은 요청은 실행하지 않으며 주문 취소 시 `canceled`로 바꾼다. 주문번호가 유일한 실행 키이므로 결제 confirm 재호출이나 화면 재진입이 같은 답변 생성을 중복 시작하지 않는다.

## 결제와 권한 부여

주문 완료와 상품 권한 부여를 `fulfillOrder(orderId)` 서비스로 분리한다.

1. 토스 승인 또는 포인트 전액 결제가 주문을 `결제 완료`로 만든다.
2. `fulfillOrder`가 상품 ID를 확인한다.
3. 챗봇 상품이면 주문번호를 `ref`로 질의응답권을 적립한다.
4. 추가상담이면 주문 생성 때 저장한 `followup_requests`를 `queued`로 바꾸고 Workflow를 시작한다.
5. 일반 리포트 상품이면 기존 리포트 생성 흐름을 유지한다.

적립과 실행 시작은 재호출 가능해야 한다. 주문이 결제 완료가 아니면 어떤 권한도 부여하지 않는다. 포인트 전액 결제와 토스 confirm이 반드시 같은 `fulfillOrder` 경로를 사용하게 해 한쪽만 누락되는 문제를 막는다.

## Agent 실행과 컨텍스트 제한

챗봇은 제한형 Tool-Loop Agent로 동작하며 한 사용자 질문당 최대 4단계까지만 실행한다. Agent가 사용할 수 있는 도구는 다음 네 개뿐이다.

1. `get_report_overview`: 선택 리포트의 제목, 상품, 대상자, 핵심 요약 반환
2. `get_report_section`: 선택 리포트의 지정 섹션 본문 반환
3. `get_manse_facts`: 선택 리포트에 저장된 만세력과 파생 데이터 반환
4. `get_conversation_history`: 현재 대화방의 최근 질문과 답변 반환

도구는 모두 `sessionId`로 고정된 `report_snapshot`과 대화방 데이터만 읽는다. 외부 검색, URL 열기, 다른 리포트 조회, 만세력 재계산, 사용자 파일 조회 도구는 제공하지 않는다. 모델이 외부 정보를 요구하거나 리포트로 답할 수 없는 질문을 받으면 추측하지 않고 근거 범위를 설명한다.

시스템 지침은 리포트 데이터를 신뢰할 수 없는 인용 컨텍스트로 취급해 그 안의 명령문을 무시하게 한다. 의료, 법률, 투자처럼 전문 판단이 필요한 질문은 사주 리포트 안의 흐름과 일반적인 주의사항까지만 답하고 전문가 확인을 안내한다.

대화 이력은 최근 10개 사용자-답변 쌍까지만 기본 컨텍스트에 포함한다. Agent가 더 이전 맥락이 필요할 때만 `get_conversation_history`를 호출한다. 출력은 한국어로 작성하고 기본 상한은 1,600 토큰으로 둔다.

## Workflow와 SSE 데이터 흐름

### 질문 전송

1. 웹이 `clientRequestId`와 질문을 전송한다.
2. API가 로그인, 대화방 소유권, 질문 길이를 검증한다.
3. 한 DB 트랜잭션에서 사용자 메시지, 빈 assistant 메시지, run을 만들고 질의응답권 1건을 예약한다.
4. API가 Agent Workflow를 시작하고 즉시 `202 { runId, messageId }`를 반환한다.
5. 웹은 SSE에 연결하고 현재 대화방을 계속 표시한다.

### Agent Workflow

1. run을 `running`으로 바꾸고 `status` 이벤트를 기록한다.
2. 서버에서 고정된 리포트 스냅샷과 최근 대화 이력을 읽는다.
3. 최대 4단계 Tool-Loop Agent를 스트리밍 실행한다.
4. 답변 델타를 문장 또는 약 200~500자 단위로 `chat_stream_events`에 기록하고 assistant 메시지 초안을 갱신한다.
5. 정상 종료 시 최종 답변, 모델 사용량, 완료 시간을 저장하고 credit 상태를 `consumed`로 확정한다.
6. 재시도 가능한 공급자 오류는 Workflow 정책에 따라 재시도한다.
7. 영구 실패 시 run과 메시지를 `failed`로 저장하고 질의응답권을 멱등 환원한 뒤 `error` 이벤트를 기록한다.

### SSE와 페이지 복구

SSE 함수는 모델을 직접 호출하지 않고 저장된 이벤트만 전달한다. 연결 즉시 현재 assistant 초안과 run 상태를 `replace` 이벤트로 보내고, 이후 `Last-Event-ID`보다 큰 이벤트를 최대 1초 간격으로 조회해 전달한다. 15초마다 heartbeat를 보내며 클라이언트는 끊기면 지수 백오프로 재연결한다. 완료·실패 이벤트 뒤 연결을 닫고, 동시 연결 증가로 DB 조회가 병목이 되면 `ChatRepository` 구현만 Realtime 또는 Redis fan-out으로 교체한다.

사용자가 페이지를 나가도 Workflow는 계속 실행한다. 돌아오면 대화방 API에서 `queued`, `running`, `completed`, `failed` 상태를 복구하고, 진행 중 run에만 SSE를 다시 연결한다. SSE 연결 자체는 작업 생명주기와 무관하다.

## UI 구조

홈과 하단 메뉴에서 `추가 질문 상담`과 별도로 `AI 챗봇 상담`을 노출한다.

챗봇 화면은 세 영역으로 구성한다.

1. 상담 목록: 선택한 리포트 제목, 대상자, 마지막 질문 시각, 진행 상태
2. 대화 영역: 사용자/AI 말풍선, 스트리밍 커서, 실패·재시도 상태
3. 입력 영역: 남은 질문 수, 질문 입력, 전송 버튼, 질의응답권 구매 버튼

최초 진입 흐름은 `질의응답권 확인 → 리포트 선택 → 대화방 생성 → 질문`이다. 잔액이 0이어도 기존 대화를 읽을 수 있지만 새 질문 전송은 막고 상품 선택 패널을 연다. 질문 전송 즉시 로컬 말풍선을 표시하되 서버가 반환한 ID로 교체한다.

기존 추가상담 화면은 리포트 선택과 990원 질문 입력 UI를 유지하면서 `답변 생성중`, `완료`, `실패` 요청 목록을 추가한다. 결제 내역의 추가상담 주문 상세에도 `답변 보기`, `생성 상태 확인`, `다시 시도`를 제공한다.

## 오류 처리와 멱등성

- 모든 쓰기 요청은 서버 생성 ID 또는 클라이언트 요청 ID를 유일키로 사용한다.
- 질문권 부족은 메시지와 run을 만들기 전에 409로 반환한다.
- 결제 완료 후 적립 실패는 주문을 완료 상태로 유지하고 fulfillment를 재시도한다.
- Workflow 중복 실행은 `user_message_id`와 run 상태로 차단한다.
- 일부 델타가 중복 저장되어도 `(run_id, seq)`와 `replace` 이벤트로 화면을 정정한다.
- SSE 오류는 답변 실패로 간주하지 않는다. DB 상태를 다시 조회하고 연결만 복구한다.
- 영구 실패 환원이 실패하면 run의 `credit_status`를 `refund_pending`으로 남기고 재처리한다.
- AI 원문 오류나 내부 스택은 사용자에게 노출하지 않고 추적 가능한 run ID를 표시한다.

## 확장과 이식 경계

Vercel 안에서는 Functions가 수평 확장하고 Queue가 급증 트래픽을 완충한다. 애플리케이션 인스턴스 메모리에 세션, 잔액, 대화 상태를 두지 않으므로 sticky session이 필요 없다.

다음 인터페이스를 분리해 둔다.

- `WorkflowRunner`: 시작, 상태 조회, 재시도
- `AgentModel`: 스트리밍 생성과 도구 호출
- `ChatRepository`: 대화, 메시지, 이벤트 저장
- `EntitlementService`: 구매 적립, 예약, 확정, 환원

지속적인 수천 SSE 연결, 한 단계 800초 초과 작업, 자체 모델이나 GPU, Beta 기능 제외 요구, 고정비가 더 유리한 지속 부하가 생기면 `WorkflowRunner`만 컨테이너 Worker와 일반 Queue로 교체한다. 프론트 API 계약과 Supabase 데이터는 유지한다.

## 구현 단계

한 번에 전체를 바꾸지 않고 독립적으로 검증 가능한 세 계획으로 실행한다.

1. **백엔드 분리와 내구 실행 기반**: 모노레포 이동, 두 Vercel 프로젝트, gateway, 공통 인증, Workflow/Queue, 환경변수와 배포 검증
2. **챗봇 상품과 Agent**: 스키마, 주문 fulfillment, 질의응답권 RPC, Agent Workflow, SSE API, 챗 UI
3. **기존 추가상담 복구**: `followup_requests`, 결제 후 Workflow, 상태 목록, 주문 상세 연결, 장애 복구

각 단계는 이전 기능을 깨지 않고 `main`에서 배포 가능해야 한다. 백엔드 분리는 기존 API 계약 테스트가 통과한 뒤 웹의 API base를 전환하고, 전환 전 기존 API를 제거하지 않는다.

## 검증 기준

- 웹 Vercel 프로젝트 산출물에는 서버 함수와 비밀키가 포함되지 않는다.
- API Vercel 프로젝트는 기존 API 계약과 인증 쿠키 동작을 유지한다.
- 두 프로젝트가 같은 `main` 푸시에서 독립적으로 Production 배포된다.
- 챗봇 상품 결제는 정확한 질문 수를 주문번호 기준 한 번만 적립한다.
- 질문 동시 전송에서도 잔액이 음수가 되지 않고 질문 하나당 정확히 1건만 예약된다.
- 정상 답변은 예약을 사용 완료로 만들고, 영구 실패는 정확히 1건을 환원한다.
- Agent는 선택 리포트와 현재 대화 외의 데이터나 외부 정보에 접근할 수 없다.
- SSE가 끊겨도 재연결 후 중복 없이 이어지고 최종 답변이 서버에 남는다.
- 페이지 이동과 새 배포 중에도 Workflow가 완료되며 대화방에서 답변을 찾을 수 있다.
- 기존 추가상담은 990원 단건 상품으로 유지되고 챗봇 잔액이나 대화방에 섞이지 않는다.
- 추가상담 결제 후 페이지를 나가도 요청 상태와 최종 답변을 다시 찾을 수 있다.
- 기존 리포트 생성, 포인트 결제, 토스 결제, 무료운세, 관리자 기능 테스트가 계속 통과한다.
- 스키마 마이그레이션은 빈 DB와 기존 운영 DB에서 모두 반복 실행 가능하다.

## 범위에서 제외

- 외부 웹 검색과 외부 지식 도구
- 여러 리포트를 한 대화방에서 합쳐 분석하는 기능
- 선택 리포트의 만세력을 다시 계산하거나 내용을 수정하는 기능
- 음성 대화, 파일 첨부, 상담사 연결
- 자체 LLM 또는 GPU 서버 운영
- 기존 추가상담을 챗봇 상품으로 자동 전환하는 기능
