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

revoke all on function adjust_points(text, integer, text, text) from public;
revoke all on function adjust_regen_tokens(text, integer) from public;
grant execute on function adjust_points(text, integer, text, text) to service_role;
grant execute on function adjust_regen_tokens(text, integer) to service_role;

-- ─────────────────────────────────────────────────────
-- 5) 설정 단일 행 보장
-- ─────────────────────────────────────────────────────
insert into site_config (id) values (1) on conflict (id) do nothing;

-- 끝. (이미지 업로드용 Storage 버킷 'site-images' 는 앱이 자동 생성하므로 별도 SQL 불필요)
-- RLS가 필요하면: alter table <테이블> enable row level security; + 정책 직접 추가.
