# Chat Report Core UX Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영 챗봇, 리포트 생성, 궁합 프로필, 오늘운세 입력, 홈 튜토리얼을 실제 사용 가능한 상태로 복구한다.

**Architecture:** 챗봇은 DB에 보존되는 turn/run과 재연결 가능한 SSE를 정본으로 사용한다. 리포트는 짧은 plan 요청과 독립 section 요청으로 함수 생명주기를 분리하고, 나머지 UX는 기존 단일 페이지 라우팅 안에서 명시적 상태를 갖는다.

**Tech Stack:** Node.js ESM, Vercel Functions, Supabase PostgreSQL/PostgREST, vanilla HTML/CSS/JS, node:test

---

### Task 1: 운영 DB 복구 migration

**Files:**
- Create: `supabase/migrations/20260623170000_chat_runtime_repair.sql`
- Modify: `supabase/schema.sql`
- Test: `test/chat-runtime-migration.test.js`

- [x] UUID 생성이 `gen_random_uuid()`를 사용하고 필수 컬럼/RPC/권한이 멱등 보장되는 실패 테스트를 작성한다.
- [x] 테스트가 기존 `uuid_generate_v4()` 때문에 실패하는지 확인한다.
- [x] 운영 복구 migration과 기준 schema를 구현한다.
- [x] migration 테스트를 통과시킨다.

### Task 2: 명시적 대화 턴과 Agent 컨텍스트

**Files:**
- Modify: `apps/api/src/domain/chatRepository.js`
- Modify: `apps/api/src/agent/prompt.js`
- Modify: `apps/api/src/agent/reportTools.js`
- Modify: `apps/api/src/agent/chatAgent.js`
- Test: `test/chat-turns.test.js`
- Test: `test/chat-agent-context.test.js`

- [x] run의 user/assistant 메시지를 턴으로 조립하고 이전 완료 턴만 Agent 입력에 들어가는 테스트를 작성한다.
- [x] 현재 구현에서 turns 부재와 페르소나 규칙 부족으로 실패하는지 확인한다.
- [x] `buildChatTurns`, turn 기반 context, 명리 전문가 시스템 프롬프트를 구현한다.
- [x] 관련 테스트를 통과시킨다.

### Task 3: 풀화면 채팅방과 SSE 실패 복구

**Files:**
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/styles.css`
- Modify: `apps/web/public/app.js`
- Modify: `apps/web/public/chat-stream.js`
- Test: `test/chat-room-ui.test.js`
- Test: `test/chat-stream-ui.test.js`

- [x] 로비와 풀화면 방 분리, 턴 렌더, 뒤로가기, 실패 유지, 재연결 계약 테스트를 작성한다.
- [x] 기존 한 화면 UI에서 테스트가 실패하는지 확인한다.
- [x] 채팅방 상태와 UI/SSE 복구를 구현한다.
- [x] 관련 테스트를 통과시킨다.

### Task 4: 리포트 생성 임계 경로 단축

**Files:**
- Modify: `apps/api/src/legacy/_lib/analysis.js`
- Modify: `apps/api/src/legacy/_lib/reportStream.js`
- Modify: `apps/web/public/app.js`
- Test: `test/report-plan-fallback.test.js`
- Test: `test/report-stream.test.js`
- Test: `test/report-progress-ui.test.js`

- [x] plan 제한시간/출력 상한, deterministic fallback, SSE가 plan 후 종료되는 테스트를 작성한다.
- [x] 기존 70초 plan 및 전체 section 대기로 실패하는지 확인한다.
- [x] 빠른 plan과 브라우저 section 병렬 파이프라인을 구현한다.
- [x] 관련 테스트를 통과시킨다.

### Task 5: 궁합 화면 즉시 프로필 추가

**Files:**
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/styles.css`
- Modify: `apps/web/public/app.js`
- Test: `test/compatibility-profile-ui.test.js`

- [x] 각 슬롯의 추가 버튼과 저장 후 해당 슬롯 복귀 계약 테스트를 작성한다.
- [x] 테스트 실패를 확인하고 return context를 구현한다.
- [x] 관련 테스트를 통과시킨다.

### Task 6: 오늘운세 마음 입력 완성

**Files:**
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/styles.css`
- Modify: `apps/web/public/app.js`
- Modify: `apps/api/src/legacy/saju/analyze.js`
- Modify: `apps/api/src/legacy/_lib/analysis.js`
- Test: `test/daily-mood-ui.test.js`
- Test: `test/daily-mood-api.test.js`

- [x] 칩 선택, 직접 입력, API 전달, 캐시 분리, 프롬프트 반영 테스트를 작성한다.
- [x] 현재 저장-only 구현에서 실패하는지 확인한다.
- [x] UI와 API를 구현하고 테스트를 통과시킨다.

### Task 7: 동작하는 홈 튜토리얼

**Files:**
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/styles.css`
- Modify: `apps/web/public/app.js`
- Test: `test/home-guide-ui.test.js`

- [x] 단계 버튼, 설명 패널, 실제 화면 CTA 계약 테스트를 작성한다.
- [x] 정적 안내에서 실패하는지 확인하고 구현한다.
- [x] 관련 테스트를 통과시킨다.

### Task 8: 통합 검증과 배포

**Files:**
- Modify: `package.json`

- [x] 새 JS 파일이 있으면 `npm run check`에 포함한다.
- [x] `npm test`, `npm run check`, diff whitespace 검사를 실행한다.
- [x] FE/API Vercel production build를 실행한다.
- [x] 모바일 브라우저에서 홈 튜토리얼, 궁합 추가, 오늘운세 직접입력, 비로그인 챗봇 로비를 확인하고 로그인 채팅방 전환은 상태 기반 UI 테스트로 검증한다.
- [x] 변경을 커밋하고 main에 병합한 뒤 `oh-my-zhs` 계정으로 push한다.
