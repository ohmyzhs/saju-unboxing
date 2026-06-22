# 사주언박싱-mini (가맹점 템플릿)

귀여운 웹툰풍 "운박사" 캐릭터의 모바일 사주 서비스입니다.
**자체 만세력 계산 + AI 해설 + 카카오·이메일 로그인 + 포인트·토스 결제 + 관리자 통계**가 들어 있고,
각 가맹점이 자기 Vercel·Supabase 계정으로 독립 운영하도록 설계됐습니다.

## 빠른 시작

👉 **완전초보용 단계별 가이드는 [SETUP.md](SETUP.md)** 를 보세요. (5분 셋업)

```powershell
npm install
npm i -g vercel
# .env 의 위쪽 6칸(시크릿)만 채운 뒤:
vercel dev
```

- 사용자 화면: http://localhost:3000
- 설정 점검: http://localhost:3000/setup  ← 연결 상태 ✅/❌
- 관리자: http://localhost:3000/admin

## 구조

```
index.html / app.js / styles.css   사용자 화면 (정적)
admin.html / admin.js              관리자 페이지 (로그인·상품·프롬프트·이미지·통계)
setup.html                         설정 점검 페이지
api/                               Vercel 서버리스 함수
  saju/analyze.js                  자체 만세력 계산 → AI 해설
  orders.js, payments/confirm.js   포인트·토스 결제 (Supabase 주문 저장)
  auth/kakao/*, logout.js          카카오 로그인 (Supabase 세션)
  admin/*                          로그인·설정저장·이미지업로드·통계
  track.js, config.js, session.js, health.js
  _lib/                            공용 모듈 (supabase, openai, toss, kakao, 통계)
supabase/schema.sql                Supabase에 1회 실행하는 스키마
.env                               시크릿 키 입력 (gitignore됨)
```

## 데이터 흐름

1. 고객이 프로필 입력 → 포인트 또는 토스 결제 → 승인된 주문만 분석 진행.
2. `/api/saju/analyze`가 한국표준시 기준 자체 만세력 엔진으로 실제 사주 원국과 상세 데이터를 계산.
3. 그 결과 + 가맹점이 어드민에서 편집한 프롬프트로 AI가 해설 생성.
4. 결과는 Supabase 보관함에 저장, 방문·매출은 관리자 통계로 집계.

## 회원 포인트

- `1pt = 1원`
- 5,000원 충전 → 6,000pt, 10,000원 → 13,000pt, 20,000원 → 30,000pt
- 로그인 회원은 전액 포인트 또는 포인트+토스 혼합 결제를 사용할 수 있습니다.
- 관리자는 `/admin`의 `회원 포인트` 탭에서 잔액 조정과 무료운세 재생성 토큰 부여가 가능합니다.
- 기능 활성화 전 Supabase SQL Editor에서 최신 `supabase/schema.sql` 전체를 실행해야 합니다.

자세한 설계는 강의자료와 SETUP.md를 참고하세요.
