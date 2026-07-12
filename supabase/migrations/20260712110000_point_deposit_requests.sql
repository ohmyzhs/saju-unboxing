-- 무통장입금(계좌이체) 포인트 충전:
-- 사용자가 입금 신청 → 관리자가 은행 입금 확인 후 승인 → 포인트 지급.
-- 승인 시점에만 point_transactions(adjust_points RPC)로 원장 기록을 남긴다.

create table if not exists point_deposit_requests (
  id text primary key,
  user_id uuid not null,
  amount int not null,
  points int not null,
  bonus int not null,
  depositor_code text not null,
  phone text not null,
  status text not null default 'awaiting_deposit',
  expires_at timestamptz not null,
  confirmed_by text,
  confirmed_at timestamptz,
  memo text,
  notify_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists point_deposit_requests_status_idx
  on point_deposit_requests (status, created_at desc);
create index if not exists point_deposit_requests_user_idx
  on point_deposit_requests (user_id, created_at desc);

-- 입금 계좌 정보는 관리자에서 수정 가능하게 site_config에 저장한다.
alter table site_config add column if not exists bank_transfer jsonb;

notify pgrst, 'reload schema';
