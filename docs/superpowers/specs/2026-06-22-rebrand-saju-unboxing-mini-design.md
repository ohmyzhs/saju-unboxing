# 리브랜딩: 사주연구소 → 사주언박싱-mini

## 목표

사이트 전체 브랜드명을 "사주연구소"에서 "사주언박싱-mini"로 교체한다.
사용자에게 보이는 모든 표기(타이틀·메타데이터·OG·워드마크·로고·결제 표기·
약관/문서)를 일관되게 바꾼다.

## 범위

`사주연구소` 문자열을 `사주언박싱-mini` 로 전역 치환한다.

- 프론트: `public/index.html`(`<title>`·OG/meta·워드마크·배너 h1·aria),
  `public/admin.html`(타이틀·Admin 워드마크), `public/setup.html`,
  `public/app.js`, `public/admin.js`.
- 자산: `public/assets/ui/logo.svg`(텍스트).
- 서버: `api/share.js`(공유 페이지 OG·푸터), `api/_lib/toss.js`(결제 orderName).
- 문서: `README.md`, `CONCEPT.md`, `SETUP.md`, 강의자료.

## 결정

- 표기는 정확히 `사주언박싱-mini`(하이픈 포함, mini 소문자).
- `package.json` 의 `name`(`saju-research-lab`)은 내부 패키지 식별자이며 화면에
  노출되지 않으므로 변경하지 않는다.
- `logo.svg` 는 현재 화면에 노출되는 로고 표시 영역이 없어 텍스트만 교체하고
  레이아웃(폰트 크기 등)은 조정하지 않는다. 실제 로고 노출이 생기면 그때
  맞춤 조정한다.
- favicon·OG용 비트맵 이미지(jpg)는 텍스트 교체가 불가하므로 이번 범위 밖이며,
  새 로고 이미지가 준비되면 별도 교체한다.

## 검증 기준

- 코드·문서·SVG에 잔여 `사주연구소` 0건.
- JavaScript 문법 검사 통과.
- 사용자 화면 타이틀·워드마크·공유 OG·결제 표기에 새 브랜드 노출.

## 범위 밖

- 로고/파비콘 비트맵 이미지 리디자인.
- 영문 브랜드명·도메인 변경.
