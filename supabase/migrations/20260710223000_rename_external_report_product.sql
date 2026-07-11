-- 외부 심층 리포트 상품명에서 내부 테마/등급 표현을 제거한다.
update site_config
set products = jsonb_set(
  coalesce(products, '{}'::jsonb),
  '{mz-dark-mudang-online,name}',
  to_jsonb('운명 완전개봉'::text),
  true
),
updated_at = now()
where id = 1;

notify pgrst, 'reload schema';
