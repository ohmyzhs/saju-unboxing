# 🚀 사주연구소 가맹점 — 설치·배포 가이드

> 코딩을 안 해봐도 **이 순서대로만** 따라 하면 내 사주 사이트가 인터넷에 뜹니다.
> 강의에서 **강사가 한 단계씩 보여주면, 여러분도 같은 화면을 따라** 하시면 됩니다.

---

## 📦 최종 그림 (내가 만들 것)

```
손님 → 내 사이트(예: my-saju.vercel.app)
         ├─ 사주/궁합/대운/연도운/오늘운세/추가질문
         ├─ 카카오·이메일 로그인
         └─ 토스 결제

내 사이트가 쓰는 것들(전부 내 계정):
  · Vercel     → 사이트가 떠 있는 곳(호스팅)
  · GitHub     → 코드 저장소
  · Supabase   → 내 손님 데이터 창고(DB)
  · OpenAI     → AI 해설 두뇌
  · 카카오      → 손님 카카오 로그인(선택)
  · 토스        → 결제(처음엔 테스트, 실영업 때 실연동)
  · 본사 만세력 API → 진짜 사주 계산 (← 본사에서 키 받음)
```

---

## ⭐ 시작 전 약속 2가지

1. **GitHub · Vercel 은 "같은 계정 하나"로** 하세요. (Vercel 가입할 때 **"Continue with GitHub"**) 계정이 섞이면 배포가 막혀요.
2. **비밀 키(secret)는 절대 화면에 띄우거나 카톡으로 보내지 마세요.** 붙여넣을 땐 항상 **"복사 버튼"** 으로.

---

# 👩‍🏫 강의 진행 순서 (이 순서가 제일 안 막힘)

각 단계 끝에 **"여기서 받은 것 → 어디에 쓰는지"** 를 적어놨어요. 받은 값은 메모장에 모아두세요.

| 단계 | 무엇을 | 결과로 얻는 것 |
|---|---|---|
| 1 | **GitHub** 에 코드 내 것으로 복사 | 내 저장소 |
| 2 | **Supabase** 프로젝트 + SQL 실행 | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| 3 | **OpenAI** 키 발급 | `OPENAI_API_KEY` |
| 4 | **본사 만세력 API** 키 받기 | `SAJU_API_BASE`, `SAJU_API_KEY` |
| 5 | **Vercel** 에 배포 (위 값들 입력) | 내 사이트 주소(`...vercel.app`) |
| 6 | **확인** (/setup, /admin) + 관리자 비번 변경 | 작동 확인 |
| 7 | (선택) **카카오 로그인** 연결 | 손님 카카오 로그인 |
| 8 | (선택) **내 도메인** 연결 | `mysaju.com` 같은 주소 |
| 9 | (실영업) **토스 실결제** 신청 | 진짜 결제 |

> 💡 **핵심 순서**: 코드(1) → 키 모으기(2·3·4) → 배포(5). 카카오·도메인·토스는 **사이트가 뜬 다음**에 붙입니다(주소가 있어야 연결돼서).

---

# 1단계. GitHub — 코드를 "내 것"으로 만들기

가장 쉬운 방법 2가지 중 하나:

**방법 A. "Use this template" (제일 쉬움)**
1. github.com 가입(무료)
2. 본사가 알려준 **템플릿 저장소** 페이지 → 초록색 **`Use this template` → `Create a new repository`**
3. 저장소 이름(예: `my-saju`) → **Create** → 끝 (내 계정에 코드가 복사됨)

**방법 B. ZIP 다운로드 → 내 저장소에 올리기**
1. 템플릿 저장소 → `Code ▾` → **Download ZIP** → 압축 풀기
2. github.com → `+` → **New repository** → 이름 입력 → **Create**
3. 안내에 따라 업로드(드래그&드롭도 됨)

> 📌 **받은 것**: 내 GitHub 저장소 (다음 5단계에서 Vercel이 여기서 코드를 가져갑니다)

---

# 2단계. Supabase — 데이터 창고 + SQL

1. supabase.com 가입 → **New Project**
   - 조직/이름 아무거나, **DB 비밀번호는 정해서 메모** (안 쓸 수도 있지만 적어두기)
   - 지역은 **Northeast Asia (Seoul)** 추천
2. 만들어지면(1~2분) → 왼쪽 **`SQL Editor` → `New query`**
3. 내 코드의 **`supabase/schema.sql`** 파일 **전체를 복사 → 붙여넣기 → `RUN`**
   - `Success. No rows returned` 나오면 성공 (여러 번 눌러도 안전)
4. 왼쪽 **`Project Settings`(톱니) → `API`** 에서 2개 복사:
   - **Project URL** → `SUPABASE_URL`
   - **`service_role`** (secret, "Reveal" 눌러서) → `SUPABASE_SERVICE_KEY` ⚠️ 비밀!

> 📌 **받은 것**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
> ⚠️ `service_role` 키는 **절대 공개 금지** (이거 하나로 DB 전체 접근됨)

---

# 3단계. OpenAI — AI 해설 키

1. platform.openai.com 가입 → 결제수단 등록(Billing) — **이게 있어야 AI가 작동**해요(사용한 만큼 과금)
2. **`API keys` → `Create new secret key`** → **복사** (한 번만 보임!)

> 📌 **받은 것**: `OPENAI_API_KEY` (`sk-...`로 시작)
> 💡 모델은 기본 `gpt-5.4-mini`(저렴·충분). 더 좋은 품질 원하면 나중에 `OPENAI_MODEL` 만 바꾸면 됨.

---

# 4단계. 본사 만세력 API — 키 받기

**본사(대표)에게 받습니다:**
- **`SAJU_API_BASE`** = 만세력 서버 주소
- **`SAJU_API_KEY`** = 내 전용 키 (호출할 때마다 본사 포인트가 차감됩니다)

> 📌 **받은 것**: `SAJU_API_BASE`, `SAJU_API_KEY`
> 💡 이게 있어야 **진짜 사주 계산**이 됩니다. (이 두 값은 어드민 「만세력 API」 탭에서 입력·테스트도 가능)

---

# 5단계. Vercel — 배포 (여기서 사이트가 인터넷에 뜸)

1. vercel.com → **"Continue with GitHub"** 로 가입/로그인 (← 1단계 GitHub과 같은 계정!)
2. **`Add New… → Project`** → 내 저장소(`my-saju`) **`Import`**
3. **Configure Project** 에서 ⚠️ **이 3개 꼭 확인**:
   - **Framework Preset** → **`Other`** (제일 중요!)
   - **Build Command** → 비움 (또는 `echo skip`)
   - **Output Directory** → **`public`**
4. **`Environment Variables`** 펼치기 → 아래 **[환경변수 표]** 의 값들을 하나씩 입력
   (이름=Key, 값=Value. 비밀키는 복사 버튼으로 붙여넣기)
   - 최소 필수: `SAJU_API_BASE`, `SAJU_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `ADMIN_PASSWORD`
5. **`Deploy`** → 1~2분 → **`https://내프로젝트.vercel.app`** 주소가 나옴 🎉

> 📌 **받은 것**: 내 사이트 주소 (이걸로 7·8단계 카카오·도메인을 연결)

---

# 6단계. 확인 + 관리자 비밀번호 변경

1. **`https://내주소.vercel.app/setup`** 접속 → 항목이 **✅** 인지 확인 (카카오만 ❌는 정상 — 아직 안 함)
2. 홈 → **사주 인원 관리**에서 사람 추가 → 상품 선택 → (테스트)결제 → **진짜 만세력 + AI 해설** 나오면 성공
3. **`/admin`** 접속 → 기본 비밀번호 **`admin1004`** 로 로그인
   - **「비밀번호」 탭 → 새 비밀번호로 변경** ⚠️ **배포 후 꼭 바꾸기!**
   - (어드민은 로그인 전엔 내용이 안 보입니다)

> 💡 어드민에서 상품명·가격(추가질문 990원 포함)·이미지·사업자정보·약관을 바꿀 수 있어요.

---

# 7단계. (선택) 카카오 로그인 연결

> 손님이 카카오로 로그인하게 합니다. **사이트 주소가 있어야** 연결돼서 배포(5단계) 이후에 해요.

1. developers.kakao.com 가입 → **내 애플리케이션 → 애플리케이션 추가**
2. **앱 키 → REST API 키** 복사 → Vercel 환경변수 `KAKAO_REST_API_KEY` 에 입력
3. **카카오 로그인 → 활성화 ON**
4. **Redirect URI 등록**: `https://내주소.vercel.app/api/auth/kakao/callback`
5. **동의항목 → 닉네임(profile_nickname) → "필수 동의"** 로 설정
   → 이래야 고객 **이름(닉네임)** 이 들어와요. (안 켜면 "카카오 사용자"로만 표시)
6. Vercel에서 **Redeploy** → 로그인 테스트

> ⚠️ **순서 주의**: 동의항목(닉네임)을 **먼저 켜고** 나서 테스트. 안 켠 항목을 요청하면 `KOE205` 에러가 나요.
> 📌 이메일/이름(실명)/연령대 등은 **카카오 "비즈니스 앱"(사업자 인증)** 이 있어야 받을 수 있어요. 전화번호는 카카오로 못 받으니 필요하면 우리 폼에서 직접 받으세요.

---

# 8단계. (선택) 내 도메인 연결

1. 도메인 구입(가비아·후이즈·Cloudflare 등)
2. Vercel → 프로젝트 → **`Settings → Domains`** → 내 도메인 입력 → **Add**
3. Vercel이 알려주는 **DNS 레코드(A/CNAME)** 를 도메인 회사 관리페이지에 등록
4. 몇 분~몇 시간 뒤 연결됨 → 카카오 Redirect URI도 새 도메인으로 바꿔 등록 + Redeploy

---

# 9단계. (실영업) 토스 실결제 연결

처음엔 **테스트 키가 내장**돼 있어 실제 돈 없이 결제 흐름을 연습할 수 있어요. 실제로 돈을 받으려면:

1. 토스페이먼츠 가입 → **전자결제 신청**(사업자등록증 등) → 심사
2. 승인되면 개발자센터에서 **"결제위젯 연동 키"** 의 **클라이언트 키 / 시크릿 키** 발급
   ⚠️ "API 개별 연동(결제창) 키"가 아니라 **"결제위젯" 키** 여야 인라인 결제창이 떠요.
3. Vercel 환경변수에 `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` 입력 → Redeploy
4. 결제수단/디자인은 토스 어드민에서 노코드로 설정 → (선택) `TOSS_VARIANT_KEY` 로 연결

---

# 🔑 환경변수 표 (Vercel에 넣는 값)

> 📁 내 코드의 **`.env.example`** 파일에도 같은 설명이 있어요. 헷갈리면 그 파일을 보세요.

### 꼭 채우는 것
| 변수 | 값 | 어디서 |
|---|---|---|
| `SAJU_API_BASE` | 만세력 서버 주소 | 본사(4단계) |
| `SAJU_API_KEY` | 내 전용 만세력 키 | 본사(4단계) |
| `SUPABASE_URL` | Project URL | Supabase(2단계) |
| `SUPABASE_SERVICE_KEY` | service_role 키 🔒 | Supabase(2단계) |
| `OPENAI_API_KEY` | `sk-...` 🔒 | OpenAI(3단계) |
| `ADMIN_PASSWORD` | 관리자 로그인 비번 | 내가 정함(비우면 `admin1004`) |

### 사업자 정보 (토스 심사·하단 표기용 — 어드민에서 입력해도 됨)
`BUSINESS_NAME`, `BUSINESS_OWNER`, `BUSINESS_REG_NO`, `BUSINESS_MAILORDER_NO`, `BUSINESS_ADDRESS`, `BUSINESS_TEL`, `BUSINESS_EMAIL`

### 선택 (비워도 작동)
| 변수 | 설명 |
|---|---|
| `KAKAO_REST_API_KEY` | 카카오 로그인(7단계). 비우면 카카오 로그인만 꺼짐 |
| `OPENAI_MODEL` | 기본 `gpt-5.4-mini`. 더 좋은 모델로 바꾸려면 |
| `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 실결제(9단계). 비우면 테스트 결제 |
| `TOSS_VARIANT_KEY` | 토스 어드민 결제 UI 키(선택) |
| `BASE_URL` | 내 사이트 주소(배포 후 넣으면 더 정확) |

---

# 🔧 자주 막히는 것 (해결법)

| 증상 | 해결 |
|---|---|
| 사이트 전체 **500 / "Serverless Function crashed"** | Vercel `Settings` → **Framework Preset=`Other`**, **Output Directory=`public`** → Redeploy |
| **"commit author did not have access"** 배포 차단 | GitHub·Vercel을 **같은 계정**으로. 또는 저장소를 **Public** 으로 |
| 빌드 **"No more than 12 Serverless Functions … Hobby"** | 함수는 **최대 12개** (현재 12개). 직접 추가했다면 줄이기 |
| `/setup` 에서 **Supabase ❌** | URL/키 오타 or `supabase/schema.sql` **RUN** 안 함 |
| 고객 이름이 **"카카오 사용자"** | 카카오 **동의항목 닉네임 "필수 동의"** 켜고 다시 로그인(7단계 5번) |
| 카카오 **KOE205** | 동의항목을 **먼저 켜고** 로그인. 안 켠 항목 요청 금지 |
| 분석 시 **"포인트 부족"** | 본사에 포인트 충전 요청 |
| AI 해설이 안 나옴 | OpenAI **결제수단 등록** 했는지, `OPENAI_API_KEY` 맞는지 |

> 막히면 **에러 메시지를 복사해서 클로드 코드에게 "이 에러 고쳐줘"** 라고 하세요. 대부분 바로 해결됩니다.

---

# 🔒 배포 전 보안 체크 (수강생 필수)

- [ ] `/admin` 비밀번호를 **`admin1004`에서 변경**했다
- [ ] `service_role`·`OPENAI_API_KEY`·`SAJU_API_KEY` 를 **카톡/화면에 노출 안 함**
- [ ] `.env` 파일은 **GitHub에 안 올라감**(자동으로 제외됨 — 확인만)
- [ ] 손님 데이터(사주 분석)는 **1개월 후 자동 삭제**됨(개인정보 최소보관 — 코드에 내장)

즐거운 운영 되세요! 🔮
