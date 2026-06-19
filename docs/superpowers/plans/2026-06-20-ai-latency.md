# AI 모델 라우팅 및 리포트 속도 개선 구현 계획

> **에이전트 작업자 필수:** 이 계획은 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`를 사용해 체크박스 순서대로 실행한다.

**목표:** 리포트 구조와 분량을 유지하면서 섹션 본문을 두 개씩 병렬 생성하고, DeepSeek V4 Flash와 MiniMax M3를 실제 호출 가능한 관리자 모델로 추가한다.

**구조:** `api/_lib/aiTransport.js`가 모델별 엔드포인트와 JSON 검증을 담당한다. `analysis.js`는 설계 프롬프트는 유지하고 섹션 본문만 축약 프롬프트와 배치 스키마로 생성한다. 브라우저는 순서가 보존된 2개 단위 묶음을 병렬 호출하고 실패한 묶음만 단일 요청으로 재시도한다.

**기술 스택:** Node.js 22, ES modules, OpenAI SDK, 내장 `fetch`, Node 내장 테스트 러너, 정적 브라우저 JavaScript, Vercel Functions

---

## 파일 구성

- 생성 `api/_lib/aiTransport.js`: 모델 프로필, 요청 전송, JSON 추출과 스키마 검증
- 수정 `api/_lib/analysis.js`: 전송 계층 사용, 축약 본문 프롬프트, 섹션 배치 생성
- 수정 `api/saju/section.js`: 단일·배치 요청 계약 지원
- 생성 `public/analysis-batching.js`: 브라우저와 Node 테스트가 함께 쓰는 순서 보존 묶음 함수
- 수정 `public/index.html`: 묶음 도우미를 `app.js`보다 먼저 로드
- 수정 `public/app.js`: 2개 단위 배치 병렬 호출, 실패 묶음 단일 재시도
- 수정 `public/admin.html`: 새 모델 선택지와 설명
- 생성 `test/ai-transport.test.js`: 모델 라우팅, JSON 추출, 스키마 검증 테스트
- 생성 `test/analysis-batching.test.js`: 홀수·짝수 순서 보존 묶음 테스트
- 생성 `test/admin-models.test.js`: 관리자 선택지 회귀 테스트
- 수정 `package.json`: 테스트 명령과 실제 정적 파일 경로를 사용하는 문법 검사

### 작업 1: 모델 전송 계층

**파일:**
- 생성: `test/ai-transport.test.js`
- 생성: `api/_lib/aiTransport.js`

- [ ] **1단계: 실패하는 모델 라우팅·JSON 검증 테스트 작성**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractJsonObject, modelProfile, validateSchema } from "../api/_lib/aiTransport.js";

test("routes DeepSeek to chat completions", () => {
  assert.equal(modelProfile("deepseek-v4-flash").transport, "chat");
});

test("routes MiniMax to messages", () => {
  assert.equal(modelProfile("minimax-m3").transport, "messages");
});

test("extracts fenced JSON and validates required fields", () => {
  const value = extractJsonObject('```json\n{"body":"본문"}\n```');
  assert.deepEqual(value, { body: "본문" });
  assert.doesNotThrow(() => validateSchema(value, {
    type: "object",
    required: ["body"],
    properties: { body: { type: "string" } },
  }));
});

test("rejects invalid required fields", () => {
  assert.throws(() => validateSchema({}, {
    type: "object",
    required: ["body"],
    properties: { body: { type: "string" } },
  }), /body/);
});
```

- [ ] **2단계: 테스트가 모듈 누락으로 실패하는지 확인**

실행: `node --test test/ai-transport.test.js`

예상: `ERR_MODULE_NOT_FOUND`로 실패

- [ ] **3단계: 최소 모델 프로필·JSON 추출·스키마 검증 구현**

`api/_lib/aiTransport.js`에 다음 공개 경계를 구현한다.

```js
export function modelProfile(model) {
  if (model === "minimax-m3") return { transport: "messages", strictJson: false };
  if (model === "deepseek-v4-flash") return { transport: "chat", strictJson: false };
  return { transport: "chat", strictJson: true };
}

export function extractJsonObject(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI 응답에 JSON 객체가 없습니다.");
  return JSON.parse(clean.slice(start, end + 1));
}
```

`validateSchema(value, schema, path = "$" )`는 현재 스키마에서 쓰는
`object`, `array`, `string`, `integer`, `number`, `required`, `properties`,
`additionalProperties`, `minItems`, `maxItems`, `enum`만 재귀 검증한다.

- [ ] **4단계: 모델별 요청 전송과 한 번 재시도 구현**

```js
export async function requestStructured({ model, system, input, name, schema }) {
  const profile = modelProfile(model);
  const request = profile.transport === "messages" ? requestMessages : requestChat;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = await request({ model, system, input, name, schema, strictJson: profile.strictJson });
      const value = extractJsonObject(text);
      validateSchema(value, schema);
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
```

`requestChat`은 기존 OpenAI SDK와 `/chat/completions`를 사용한다.
`requestMessages`는 `${OPENCODE_BASE_URL}/messages`에 `x-api-key`,
`anthropic-version: 2023-06-01` 헤더로 POST하고 첫 `content[].text`를 읽는다.
엄격 스키마를 쓰지 않는 요청에는 스키마 JSON과 “JSON 객체만 출력” 규칙을
시스템 지침에 추가한다.

- [ ] **5단계: 테스트 통과 확인**

실행: `node --test test/ai-transport.test.js`

예상: 4개 테스트 통과

### 작업 2: 섹션 축약 프롬프트와 배치 생성

**파일:**
- 수정: `api/_lib/analysis.js`
- 생성: `test/section-batch.test.js`

- [ ] **1단계: 실패하는 배치 검증 테스트 작성**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateSectionBatch } from "../api/_lib/analysis.js";

test("accepts requested section ids once and in request order", () => {
  const result = validateSectionBatch(
    [{ id: "s0" }, { id: "s1" }],
    [{ id: "s1", body: "둘" }, { id: "s0", body: "하나" }],
  );
  assert.deepEqual(result.map((item) => item.id), ["s0", "s1"]);
});

test("rejects missing or duplicate section ids", () => {
  const requested = [{ id: "s0" }, { id: "s1" }];
  assert.throws(() => validateSectionBatch(requested, [{ id: "s0", body: "하나" }]));
  assert.throws(() => validateSectionBatch(requested, [
    { id: "s0", body: "하나" }, { id: "s0", body: "중복" },
  ]));
});
```

- [ ] **2단계: 테스트가 export 누락으로 실패하는지 확인**

실행: `node --test test/section-batch.test.js`

예상: `validateSectionBatch` export 누락으로 실패

- [ ] **3단계: 기존 `chatJSON`을 공용 전송 계층으로 교체**

`analysis.js`의 OpenAI 클라이언트 생성과 로컬 `chatJSON`을 제거하고 다음
어댑터로 기존 호출부의 문자열 계약을 유지한다.

```js
import { requestStructured } from "./aiTransport.js";

async function chatJSON(_client, options) {
  return JSON.stringify(await requestStructured(options));
}
```

기존 `getClient()` 호출은 제거하고 모든 `chatJSON(client, ...)` 호출을
`chatJSON(null, ...)` 또는 인자 없는 공용 호출 형태로 정리한다.

- [ ] **4단계: 축약 프롬프트와 배치 스키마 구현**

`compactSectionPrompt`에는 본문 3~4문단, 한국어 존댓말, 한자·사주용어 금지,
공포·질병·재난·투자·단정 표현 금지, 다른 제목과 중복 금지, 관리자 추가
지침만 포함한다. 계획·헤드라인·점수·개운·제목 생성 규칙은 넣지 않는다.

```js
function sectionBatchSchema(requested) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sections"],
    properties: {
      sections: {
        type: "array",
        minItems: requested.length,
        maxItems: requested.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "body"],
          properties: {
            id: { type: "string", enum: requested.map((item) => item.id) },
            body: SECTION_SCHEMA.properties.body,
          },
        },
      },
    },
  };
}
```

- [ ] **5단계: 배치 생성과 기존 단일 생성 호환 구현**

`generateSections({ sections, ...기존 인자 })`는 한 번의 모델 호출로 배열을
만들고 `validateSectionBatch`로 요청 순서에 맞춰 반환한다.
`generateSection(args)`는 `generateSections({ ...args, sections: [args.section] })`
첫 결과를 `{ body }`로 바꿔 반환해 기존 계약을 유지한다.

- [ ] **6단계: 배치 테스트와 기존 전송 테스트 통과 확인**

실행: `node --test test/section-batch.test.js test/ai-transport.test.js`

예상: 모든 테스트 통과

### 작업 3: API 단일·배치 계약

**파일:**
- 수정: `api/saju/section.js`

- [ ] **1단계: `sections` 배열 입력 분기 추가**

```js
if (Array.isArray(body.sections) && body.sections.length) {
  const sections = await generateSections({
    productId, extra, profile, partner, context,
    sections: body.sections, otherTitles, model,
  });
  return sendJson(res, 200, { ok: true, sections });
}
```

배치 크기는 1~2개로 제한하고 각 항목의 `id`, `title`, `angle`을 검증한다.
기존 `section` 분기는 그대로 남겨 후속 질문과 단일 재시도를 보존한다.

- [ ] **2단계: API 문법 검사**

실행: `node --check api/saju/section.js && node --check api/_lib/analysis.js`

예상: 종료 코드 0

### 작업 4: 브라우저 두 개 단위 병렬 호출과 병합

**파일:**
- 생성: `public/analysis-batching.js`
- 생성: `test/analysis-batching.test.js`
- 수정: `public/index.html`
- 수정: `public/app.js`

- [ ] **1단계: 실패하는 홀수·짝수 묶음 테스트 작성**

```js
import test from "node:test";
import assert from "node:assert/strict";

await import("../public/analysis-batching.js");
const { chunkSections } = globalThis.AnalysisBatching;

test("chunks sections by two without changing order", () => {
  assert.deepEqual(chunkSections(["s0", "s1", "s2", "s3", "s4"]), [
    ["s0", "s1"], ["s2", "s3"], ["s4"],
  ]);
  assert.deepEqual(chunkSections(["s0", "s1"]), [["s0", "s1"]]);
});
```

- [ ] **2단계: 테스트가 모듈 누락으로 실패하는지 확인**

실행: `node --test test/analysis-batching.test.js`

예상: `ERR_MODULE_NOT_FOUND`로 실패

- [ ] **3단계: 순서 보존 묶음 함수 구현**

```js
function chunkSections(sections, size = 2) {
  const chunks = [];
  for (let index = 0; index < sections.length; index += size) {
    chunks.push(sections.slice(index, index + size));
  }
  return chunks;
}

globalThis.AnalysisBatching = Object.freeze({ chunkSections });
```

- [ ] **4단계: 도우미를 `app.js`보다 먼저 로드**

```html
<script src="./analysis-batching.js"></script>
<script src="./app.js"></script>
```

- [ ] **5단계: 기존 섹션별 `Promise.all`을 배치 병렬 호출로 교체**

각 묶음은 `{ sections: batch }`로 한 번 호출한다. 성공 응답의 ID별 본문을
원래 `sections` 배열에 합치고 즉시 `fillSectionBody`를 호출한다. 배치 실패
시 그 묶음만 기존 `{ section: s }` 단일 호출을 `Promise.all`로 재시도한다.
모든 묶음이 끝난 뒤 기존 `archive(sections)`와 `complete()`를 실행한다.

- [ ] **6단계: 묶음 테스트와 브라우저 문법 검사**

실행: `node --test test/analysis-batching.test.js && node --check public/analysis-batching.js && node --check public/app.js`

예상: 테스트 통과, 문법 검사 종료 코드 0

### 작업 5: 관리자 모델 선택지

**파일:**
- 생성: `test/admin-models.test.js`
- 수정: `public/admin.html`

- [ ] **1단계: 실패하는 관리자 모델 선택지 테스트 작성**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin exposes supported fast models", async () => {
  const html = await readFile(new URL("../public/admin.html", import.meta.url), "utf8");
  assert.match(html, /value="deepseek-v4-flash"/);
  assert.match(html, /value="minimax-m3"/);
  assert.doesNotMatch(html, /deepseek·minimax 등은 분석이 실패합니다/);
});
```

- [ ] **2단계: 테스트가 선택지 누락으로 실패하는지 확인**

실행: `node --test test/admin-models.test.js`

예상: `deepseek-v4-flash` 정규식 불일치로 실패

- [ ] **3단계: 선택지와 설명 수정**

`deepseek-v4-flash (속도 우선)`과 `minimax-m3` 옵션을 추가한다. 설명은
모델별 API 형식을 서버가 자동 처리하며, 기본값은 `glm-5.2`라고 안내한다.

- [ ] **4단계: 관리자 테스트와 HTML 현재값 호환 확인**

실행: `node --test test/admin-models.test.js && node --check public/admin.js`

예상: 테스트 통과, 문법 검사 종료 코드 0

### 작업 6: 통합 검증

**파일:**
- 수정: `package.json`

- [ ] **1단계: 테스트·문법 검사 스크립트 수정**

```json
"scripts": {
  "test": "node --test test/*.test.js",
  "check": "node --check public/app.js && node --check public/admin.js && node --check public/analysis-batching.js && node --check api/_lib/aiTransport.js && node --check api/_lib/analysis.js && node --check api/saju/analyze.js && node --check api/saju/section.js && node --check api/config.js"
}
```

- [ ] **2단계: 전체 자동화 테스트 실행**

실행: `npm test`

예상: 실패 0개

- [ ] **3단계: 전체 문법 검사 실행**

실행: `npm run check`

예상: 종료 코드 0

- [ ] **4단계: 변경 범위와 공백 오류 검사**

실행: `git diff --check && git status -sb && git diff --stat`

예상: 새 테스트·전송 계층·배치 도우미와 계획된 수정 파일만 표시되고 공백 오류 없음
