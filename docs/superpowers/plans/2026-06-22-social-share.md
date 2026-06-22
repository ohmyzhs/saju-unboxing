# 리포트 소셜 공유 구현 플랜

설계: `docs/superpowers/specs/2026-06-22-social-share-design.md`

## 작업 1 — 데이터·라우팅 기반

1. `supabase/schema.sql` 에 `shared_reports`(token PK, product_id, payload jsonb,
   created_at) 테이블 추가. idempotent(`create table if not exists`).
2. `vercel.json` rewrites 에 `{ "/share/(.*)" → "/api/share?token=$1" }` 추가.
3. 검증: `node --check` 통과, `vercel.json` 파싱 가능.

## 작업 2 — 공유 엔드포인트 `api/share.js`

1. POST: 페이로드 검증(headline·sections 필수) → `randomBytes(9).base64url`
   토큰 → `shared_reports` insert → `{ ok, token, url }`. DB 없으면 503.
2. GET: 토큰 조회 → 없으면 404 HTML → 있으면 OG 메타 + 섹션 렌더 HTML(200,
   `Cache-Control` 300s). `loadSiteConfig().kakaoJsKey` 또는 env 로 카카오 키 주입.
3. 모든 사용자 영향 문자열 HTML 이스케이프.
4. 검증: 함수 로드(default export), 목 페이로드로 HTML에 og:title/섹션 포함 확인.

## 작업 3 — 공개 설정 노출

1. `api/config.js` 응답에 `kakaoJsKey`(`config.kakaoJsKey` 또는 `KAKAO_JS_KEY`)
   추가. 비우면 빈 문자열.

## 작업 4 — 프론트 공유 UI

1. `public/index.html` 리포트 하단에 공유 섹션(링크복사/카카오/X/페북 버튼 +
   상태 표시) 추가, 기본 `hidden`.
2. `public/app.js`:
   - 모듈 상태 `lastReport`, `lastShareUrl`.
   - `renderAnalysisResult` 끝에서 `lastReport` 저장 + 공유 섹션 노출.
   - `ensureShareUrl()`(POST 1회 캐시), `shareReport(platform)`,
     `shareKakao(url,title)`(JS SDK 동적 로드·키 없으면 링크 복사 폴백).
   - 공유 영역 클릭 위임 리스너.
3. `public/styles.css` 에 `.report-share` 스타일.
4. 검증: `node --check public/app.js`, 전체 테스트.

## 작업 5 — 완료

1. 전체 자동화 테스트 통과 확인.
2. 배포 후 운영 작업 문서화: `shared_reports` 적용, 카카오 JS 앱키 설정.

## 미해결/후속

- `shared_reports` 테이블은 DDL이라 코드로 자동 생성 불가 → 배포 시 SQL 적용 필요.
- 동적 OG 이미지·만료·조회수는 범위 밖.
