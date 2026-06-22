# Backend Split Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the static web app and API into independently deployable Vercel project roots while preserving every existing route and keeping the current root deployment functional during migration.

**Architecture:** Move browser assets to `apps/web` and server code to `apps/api`, route all HTTP APIs through one catch-all gateway, and keep one root gateway wrapper as a temporary production compatibility path. The web app resolves API URLs through generated runtime configuration so the final web and API projects can use separate origins without exposing server secrets.

**Tech Stack:** Node.js 24, npm workspaces, Vercel Functions, static HTML/CSS/JavaScript, Supabase, Node test runner.

---

### Task 1: Lock the target layout with a failing contract test

**Files:**
- Create: `test/monorepo-layout.test.js`
- Test: `test/monorepo-layout.test.js`

- [x] **Step 1: Write the failing layout test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

test("web and API have independent Vercel project roots", () => {
  assert.equal(existsSync(new URL("apps/web/vercel.json", root)), true);
  assert.equal(existsSync(new URL("apps/api/vercel.json", root)), true);
  assert.equal(existsSync(new URL("apps/web/public/index.html", root)), true);
  assert.equal(existsSync(new URL("apps/api/api/gateway.js", root)), true);
});

test("the root compatibility deployment exposes one gateway function", () => {
  const config = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
  assert.equal(config.outputDirectory, "apps/web/public");
  assert.equal(existsSync(new URL("api/gateway.js", root)), true);
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test test/monorepo-layout.test.js`

Expected: FAIL because `apps/web/vercel.json` and `apps/api/vercel.json` do not exist.

- [x] **Step 3: Do not add production code yet**

The red test is the migration safety contract used by Tasks 2 and 3.

### Task 2: Move sources into npm workspaces without changing behavior

**Files:**
- Move: `public/` → `apps/web/public/`
- Move: `api/` → `apps/api/src/legacy/`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Modify: `package.json`
- Modify: `test/*.test.js`

- [x] **Step 1: Move the directories with Git history**

```bash
mkdir -p apps/web apps/api/src
git mv public apps/web/public
git mv api apps/api/src/legacy
```

- [x] **Step 2: Define workspace package manifests**

`apps/web/package.json`:

```json
{
  "name": "@saju/web",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/write-runtime-config.mjs",
    "dev": "vercel dev"
  }
}
```

`apps/api/package.json`:

```json
{
  "name": "@saju/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vercel dev"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.86.0",
    "manseryeok": "^2.0.0",
    "openai": "^4.104.0"
  },
  "engines": {
    "node": "24.x"
  }
}
```

Root `package.json` keeps the existing commands and adds:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Update `check` paths from `public/...` to `apps/web/public/...` and from `api/...` to `apps/api/src/legacy/...`.

- [x] **Step 3: Update test imports and fixture paths mechanically**

```text
../api/       -> ../apps/api/src/legacy/
../public/    -> ../apps/web/public/
```

Keep test behavior and assertions unchanged.

- [x] **Step 4: Refresh workspace lock metadata**

Run: `npm install --package-lock-only`

Expected: exit 0 and workspace entries for `apps/api` and `apps/web` in `package-lock.json`.

- [x] **Step 5: Run the existing suite**

Run: `npm test`

Expected: existing 121 tests pass; only the new layout test remains red until gateway/config files are added.

### Task 3: Add one API gateway for both backend and compatibility deployments

**Files:**
- Create: `apps/api/src/gateway.js`
- Create: `apps/api/api/gateway.js`
- Create: `api/gateway.js`
- Create: `apps/api/vercel.json`
- Modify: `vercel.json`
- Create: `test/api-gateway.test.js`
- Modify: `test/vercel-config.test.js`

- [x] **Step 1: Write failing gateway routing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoute } from "../apps/api/src/gateway.js";

test("gateway resolves every legacy public API path", () => {
  assert.equal(resolveRoute("/api/config").name, "config");
  assert.equal(resolveRoute("/api/payments/confirm").name, "payment-confirm");
  assert.equal(resolveRoute("/api/saju/analyze").name, "saju-analyze");
  assert.deepEqual(resolveRoute("/api/admin/points"), { name: "admin", action: "points" });
  assert.equal(resolveRoute("/api/auth/kakao/callback").name, "kakao-callback");
  assert.equal(resolveRoute("/api/missing"), null);
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test test/api-gateway.test.js`

Expected: FAIL because `apps/api/src/gateway.js` does not exist.

- [x] **Step 3: Implement the explicit route table and dispatcher**

`apps/api/src/gateway.js` exports `resolveRoute(pathname)` and a default handler. The route table must cover:

```js
const ROUTES = new Map([
  ["/api/config", { name: "config", handler: config }],
  ["/api/profiles", { name: "profiles", handler: profiles }],
  ["/api/orders", { name: "orders", handler: orders }],
  ["/api/track", { name: "track", handler: track }],
  ["/api/session", { name: "session", handler: session }],
  ["/api/share", { name: "share", handler: share }],
  ["/api/payments/confirm", { name: "payment-confirm", handler: paymentConfirm }],
  ["/api/saju/analyze", { name: "saju-analyze", handler: sajuAnalyze }],
  ["/api/saju/section", { name: "saju-section", handler: sajuSection }],
  ["/api/auth/kakao/start", { name: "kakao-start", handler: kakaoStart }],
  ["/api/auth/kakao/callback", { name: "kakao-callback", handler: kakaoCallback }]
]);
```

`/api/health` dispatches to config with `req.query.mode = "health"`; `/api/admin/:action` dispatches to the existing admin handler with `req.query.action` set. Unknown paths return `{ message: "API 경로를 찾지 못했습니다." }` with 404.

- [x] **Step 4: Add the two thin entrypoints**

```js
// apps/api/api/gateway.js
export { default } from "../src/gateway.js";
```

```js
// api/gateway.js
export { default } from "../apps/api/src/gateway.js";
```

- [x] **Step 5: Add backend and transitional root Vercel configs**

`apps/api/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "echo no-build-needed",
  "functions": { "api/**/*.js": { "maxDuration": 300 } },
  "rewrites": [
    { "source": "/share/(.*)", "destination": "/api/gateway?path=share&token=$1" },
    { "source": "/api/(.*)", "destination": "/api/gateway?path=$1" }
  ]
}
```

Root `vercel.json` keeps the existing web rewrites, changes `outputDirectory` to `apps/web/public`, and retains only the gateway function. It ends with the same `/api/(.*)` rewrite so nested paths such as `/api/saju/analyze` reach `api/gateway.js`. Remove the old `/api/health` rewrite because the gateway handles it.

- [x] **Step 6: Run gateway and Vercel configuration tests**

Run: `node --test test/api-gateway.test.js test/monorepo-layout.test.js test/vercel-config.test.js`

Expected: all tests pass.

### Task 4: Add runtime API-origin resolution to the static web app

**Files:**
- Create: `apps/web/public/runtime-config.js`
- Create: `apps/web/public/api-client.js`
- Create: `apps/web/scripts/write-runtime-config.mjs`
- Create: `apps/web/vercel.json`
- Create: `test/api-client.test.js`
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/admin.html`
- Modify: `apps/web/public/setup.html`
- Modify: `apps/web/public/app.js`
- Modify: `apps/web/public/admin.js`

- [x] **Step 1: Write failing URL-normalization tests**

```js
import test from "node:test";
import assert from "node:assert/strict";

await import("../apps/web/public/api-client.js");

test("API URL stays same-origin when no backend origin is configured", () => {
  assert.equal(globalThis.SajuApi.url("/api/session", { apiBaseUrl: "" }), "/api/session");
});

test("API URL uses the configured backend without duplicate slashes", () => {
  assert.equal(
    globalThis.SajuApi.url("/api/session", { apiBaseUrl: "https://api.example.com/" }),
    "https://api.example.com/api/session"
  );
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test test/api-client.test.js`

Expected: FAIL because `api-client.js` does not exist.

- [x] **Step 3: Implement the browser API client**

```js
(function exposeApi(root) {
  function url(path, config = root.__SAJU_RUNTIME__ || {}) {
    const value = String(path || "");
    if (!value.startsWith("/api/")) return value;
    const base = String(config.apiBaseUrl || "").trim().replace(/\/+$/, "");
    return base ? `${base}${value}` : value;
  }

  function request(path, options = {}) {
    return root.fetch(url(path), { credentials: "include", ...options });
  }

  root.SajuApi = { url, fetch: request };
})(globalThis);
```

Use `SajuApi.url()` for OAuth navigation and Beacon URLs. Use `SajuApi.fetch()` for all `/api/*` fetch calls in app, admin, and setup code. Load `runtime-config.js` and `api-client.js` before application scripts in all three HTML entrypoints.

- [x] **Step 4: Generate deployment-specific runtime config**

`write-runtime-config.mjs` writes the serialized value without string interpolation:

```js
const payload = JSON.stringify({ apiBaseUrl: process.env.SAJU_API_BASE_URL || "" });
await writeFile(outputPath, `window.__SAJU_RUNTIME__ = ${payload};\n`, "utf8");
```

Reject non-HTTP(S) configured values and allow the empty string for root compatibility/local development.

- [x] **Step 5: Add the web Vercel config**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "npm run build",
  "outputDirectory": "public",
  "rewrites": [
    { "source": "/admin", "destination": "/admin.html" },
    { "source": "/setup", "destination": "/setup.html" },
    { "source": "/terms", "destination": "/index.html" },
    { "source": "/privacy", "destination": "/index.html" },
    { "source": "/refund", "destination": "/index.html" },
    { "source": "/payments/(.*)", "destination": "/index.html" }
  ]
}
```

- [x] **Step 6: Run client and browser-source contract tests**

Run: `node --test test/api-client.test.js test/monorepo-layout.test.js`

Expected: all tests pass.

### Task 5: Enforce credentialed CORS and return OAuth users to the web origin

**Files:**
- Modify: `apps/api/src/gateway.js`
- Modify: `apps/api/src/legacy/_lib/http.js`
- Modify: `apps/api/src/legacy/auth/kakao/callback.js`
- Create: `test/api-cors.test.js`

- [x] **Step 1: Write failing CORS and web-origin tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../apps/api/src/gateway.js";
import { webBaseUrl } from "../apps/api/src/legacy/_lib/http.js";

test("only configured browser origins receive credentialed API access", () => {
  const allowed = ["https://www.example.com", "http://localhost:3000"];
  assert.equal(isAllowedOrigin("https://www.example.com", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.example", allowed), false);
});

test("OAuth completion uses the configured web origin", () => {
  const old = process.env.WEB_BASE_URL;
  process.env.WEB_BASE_URL = "https://www.example.com/";
  assert.equal(webBaseUrl({ headers: { host: "api.example.com" } }), "https://www.example.com");
  process.env.WEB_BASE_URL = old;
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test test/api-cors.test.js`

Expected: FAIL because the exports do not exist.

- [x] **Step 3: Implement gateway CORS**

Parse `WEB_ORIGINS` as a comma-separated exact-origin allowlist and include `WEB_BASE_URL`. For allowed origins set:

```text
Access-Control-Allow-Origin: <request origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type, Last-Event-ID
Access-Control-Allow-Methods: GET, POST, OPTIONS
Vary: Origin
```

Return 204 for allowed `OPTIONS`; return 403 for a browser Origin outside the allowlist. Requests without `Origin` continue for OAuth callbacks, Toss server calls, and health checks.

- [x] **Step 4: Implement `webBaseUrl` and absolute OAuth completion redirects**

`webBaseUrl(req)` returns a normalized `WEB_BASE_URL` when configured and otherwise falls back to `baseUrl(req)`. Kakao callback success and error redirects use `${webBaseUrl(req)}/?auth=...`; the Kakao provider callback URI remains the API origin.

- [x] **Step 5: Run focused tests**

Run: `node --test test/api-cors.test.js test/api-gateway.test.js`

Expected: all tests pass.

### Task 6: Verify both deployable roots and preserve the production fallback

**Files:**
- Modify: `SETUP.md`
- Modify: `docs/superpowers/plans/2026-06-22-backend-split-foundation.md`

- [x] **Step 1: Document the two Vercel projects and environment split**

Document:

```text
saju-web root: apps/web
  SAJU_API_BASE_URL: backend project custom origin

saju-api root: apps/api
  WEB_BASE_URL: frontend project custom origin
  WEB_ORIGINS: comma-separated allowed frontend origins
  SUPABASE_*, OPENCODE_*, TOSS_*, KAKAO_*, ADMIN_PASSWORD
```

State that the current root Vercel project remains deployable with same-origin API until both new projects and domains are configured.

- [x] **Step 2: Run the full verification suite**

Run: `npm test`

Expected: all tests pass with zero failures.

Run: `npm run check`

Expected: exit 0.

Run: `npm run build -w @saju/web`

Expected: exit 0 and a valid `apps/web/public/runtime-config.js`.

Run: `npx vercel build --yes`

Expected: root compatibility build completes and emits only the catch-all API function.

Run: `git diff --check`

Expected: no output.

- [x] **Step 3: Sync CodeGraph and inspect the final index**

Run: `codegraph sync . && codegraph status .`

Expected: the index contains `apps/web`, `apps/api`, and the new gateway symbols.

- [x] **Step 4: Commit Phase 1**

```bash
git add .codegraph/.gitignore .codegraph/config.json .cursor/rules/codegraph.mdc \
  apps api package.json package-lock.json vercel.json test SETUP.md \
  docs/superpowers/plans/2026-06-22-backend-split-foundation.md
git commit -m "refactor: split web and API deployments"
```
