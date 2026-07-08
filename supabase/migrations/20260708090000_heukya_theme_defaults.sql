-- 흑야/조선 미스터리 테마 기본값.
-- 기존 운영 site_config가 예전 상품명/이미지 URL을 들고 있으면
-- 새 정적 코드보다 DB 설정이 우선되어 옛 화면이 계속 노출되므로,
-- 테마 전환 대상 키만 멱등하게 갱신한다.

insert into public.site_config (id) values (1)
on conflict (id) do nothing;

update public.site_config
set
  branding = coalesce(branding, '{}'::jsonb) || jsonb_build_object(
    'siteName', '흑야 사주언박싱'
  ),
  products = coalesce(products, '{}'::jsonb) || jsonb_build_object(
    'saju-analysis', jsonb_build_object(
      'name', '흑야 사주 비망록',
      'amount', 990,
      'description', '봉인된 사주의 함을 열어 기질, 재물, 직업, 인연의 결을 정중한 사극체로 고하오.'
    ),
    'compatibility', jsonb_build_object(
      'name', '인연궁 합서',
      'amount', 990,
      'description', '두 사람 사이에 흐르는 끌림과 어긋남을 궁궐의 등불 아래 차분히 풀어드리오.'
    ),
    'cycle', jsonb_build_object(
      'name', '십년운 궁궐도',
      'amount', 990,
      'description', '십 년마다 바뀌는 운의 문과 돌아서야 할 회랑을 지도처럼 펼쳐 보이오.'
    ),
    'mz-dark-mudang-online', jsonb_build_object(
      'name', '흑야 온라인 사주첩',
      'amount', 9900,
      'description', '젊은 군주 강무영의 흑금 세계관으로 펼치는 온라인뷰 전용 프리미엄 사주첩이오.'
    ),
    'yearly-fortune', jsonb_build_object(
      'name', '한 해의 왕명',
      'amount', 990,
      'description', '선택한 해의 총운과 계절별 징조, 달마다 조심할 문턱을 고하오.'
    ),
    'daily-fortune', jsonb_build_object(
      'name', '오늘의 흑야 전갈',
      'amount', 0,
      'description', '궁궐 새벽에 먼저 도착한 하루의 기운을 간결히 고하오.'
    ),
    'followup', jsonb_build_object(
      'name', '흑야 문답',
      'amount', 990,
      'description', '이미 받은 사주첩을 두고 더 궁금한 대목을 묻거든, 그 근거 안에서 다시 고하오.'
    )
  ),
  images = coalesce(images, '{}'::jsonb) || jsonb_build_object(
    'banner.hero', '/assets/generated/banners/heukya-hero.jpg',
    'thumb.saju-analysis', '/assets/generated/thumbnails/heukya-saju-reading.jpg',
    'thumb.compatibility', '/assets/generated/thumbnails/heukya-compatibility.jpg',
    'thumb.cycle', '/assets/generated/thumbnails/heukya-fortune-cycle.jpg',
    'thumb.mz-dark-mudang-online', '/assets/generated/thumbnails/heukya-dark-mudang.jpg',
    'thumb.yearly-fortune', '/assets/generated/thumbnails/heukya-year-wheel.jpg'
  ),
  updated_at = now()
where id = 1;

notify pgrst, 'reload schema';
