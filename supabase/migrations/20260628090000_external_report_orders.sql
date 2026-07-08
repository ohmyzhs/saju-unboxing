-- 흑야 온라인 사주첩 등 외부 온라인뷰 리포트 주문 연동 컬럼
-- Supabase SQL Editor에서 이 파일 전체를 실행해도 안전한 멱등 migration.

alter table orders
  add column if not exists purchase_snapshot jsonb default '{}'::jsonb;

alter table orders
  add column if not exists external_report jsonb default '{}'::jsonb;

alter table orders
  add column if not exists report_status text;

-- PostgREST/Supabase API schema cache 갱신.
notify pgrst, 'reload schema';
