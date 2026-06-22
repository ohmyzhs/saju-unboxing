# 리포트 소셜 공유 설계

## 목표

생성된 사주 리포트를 로그인 없이 누구나 볼 수 있는 공개 URL로 공유한다.
카카오톡·X·페이스북 등 소셜에 공유할 수 있고, 카카오톡·페이스북에서는
링크 미리보기(OG)가 리치하게 노출된다. 공유 진입점은 리포트 화면 하단에 둔다.

대상 리포트: 단일 인물 리포트(기본 사주·대운·연도운)와 궁합. 무료 일일운세는
범위 밖(별도 화면).

## 데이터 모델

`shared_reports` 테이블 한 개를 추가한다(`schema.sql`, idempotent).

- `token` text primary key — 추측 불가능한 랜덤 토큰(`randomBytes(9).base64url`, ~12자)
- `product_id` text — 상품 구분(표시·통계용)
- `payload` jsonb not null — 공유 시점의 리포트 스냅샷
- `created_at` timestamptz default now()

`payload` 는 렌더에 필요한 최소 항목만 담는다: `productId`, `productName`,
`profileName`, `headline`, `sections[{icon,title,body}]`(최대 24개),
`lucky`(있으면), `score`/`scoreLabel`(궁합).

스냅샷 방식을 택한 이유: 원본 `analyses` 행과의 결합·권한을 신경 쓰지 않고,
공유한 그 시점의 내용을 그대로 고정 노출하기 위함이다.

## 엔드포인트 (`api/share.js`)

단일 서버리스 함수가 두 메서드를 처리한다.

- **POST /api/share** — 프론트가 현재 리포트 페이로드를 보낸다. 검증 후
  토큰 생성·저장하고 `{ ok, token, url }` 을 반환한다. `headline` 과 비어 있지
  않은 `sections` 가 없으면 400. Supabase 미설정이면 503.
- **GET /api/share?token=…** — 토큰으로 페이로드를 조회해 **OG 메타가 포함된
  공개 HTML** 을 직접 반환한다(로그인·세션 불필요, `Cache-Control: public,
  max-age=300`). 토큰이 없거나 행이 없으면 404 HTML.

`vercel.json` 에 `"/share/(.*)" → "/api/share?token=$1"` rewrite 를 추가해
사용자·크롤러가 `/share/<token>` 로 접근하게 한다.

## 공개 페이지와 OG

GET 응답 HTML은 SPA에 의존하지 않는 자급 페이지다(자체 인라인 CSS).

- `<head>`: `og:type/title/description/image/url` + `twitter:card=summary_large_image`.
  - 제목 = `"{이름}님의 {상품명}"`, 설명 = 첫 섹션 본문 110자, 이미지 = 사이트
    배너(`/assets/generated/banners/hero-lab.jpg`, 절대 URL).
- 본문: 헤드라인 + (궁합이면 점수) + 섹션 아코디언(기본 펼침) + "나도 보기" CTA.
- 모든 사용자 영향 문자열은 HTML 이스케이프한다(LLM 생성물 주입 방지).

## 공유 버튼 (리포트 하단)

리포트 렌더 시 마지막 리포트를 보관(`lastReport`)하고 하단 공유 영역을 노출한다.
버튼 클릭 시 처음 한 번만 POST로 공유 URL을 생성·캐시(`lastShareUrl`)한다.

- **링크 복사**: `navigator.clipboard`.
- **X**: `twitter.com/intent/tweet?text=…&url=…` (키 불필요).
- **페이스북**: `facebook.com/sharer/sharer.php?u=…` (키 불필요, OG 의존).
- **카카오톡**: Kakao JS SDK `Kakao.Share.sendDefault`(feed). JS 앱키는
  `/api/config` 의 `kakaoJsKey`(어드민 `config.kakaoJsKey` 또는 `KAKAO_JS_KEY`)
  에서 받는다. SDK는 필요 시 동적 로드한다. **키가 없으면 링크 복사로 폴백**한다.

## 오류 처리

- 공유 링크 생성 실패·만료: 사용자에게 한국어 상태 메시지, 그 외 동작 유지.
- Supabase 미설정: POST 503(공유 비활성), 기존 리포트 열람은 영향 없음.
- 카카오 SDK 로드·전송 실패: 링크 복사 폴백.
- 운영 응답에 내부 스택·민감 설정 비노출.

## 범위 밖

- 공유 링크 만료·삭제·조회수 통계.
- 동적 OG 이미지 생성(현재는 고정 배너 이미지).
- 무료 일일운세 공유, 비공개(인증) 공유.
- 카카오 외 메신저 전용 SDK.

## 검증 기준

- POST가 토큰·URL을 반환하고 `shared_reports` 에 1행 저장.
- `/share/<token>` 가 OG 메타와 섹션을 포함한 200 HTML을 반환, 없는 토큰은 404.
- 비로그인 브라우저에서 공유 페이지 열람 가능.
- X·페이스북 공유는 키 없이 동작, 카카오는 키 설정 시 SDK·미설정 시 링크 복사.
- JavaScript 문법 검사와 전체 자동화 테스트 통과.

## 배포 후 필요

- `schema.sql` 의 `shared_reports` 적용(미적용 시 POST 500).
- 카카오 공유를 쓰려면 카카오 JavaScript 앱키 설정.
