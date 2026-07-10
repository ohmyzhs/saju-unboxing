-- 이메일 회원 프로필 확장 + 비공개 1:1 문의 게시판
create extension if not exists pgcrypto;

alter table users add column if not exists phone text;
alter table users add column if not exists terms_accepted_at timestamptz;
create unique index if not exists users_phone_unique on users(phone) where phone is not null and phone <> '';

create table if not exists support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_nickname text,
  contact_email text,
  contact_phone text,
  category text not null default 'general' check (category in ('error', 'refund', 'general')),
  title text not null check (char_length(title) between 2 and 80),
  content text not null check (char_length(content) between 10 and 3000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'answered', 'closed')),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table support_inquiries add column if not exists id uuid default gen_random_uuid();
alter table support_inquiries add column if not exists user_id text;
alter table support_inquiries add column if not exists user_nickname text;
alter table support_inquiries add column if not exists contact_email text;
alter table support_inquiries add column if not exists contact_phone text;
alter table support_inquiries add column if not exists category text default 'general';
alter table support_inquiries add column if not exists title text;
alter table support_inquiries add column if not exists content text;
alter table support_inquiries add column if not exists status text default 'received';
alter table support_inquiries add column if not exists answer text;
alter table support_inquiries add column if not exists answered_at timestamptz;
alter table support_inquiries add column if not exists created_at timestamptz default now();
alter table support_inquiries add column if not exists updated_at timestamptz default now();

create index if not exists support_inquiries_user_created_idx on support_inquiries(user_id, created_at desc);
create index if not exists support_inquiries_status_created_idx on support_inquiries(status, created_at desc);

notify pgrst, 'reload schema';
