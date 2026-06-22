-- =====================================================
-- 사주연구소 가맹점 — Supabase 스키마 (한 번에 실행)
-- 👉 Supabase 대시보드 > SQL Editor > New query > 이 파일 "전체" 붙여넣고 RUN
-- ✅ 여러 번 돌려도 안전합니다 (있으면 건너뛰고, 없으면 추가 — 데이터 안 지워짐)
-- 가맹점 1명 = Supabase 프로젝트 1개. 서버리스 함수가 service_role 키로만 접근 → RLS 미사용(단순화).
-- =====================================================

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────
-- 1) 테이블 (새 DB는 여기서 전부 생성)
-- ─────────────────────────────────────────────────────

-- [1] 사이트 설정 — 단일 행(id=1). 상품/프롬프트/이미지/브랜딩/약관/사업자/만세력키/관리자비번.
create table if not exists site_config (
  id int primary key default 1,
  products jsonb default '{}'::jsonb,   -- { "saju-analysis": {name, amount, description}, ... }
  prompts  jsonb default '{}'::jsonb,   -- 상품별 추가지침(선택)
  images   jsonb default '{}'::jsonb,   -- { "banner.hero": "url", "thumb.xxx": "url", ... }
  branding jsonb default '{}'::jsonb,   -- { siteName, ... }
  legal    jsonb default '{}'::jsonb,   -- { terms, privacy, refund } (비우면 기본문구)
  business jsonb default '{}'::jsonb,   -- { name, owner, regNo, mailOrderNo, address, tel, email, privacyOfficer }
  saju     jsonb default '{}'::jsonb,   -- { base, key, productCode } 만세력 API 접속정보(어드민 입력, env 대체)
  ai_model text default 'glm-5.2',
  admin_password_hash text,             -- sha256(비번). 미설정 시 ADMIN_PASSWORD env 사용
  updated_at timestamptz default now(),
  constraint site_config_singleton check (id = 1)
);

-- [2] 주문/결제 (user_* = 로그인 계정 식별: 고객 관리용)
create table if not exists orders (
  id text primary key,                  -- 숫자 주문번호
  product_id text,
  profile_name text,                    -- 분석 대상자 이름
  amount integer not null default 0,
  status text default 'READY',
  toss_payment_key text,
  visitor_id text,
  session_id text,
  user_id text,                         -- 로그인 계정 id (게스트는 비움)
  user_label text,                      -- 카카오 닉네임 또는 이메일 주소
  user_provider text,                   -- 'kakao' | 'email'
  created_at timestamptz default now(),
  approved_at timestamptz
);

-- [3] 방문/행동 이벤트 (통계 원천)
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  event text, page text, view text,
  visitor_id text, session_id text,
  referrer text, utm jsonb, device jsonb, metadata jsonb,
  duration_ms integer, ip text, user_agent text,
  at timestamptz default now()
);

-- [4] 분석 결과(보관함). ※ 1개월 후 자동삭제는 앱(서버 코드)이 처리.
create table if not exists analyses (
  id uuid primary key default uuid_generate_v4(),
  product_id text,
  profile_name text,
  manse jsonb, summary jsonb, headline text, sections jsonb, lucky jsonb,
  visitor_id text, order_id text,
  user_id text, user_label text, user_provider text,   -- 로그인 계정 식별
  created_at timestamptz default now()
);

-- [5] 로그인 세션 (카카오/이메일 공통 — kakao_user 컬럼에 사용자 객체 그대로 저장)
create table if not exists sessions (
  id text primary key,
  kakao_user jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- [6] 이메일 로그인 사용자 (비밀번호는 scrypt 해시 salt:hash 로만 저장)
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  nickname text,
  created_at timestamptz default now()
);

-- [7] 사주 인원(프로필) — 로그인 계정별 서버 보관(기기 바뀌어도 따라옴)
create table if not exists profiles (
  id text primary key,
  user_id text not null,
  profile jsonb not null,
  created_at timestamptz default now()
);

-- [8] 보관함·결제내역 등 계정별 데이터 (kind: 'archive' | 'order') — 기기 무관 동기화
create table if not exists user_data (
  user_id text not null,
  kind text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, kind, id)
);

-- [9] 회원 포인트 잔액과 무료운세 재생성 토큰
create table if not exists user_points (
  user_id text primary key,
  balance integer not null default 0 check (balance >= 0),
  regen_tokens integer not null default 0 check (regen_tokens >= 0),
  updated_at timestamptz default now()
);

-- [10] 포인트 변경 감사 로그
create table if not exists point_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  type text not null check (type in ('charge', 'bonus', 'spend', 'refund', 'admin_adjust')),
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  ref text,
  created_at timestamptz default now()
);

-- [9] 공유 리포트 — 공개 URL(/share/<token>)로 누구나 열람. payload 에 리포트 본문 저장.
create table if not exists shared_reports (
  token text primary key,
  product_id text,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- [12] AI 챗봇 질의응답권 잔액과 감사 로그
create table if not exists chat_credit_accounts (
  user_id text primary key,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists chat_credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  type text not null check (type in ('purchase', 'reserve', 'refund', 'admin_adjust')),
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  ref text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, type, ref)
);

-- [13] 선택한 보관함 리포트에 고정된 AI 챗봇 대화
create table if not exists chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  source_archive_id text not null,
  report_snapshot jsonb not null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (user_id, source_archive_id)
);

create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  status text not null default 'queued' check (status in ('queued', 'streaming', 'completed', 'failed')),
  reply_to uuid references chat_messages(id) on delete set null,
  client_request_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (session_id, client_request_id)
);

create table if not exists chat_runs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  user_message_id uuid not null references chat_messages(id) on delete cascade,
  assistant_message_id uuid not null references chat_messages(id) on delete cascade,
  workflow_run_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  credit_status text not null default 'reserved' check (credit_status in ('reserved', 'consumed', 'refund_pending', 'refunded')),
  model text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  usage jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_message_id)
);

create table if not exists chat_stream_events (
  run_id uuid not null references chat_runs(id) on delete cascade,
  seq integer not null check (seq > 0),
  type text not null check (type in ('status', 'delta', 'replace', 'complete', 'error')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, seq)
);

-- ─────────────────────────────────────────────────────
-- 2) 인덱스
-- ─────────────────────────────────────────────────────
create index if not exists idx_orders_created     on orders(created_at desc);
create index if not exists idx_events_at           on events(at desc);
create index if not exists idx_events_visitor      on events(visitor_id);
create index if not exists idx_analyses_created    on analyses(created_at desc);
create index if not exists idx_profiles_user       on profiles(user_id);
create index if not exists idx_user_data_user_kind on user_data(user_id, kind);
create index if not exists idx_point_transactions_user_created on point_transactions(user_id, created_at desc);
create unique index if not exists idx_point_transactions_idempotent
  on point_transactions(user_id, type, ref)
  where ref is not null and type in ('charge', 'bonus', 'spend', 'refund');
create index if not exists idx_chat_credit_transactions_user_created
  on chat_credit_transactions(user_id, created_at desc);
create index if not exists idx_chat_sessions_user_last_message
  on chat_sessions(user_id, last_message_at desc nulls last, created_at desc);
create index if not exists idx_chat_messages_session_created
  on chat_messages(session_id, created_at asc);
create index if not exists idx_chat_runs_session_created
  on chat_runs(session_id, created_at desc);

-- ─────────────────────────────────────────────────────
-- 3) 기존(옛 스키마) DB 보강 — 예전에 테이블을 만든 분만 해당. 새 DB는 위에서 이미 생성돼 무시됨.
-- ─────────────────────────────────────────────────────
alter table site_config add column if not exists legal    jsonb default '{}'::jsonb;
alter table site_config add column if not exists business jsonb default '{}'::jsonb;
alter table site_config add column if not exists saju     jsonb default '{}'::jsonb;
alter table analyses    add column if not exists lucky         jsonb;
alter table orders      add column if not exists user_id       text;
alter table orders      add column if not exists user_label    text;
alter table orders      add column if not exists user_provider text;
alter table analyses    add column if not exists user_id       text;
alter table analyses    add column if not exists user_label    text;
alter table analyses    add column if not exists user_provider text;
alter table orders      add column if not exists points_used integer not null default 0;
alter table orders      add column if not exists pay_method text default 'toss';
alter table orders      add column if not exists fulfillment_status text default 'not_required';
alter table orders      add column if not exists fulfillment_error text;
alter table orders      add column if not exists fulfilled_at timestamptz;

-- ─────────────────────────────────────────────────────
-- 4) 포인트 원자 변경 RPC
-- ─────────────────────────────────────────────────────
create or replace function adjust_points(
  p_user_id text,
  p_delta integer,
  p_type text,
  p_ref text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  next_balance integer;
  existing_balance integer;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception 'invalid_user_id';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_point_delta';
  end if;
  if p_type not in ('charge', 'bonus', 'spend', 'refund', 'admin_adjust') then
    raise exception 'invalid_point_type';
  end if;
  if p_type in ('charge', 'bonus', 'refund') and p_delta < 0 then
    raise exception 'invalid_point_delta_sign';
  end if;
  if p_type = 'spend' and p_delta > 0 then
    raise exception 'invalid_point_delta_sign';
  end if;

  insert into user_points(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select balance into current_balance
  from user_points
  where user_id = p_user_id
  for update;

  if p_ref is not null and p_type in ('charge', 'bonus', 'spend', 'refund') then
    select balance_after into existing_balance
    from point_transactions
    where user_id = p_user_id and type = p_type and ref = p_ref
    limit 1;
    if found then
      return existing_balance;
    end if;
  end if;

  next_balance := current_balance + p_delta;
  if next_balance < 0 then
    raise exception 'insufficient_points';
  end if;

  update user_points
  set balance = next_balance, updated_at = now()
  where user_id = p_user_id;

  insert into point_transactions(user_id, type, amount, balance_after, ref)
  values (p_user_id, p_type, p_delta, next_balance, p_ref);

  return next_balance;
end;
$$;

create or replace function adjust_regen_tokens(
  p_user_id text,
  p_delta integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tokens integer;
  next_tokens integer;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception 'invalid_user_id';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_regen_delta';
  end if;

  insert into user_points(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select regen_tokens into current_tokens
  from user_points
  where user_id = p_user_id
  for update;

  next_tokens := current_tokens + p_delta;
  if next_tokens < 0 then
    raise exception 'insufficient_regen_tokens';
  end if;

  update user_points
  set regen_tokens = next_tokens, updated_at = now()
  where user_id = p_user_id;

  return next_tokens;
end;
$$;

-- ─────────────────────────────────────────────────────
-- 5) 챗봇 질의응답권 원자 변경과 질문 enqueue RPC
-- ─────────────────────────────────────────────────────
create or replace function grant_chat_credits(
  p_user_id text,
  p_amount integer,
  p_order_id text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  next_balance integer;
  existing_balance integer;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception 'invalid_user_id';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_chat_credit_amount';
  end if;
  if nullif(trim(p_order_id), '') is null then
    raise exception 'invalid_order_id';
  end if;

  insert into chat_credit_accounts(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select balance into current_balance
  from chat_credit_accounts
  where user_id = p_user_id
  for update;

  select balance_after into existing_balance
  from chat_credit_transactions
  where user_id = p_user_id and type = 'purchase' and ref = p_order_id
  limit 1;
  if found then
    return existing_balance;
  end if;

  next_balance := current_balance + p_amount;
  update chat_credit_accounts
  set balance = next_balance, updated_at = now()
  where user_id = p_user_id;

  insert into chat_credit_transactions(user_id, type, amount, balance_after, ref, metadata)
  values (p_user_id, 'purchase', p_amount, next_balance, p_order_id, jsonb_build_object('orderId', p_order_id));

  return next_balance;
end;
$$;

create or replace function reserve_chat_credit(
  p_user_id text,
  p_message_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  next_balance integer;
  existing_balance integer;
  message_ref text := p_message_id::text;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception 'invalid_user_id';
  end if;
  if p_message_id is null then
    raise exception 'invalid_message_id';
  end if;

  insert into chat_credit_accounts(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select balance into current_balance
  from chat_credit_accounts
  where user_id = p_user_id
  for update;

  select balance_after into existing_balance
  from chat_credit_transactions
  where user_id = p_user_id and type = 'reserve' and ref = message_ref
  limit 1;
  if found then
    return existing_balance;
  end if;

  if current_balance < 1 then
    raise exception 'insufficient_chat_credits';
  end if;

  next_balance := current_balance - 1;
  update chat_credit_accounts
  set balance = next_balance, updated_at = now()
  where user_id = p_user_id;

  insert into chat_credit_transactions(user_id, type, amount, balance_after, ref)
  values (p_user_id, 'reserve', -1, next_balance, message_ref);

  return next_balance;
end;
$$;

create or replace function refund_chat_credit(
  p_user_id text,
  p_message_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  next_balance integer;
  existing_balance integer;
  reserved_amount integer;
  message_ref text := p_message_id::text;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception 'invalid_user_id';
  end if;
  if p_message_id is null then
    raise exception 'invalid_message_id';
  end if;

  select balance into current_balance
  from chat_credit_accounts
  where user_id = p_user_id
  for update;
  if not found then
    raise exception 'chat_credit_account_not_found';
  end if;

  select amount into reserved_amount
  from chat_credit_transactions
  where user_id = p_user_id and type = 'reserve' and ref = message_ref
  limit 1;
  if not found then
    raise exception 'chat_credit_reservation_not_found';
  end if;

  select balance_after into existing_balance
  from chat_credit_transactions
  where user_id = p_user_id and type = 'refund' and ref = message_ref
  limit 1;
  if found then
    return existing_balance;
  end if;

  next_balance := current_balance + abs(reserved_amount);
  update chat_credit_accounts
  set balance = next_balance, updated_at = now()
  where user_id = p_user_id;

  insert into chat_credit_transactions(user_id, type, amount, balance_after, ref)
  values (p_user_id, 'refund', abs(reserved_amount), next_balance, message_ref);

  return next_balance;
end;
$$;

create or replace function enqueue_chat_message(
  p_user_id text,
  p_session_id uuid,
  p_client_request_id text,
  p_question text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_question text := trim(coalesce(p_question, ''));
  normalized_request_id text := trim(coalesce(p_client_request_id, ''));
  owned_session_id uuid;
  new_user_message_id uuid := uuid_generate_v4();
  inserted_user_message_id uuid;
  assistant_message_id uuid := uuid_generate_v4();
  run_id uuid := uuid_generate_v4();
  existing_assistant_message_id uuid;
  existing_run_id uuid;
  next_balance integer;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception 'invalid_user_id';
  end if;
  if p_session_id is null then
    raise exception 'invalid_chat_session_id';
  end if;
  if char_length(normalized_request_id) < 1 or char_length(normalized_request_id) > 100 then
    raise exception 'invalid_client_request_id';
  end if;
  if char_length(normalized_question) < 1 or char_length(normalized_question) > 1000 then
    raise exception 'invalid_chat_question';
  end if;

  select id into owned_session_id
  from chat_sessions
  where id = p_session_id and user_id = p_user_id and status = 'active'
  for update;
  if not found then
    raise exception 'chat_session_not_found';
  end if;

  insert into chat_messages(id, session_id, role, content, status, client_request_id)
  values (new_user_message_id, p_session_id, 'user', normalized_question, 'completed', normalized_request_id)
  on conflict (session_id, client_request_id) do nothing
  returning id into inserted_user_message_id;

  if inserted_user_message_id is null then
    select r.id, r.assistant_message_id
    into existing_run_id, existing_assistant_message_id
    from chat_messages m
    join chat_runs r on r.user_message_id = m.id
    where m.session_id = p_session_id and m.client_request_id = normalized_request_id
    limit 1;

    select balance into next_balance
    from chat_credit_accounts
    where user_id = p_user_id;

    return jsonb_build_object(
      'runId', existing_run_id,
      'userMessageId', (
        select id from chat_messages
        where session_id = p_session_id and client_request_id = normalized_request_id
        limit 1
      ),
      'assistantMessageId', existing_assistant_message_id,
      'balance', coalesce(next_balance, 0),
      'duplicate', true
    );
  end if;

  insert into chat_messages(id, session_id, role, content, status, reply_to)
  values (assistant_message_id, p_session_id, 'assistant', '', 'queued', new_user_message_id);

  insert into chat_runs(id, session_id, user_message_id, assistant_message_id)
  values (run_id, p_session_id, new_user_message_id, assistant_message_id);

  next_balance := reserve_chat_credit(p_user_id, new_user_message_id);

  update chat_sessions
  set updated_at = now(), last_message_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'runId', run_id,
    'userMessageId', new_user_message_id,
    'assistantMessageId', assistant_message_id,
    'balance', next_balance,
    'duplicate', false
  );
end;
$$;

revoke all on function adjust_points(text, integer, text, text) from public;
revoke all on function adjust_regen_tokens(text, integer) from public;
revoke all on function grant_chat_credits(text, integer, text) from public;
revoke all on function reserve_chat_credit(text, uuid) from public;
revoke all on function refund_chat_credit(text, uuid) from public;
revoke all on function enqueue_chat_message(text, uuid, text, text) from public;
grant execute on function adjust_points(text, integer, text, text) to service_role;
grant execute on function adjust_regen_tokens(text, integer) to service_role;
grant execute on function grant_chat_credits(text, integer, text) to service_role;
grant execute on function reserve_chat_credit(text, uuid) to service_role;
grant execute on function refund_chat_credit(text, uuid) to service_role;
grant execute on function enqueue_chat_message(text, uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────
-- 6) 설정 단일 행 보장
-- ─────────────────────────────────────────────────────
insert into site_config (id) values (1) on conflict (id) do nothing;

-- 끝. (이미지 업로드용 Storage 버킷 'site-images' 는 앱이 자동 생성하므로 별도 SQL 불필요)
-- RLS가 필요하면: alter table <테이블> enable row level security; + 정책 직접 추가.
