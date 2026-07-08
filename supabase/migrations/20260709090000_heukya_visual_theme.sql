-- 흑야(HEUKYA) 조선 미스터리 비주얼 테마 v3 — "여명(黎明) 흑야".
-- 정책: 사이트명·상품명·상품 설명은 기존(사주언박싱-mini) 그대로 유지하고
-- 이미지(스킨)만 흑야 테마로 교체한다. 리포트 문체(사극 하오체)는 코드 프롬프트에서 처리.
--
-- 한 번 배포됐던 20260708090000_heukya_theme_defaults.sql 이 운영 DB의
-- site_config 에 흑야 상품명을 심어 두었을 수 있으므로, 상품명/브랜딩을
-- 원래 값으로 되돌리는 것까지 포함해 멱등하게 정리한다.

insert into public.site_config (id) values (1)
on conflict (id) do nothing;

update public.site_config
set
  branding = coalesce(branding, '{}'::jsonb) || jsonb_build_object(
    'siteName', '사주언박싱-mini'
  ),
  products = coalesce(products, '{}'::jsonb) || jsonb_build_object(
    'saju-analysis', jsonb_build_object(
      'name', '기본 사주 리포트',
      'amount', 990,
      'description', '만세력, 타고난 성향, 직업운, 재물운, 관계 흐름을 긴 호흡의 리포트로 정리합니다.'
    ),
    'compatibility', jsonb_build_object(
      'name', '관계 궁합 분석',
      'amount', 990,
      'description', '두 사람의 끌림, 충돌 지점, 대화 방식과 오래 가는 방법을 관계 중심으로 풀어냅니다.'
    ),
    'cycle', jsonb_build_object(
      'name', '대운의 흐름',
      'amount', 990,
      'description', '10년 단위 운의 전환점과 준비 구간, 기회와 위기를 타임라인으로 풀어드립니다.'
    ),
    'mz-dark-mudang-online', jsonb_build_object(
      'name', 'MZ다크무당 사주 리포트',
      'amount', 9900,
      'description', 'saju-web의 MZ다크무당 테마로 제작되는 온라인뷰 전용 프리미엄 사주 리포트입니다.'
    ),
    'yearly-fortune', jsonb_build_object(
      'name', '연도별 운세',
      'amount', 990,
      'description', '특정 연도의 총운과 계절별 흐름, 조심할 타이밍과 행동 조언을 미리 짚습니다.'
    ),
    'daily-fortune', jsonb_build_object(
      'name', '오늘의 무료운세',
      'amount', 0,
      'description', '오늘 하루의 분위기, 일정, 마음가짐, 작은 선택 포인트를 짧고 실용적으로 정리합니다.'
    ),
    'followup', jsonb_build_object(
      'name', '질문 1회권',
      'amount', 990,
      'description', '이미 받은 분석의 만세력을 그대로 활용해, 더 궁금한 점 하나에 깊이 있는 답을 드립니다.'
    )
  ),
  images = coalesce(images, '{}'::jsonb) || jsonb_build_object(
    'banner.hero', '/assets/generated/banners/heukya-premium-hero.jpg',
    'thumb.saju-analysis', '/assets/generated/thumbnails/heukya-premium-saju-reading.jpg',
    'thumb.compatibility', '/assets/generated/thumbnails/heukya-premium-compatibility.jpg',
    'thumb.cycle', '/assets/generated/thumbnails/heukya-premium-fortune-cycle.jpg',
    'thumb.mz-dark-mudang-online', '/assets/generated/thumbnails/heukya-premium-dark-mudang.jpg',
    'thumb.yearly-fortune', '/assets/generated/thumbnails/heukya-premium-year-wheel.jpg'
  ),
  updated_at = now()
where id = 1;

notify pgrst, 'reload schema';
