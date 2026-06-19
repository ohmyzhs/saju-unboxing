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
  ai_model text default 'gpt-5.4-mini',
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

-- ─────────────────────────────────────────────────────
-- 2) 인덱스
-- ─────────────────────────────────────────────────────
create index if not exists idx_orders_created     on orders(created_at desc);
create index if not exists idx_events_at           on events(at desc);
create index if not exists idx_events_visitor      on events(visitor_id);
create index if not exists idx_analyses_created    on analyses(created_at desc);
create index if not exists idx_profiles_user       on profiles(user_id);
create index if not exists idx_user_data_user_kind on user_data(user_id, kind);

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

-- ─────────────────────────────────────────────────────
-- 4) 설정 단일 행 보장
-- ─────────────────────────────────────────────────────
insert into site_config (id) values (1) on conflict (id) do nothing;

-- 끝. (이미지 업로드용 Storage 버킷 'site-images' 는 앱이 자동 생성하므로 별도 SQL 불필요)
-- RLS가 필요하면: alter table <테이블> enable row level security; + 정책 직접 추가.
