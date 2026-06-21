# 스트리밍 리포트 생성과 UI 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리포트 분량과 품질을 유지하면서 구조화 SSE, 실제 진행률, 경량 설계 프롬프트로 60초 타임아웃과 정체 UX를 해결하고 무료운세·포인트 결제 UI 오류를 수정한다.

**Architecture:** `/api/saju/analyze`의 기존 JSON 계약은 유지하고 `stream: true`일 때 만세력·설계·병렬 섹션 결과를 업무 이벤트 SSE로 보낸다. 브라우저는 이벤트마다 실제 진행률과 기존 `ReportRecovery` 초안을 갱신하며, AI 전송 계층은 목적별 출력 상한·제한 시간·선택적 재시도를 담당한다. 무료운세 원국 정규화와 포인트 전액사용 계산은 독립 순수 모듈로 분리해 Node 테스트로 검증한다.

**Tech Stack:** Node.js ESM, Vercel Functions/Fluid Compute, Server-Sent Events, OpenAI-compatible API, Vanilla JavaScript, Node test runner

---

### Task 1: AI 설계 프롬프트 경량화와 전송 제한

**Files:**
- Modify: `api/_lib/analysis.js`
- Modify: `api/_lib/aiTransport.js`
- Test: `test/section-batch.test.js`
- Test: `test/ai-transport.test.js`

- [ ] **Step 1: Write failing plan prompt tests**

`test/section-batch.test.js`에서 `buildPlanPrompt()`가 관리자 지침과 상품 초점을 포함하고, 본문 전용 상세 규칙을 포함하지 않으며, 2,400자보다 짧은지 검사한다. `generatePlan()` 주입 의존성으로 전달된 `maxTokens`가 2,048인지 검사한다.

```js
assert.match(buildPlanPrompt({ productId: "saju-analysis", extra: "현실 예시", profile: { name: "가람" } }), /현실 예시/);
assert.doesNotMatch(prompt, /각 섹션 body는 3~4문단/);
assert.ok(prompt.length < 2400);
assert.equal(requestOptions.maxTokens, 2048);
```

- [ ] **Step 2: Run prompt tests and confirm RED**

Run: `node --test test/section-batch.test.js`

Expected: `buildPlanPrompt` export와 `generatePlan` 의존성 주입/출력 제한이 없어 실패.

- [ ] **Step 3: Implement the compact plan request**

`buildPlanPrompt({ productId, extra, profile, partner })`에 설계에 필요한 사람 중심 문체, 제목 다양성, 한자·전문용어·바넘·공포 금지, 상품별 범위, 관리자 지침만 둔다. `generatePlan(args, dependencies = {})`가 주입된 `requestStructured`를 사용하고 `maxTokens: 2048`, `timeoutMs: 70000`을 전달한다. `generateSections()`에는 `maxTokens: 4096`, `timeoutMs: 90000`을 전달한다.

- [ ] **Step 4: Write failing transport retry tests**

`test/ai-transport.test.js`에 다음을 추가한다.

```js
const retryable = Object.assign(new Error("busy"), { statusCode: 503 });
// 첫 503 뒤 정상 응답이면 두 번 호출하고 성공
// 일반 network down은 기존처럼 한 번만 호출
// AbortError가 반복되면 statusCode 504와 한국어 시간 초과 메시지
```

또한 주입 요청 함수가 `maxTokens`, `timeoutMs`를 그대로 받는지 확인한다.

- [ ] **Step 5: Run transport tests and confirm RED**

Run: `node --test test/ai-transport.test.js`

Expected: 503/제한 시간 재시도와 504 변환이 없어 실패.

- [ ] **Step 6: Implement timeout, output limits, and bounded retry**

`requestChat`은 `max_tokens`와 SDK 요청 신호를, `requestMessages`는 `max_tokens`와 `fetch` 신호를 사용한다. 내부 제한 시간 헬퍼가 `AbortError`를 `{ statusCode: 504, retryable: true }`인 한국어 오류로 바꾼다. `requestStructured`는 429, 5xx, 제한 시간만 최대 한 번 재시도하고 JSON/스키마 실패도 최대 한 번만 다시 요청한다.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run: `node --test test/ai-transport.test.js test/section-batch.test.js`

Expected: 모든 AI 전송·프롬프트 테스트 통과.

### Task 2: 구조화 SSE 서버 생성 파이프라인

**Files:**
- Create: `api/_lib/reportStream.js`
- Modify: `api/saju/analyze.js`
- Test: `test/report-stream.test.js`

- [ ] **Step 1: Write failing SSE helper and pipeline tests**

`test/report-stream.test.js`에 이벤트 직렬화, 2개 단위 묶음, 묶음 실패 시 단일 섹션 폴백, 성공 섹션 순서 보존을 검사한다.

```js
assert.equal(formatSse("started", { progress: 5 }), "event: started\ndata: {\"progress\":5}\n\n");
assert.deepEqual(chunkSections(["a", "b", "c"], 2), [["a", "b"], ["c"]]);
```

파이프라인 테스트는 가짜 `computeManse`, `generatePlan`, `generateSections`를 주입하고 `started → manse_ready → plan_started → plan_ready → section_ready → complete` 순서를 검증한다.

- [ ] **Step 2: Run stream tests and confirm RED**

Run: `node --test test/report-stream.test.js`

Expected: `reportStream.js`가 없어 실패.

- [ ] **Step 3: Implement SSE helpers and report pipeline**

`formatSse(event, payload)`, `openSse(res)`, `sendSse(res, event, payload)`, `chunkSections(items, size)`, `runReportStream(options, dependencies)`를 구현한다. `runReportStream`은 만세력과 설계를 순차 실행하고 섹션 묶음을 병렬 실행하며, 실패 묶음만 단일 섹션으로 재호출한다. 10초 heartbeat는 외부 대기 중 연결을 유지하고 종료 시 해제한다.

- [ ] **Step 4: Connect stream mode without breaking JSON mode**

`api/saju/analyze.js`는 요청 본문의 `stream`과 `Accept`를 확인한다. 무료운세는 기존 JSON 흐름을 유지하고 유료 리포트 스트림만 `runReportStream`으로 전달한다. 스트림 시작 전 검증 오류는 JSON, 시작 뒤 오류는 `error` 이벤트로 보낸다. 기존 일반 호출과 데이터베이스 베스트에포트 저장은 유지한다.

- [ ] **Step 5: Run stream and existing API tests**

Run: `node --test test/report-stream.test.js test/section-api.test.js test/analysis-batching.test.js`

Expected: 신규 스트림과 기존 섹션 계약 테스트 통과.

### Task 3: 브라우저 SSE 파서와 실제 진행률·보관 체크포인트

**Files:**
- Create: `public/analysis-stream.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `package.json`
- Test: `test/analysis-stream.test.js`
- Test: `test/report-recovery.test.js`

- [ ] **Step 1: Write failing chunked SSE parser tests**

`test/analysis-stream.test.js`에서 브라우저 전역 없이 로드 가능한 `AnalysisStream` 모듈이 청크 경계에 걸친 이벤트와 여러 이벤트를 올바른 순서로 전달하는지 검사한다.

```js
const events = parseChunks(["event: plan_", "ready\ndata: {\"total\":8}\n\n"]);
assert.deepEqual(events, [{ event: "plan_ready", data: { total: 8 } }]);
assert.equal(progressForSections(4, 8), 68);
```

`progressForSections(0, 8)`은 40, 전부 완료는 95, 최종 완료는 별도 100으로 둔다.

- [ ] **Step 2: Run parser tests and confirm RED**

Run: `node --test test/analysis-stream.test.js`

Expected: 모듈이 없어 실패.

- [ ] **Step 3: Implement the parser and progress helpers**

`public/analysis-stream.js`에 UMD 전역 `AnalysisStream`을 만들고 `createParser(onEvent)`, `consume(response, onEvent)`, `progressForSections(done, total)`을 제공한다. JSON 파싱 불가 이벤트는 명확한 오류를 내고, 비 SSE 응답은 텍스트를 읽어 상태 코드 기반 오류로 바꾼다.

- [ ] **Step 4: Replace fake progress with streamed business events**

`startAnalysis()`에서 난수 interval과 92% 상한을 제거한다. `fetch`에 `stream: true`, `Accept: text/event-stream`을 보내고 이벤트별로 메시지와 진행률을 설정한다. `plan_ready`에서 초안과 섹션 자리표시자를 렌더·저장하고, `section_ready`마다 본문을 갱신·저장하며, `complete`에서 100%와 완료 상태를 기록한다. 기존 JSON 응답은 비 스트림 폴백으로 처리한다.

- [ ] **Step 5: Make loading copy truthful and include script in checks**

`public/index.html`의 안내를 `완료된 단계마다 보관함에 저장됩니다.`로 바꾸고 `analysis-stream.js`를 `app.js` 전에 로드한다. `package.json`의 `check`에 새 파일 문법 검사를 추가한다. `test/report-recovery.test.js`에서 임의 92% timer가 사라지고 SSE 이벤트가 체크포인트 함수에 연결되는지 검사한다.

- [ ] **Step 6: Run client stream tests and confirm GREEN**

Run: `node --test test/analysis-stream.test.js test/report-recovery.test.js && npm run check`

Expected: 스트림 파서·체크포인트 테스트와 문법 검사 통과.

### Task 4: 무료운세 원국 정규화와 겹침 방지

**Files:**
- Create: `public/daily-fortune-ui.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `package.json`
- Test: `test/daily-fortune-ui.test.js`

- [ ] **Step 1: Write failing pillar normalization tests**

`test/daily-fortune-ui.test.js`에서 `"임신"`, `"壬申"`, `{ stem: "임", branch: "신" }`, `null`을 검사한다.

```js
assert.deepEqual(normalizePillar("임신"), { stemKo: "임", stemHanja: "壬", branchKo: "신", branchHanja: "申", unknown: false });
assert.equal(normalizePillar(null).unknown, true);
```

CSS 정적 검사로 `.daily-hero`의 grid, `.daily-score`의 absolute 제거, 모바일 열 전환을 확인한다.

- [ ] **Step 2: Run daily UI tests and confirm RED**

Run: `node --test test/daily-fortune-ui.test.js`

Expected: 정규화 모듈과 grid 스타일이 없어 실패.

- [ ] **Step 3: Implement normalizer and render adapter**

천간·지지 한글/한자 매핑으로 문자열과 객체를 정규화한다. `pillarCell()`은 정규화 결과를 사용하고 미상 값에는 `?` 여러 개 대신 `미상`을 한 번 표시한다. 새 스크립트를 `app.js` 전에 로드하고 문법 검사에 포함한다.

- [ ] **Step 4: Replace absolute hero layout with responsive grid**

헤드라인과 점수를 `minmax(0, 1fr) auto` 두 열로 배치하고 상단 메타와 태그는 전체 열을 차지하게 한다. 420px 이하에서는 점수를 다음 줄로 보내 텍스트 폭을 보장한다.

- [ ] **Step 5: Run daily UI tests and confirm GREEN**

Run: `node --test test/daily-fortune-ui.test.js && npm run check`

Expected: 모든 원국 형식과 레이아웃 계약 통과.

### Task 5: 포인트 전액사용 버튼

**Files:**
- Create: `public/point-payment.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `package.json`
- Test: `test/point-ui.test.js`

- [ ] **Step 1: Write failing full-use calculation tests**

`test/point-ui.test.js`에서 `PointPayment.fullUse(balance, price)`가 `min(balance, price)`를 0 이상 정수로 반환하고 HTML에 `data-point-use-all`이 있는지 검사한다.

```js
assert.equal(fullUse(5000, 1990), 1990);
assert.equal(fullUse(500, 1990), 500);
assert.equal(fullUse(-1, 1990), 0);
```

- [ ] **Step 2: Run point UI tests and confirm RED**

Run: `node --test test/point-ui.test.js`

Expected: 순수 계산 모듈과 전액사용 버튼이 없어 실패.

- [ ] **Step 3: Implement full-use control**

입력과 버튼을 `.point-use-row`에 배치한다. `setupPayView()`와 `updatePointPayment()`가 잔액과 상품가에 맞춰 버튼 disabled를 갱신하고, 클릭 시 `currentCheckout.pointsUsed = PointPayment.fullUse(balance, product.amount)`로 설정한 뒤 기존 금액 갱신 경로를 호출한다.

- [ ] **Step 4: Run point UI tests and confirm GREEN**

Run: `node --test test/point-ui.test.js && npm run check`

Expected: 계산·마크업·이벤트 연결 테스트 통과.

### Task 6: Vercel 제한 시간, 전체 검증, Production 배포

**Files:**
- Modify: `vercel.json`
- Modify: `docs/superpowers/plans/2026-06-22-streaming-report-and-ui-fixes.md`
- Test: `test/vercel-config.test.js`

- [ ] **Step 1: Write failing Vercel duration test**

`test/vercel-config.test.js`에서 `vercel.json`의 `functions["api/**/*.js"].maxDuration`이 300인지 검사한다.

- [ ] **Step 2: Run duration test and confirm RED**

Run: `node --test test/vercel-config.test.js`

Expected: 현재 값 60 때문에 실패.

- [ ] **Step 3: Set Fluid Compute duration safety margin**

`vercel.json`의 `maxDuration`을 300으로 바꾼다. 메모리와 라우팅 설정은 유지한다.

- [ ] **Step 4: Run all automated verification**

Run: `npm test && npm run check && git diff --check`

Expected: 모든 테스트 통과, 문법 오류와 공백 오류 없음.

- [ ] **Step 5: Run local browser verification**

`npm run dev`로 서버를 시작하고 결제 화면 전액사용, 무료운세 문자열 원국 렌더, 분석 스트림 진행 UI를 확인한다. 외부 API 키가 없는 경우 실제 AI 호출 대신 자동화 테스트로 SSE 파이프라인을 확인하고 화면의 콘솔 오류가 없는지 확인한다.

- [ ] **Step 6: Review requirements and commit**

설계 문서의 검증 기준을 각 테스트와 코드에 대조한다. 구현 파일과 완료 체크된 계획을 스테이징하고 다음 메시지로 커밋한다.

```bash
git commit -m "perf: stream report generation"
```

- [ ] **Step 7: Push feature branch, fast-forward main, and push production branch**

```bash
git push origin codex/order-recovery
git -C /Users/gabriel.k/Documents/Workspace/saju-franchise merge --ff-only codex/order-recovery
git -C /Users/gabriel.k/Documents/Workspace/saju-franchise push origin main
```

원본 체크아웃의 `supabase/.schema.sql.swp`는 미추적 사용자 파일이므로 추가·삭제하지 않는다. `main` 푸시 뒤 Git 연동 Production 배포 상태와 운영 URL의 HTTP 응답을 확인한다.
