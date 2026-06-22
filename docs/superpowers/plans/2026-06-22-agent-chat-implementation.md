# Agent Chat Implementation Plan

> **For Codex:** Execute this plan in independently deployable commits. Preserve the existing `followup` product as a separate 990 KRW single-answer flow.

**Goal:** Add a paid, report-grounded AI chat product whose question credits, sessions, messages, runs, and SSE recovery survive navigation, retries, and deployments.

**Architecture:** Keep the static web and API as separate Vercel projects. Supabase is the source of truth for entitlements and chat state. A `WorkflowRunner` starts a Vercel Workflow after an atomic message enqueue; the workflow only reads the selected report snapshot and the current conversation. SSE reads persisted events and never owns generation lifecycle.

**Stack:** Node.js 24, Vercel Functions, Workflow DevKit, Supabase/PostgreSQL RPCs, existing OpenCode-compatible AI transport, static HTML/CSS/JavaScript, Node test runner.

---

## Phase A: Product contracts and atomic credit ledger

### Task 1: Define the shared chat product catalog

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/chat.js`
- Test: `test/chat-contracts.test.js`

1. Write failing tests for the 1, 3, 5, and 10 question packages.
2. Assert fixed prices of 500, 1,500, 2,250, and 4,000 KRW.
3. Export immutable catalog rows and lookup helpers.
4. Run `node --test test/chat-contracts.test.js`.

### Task 2: Add idempotent chat-credit and conversation schema

**Files:**
- Modify: `supabase/schema.sql`
- Test: `test/chat-schema.test.js`

1. Add schema contract tests for every table, constraint, index, RPC, revoke, and grant.
2. Add `chat_credit_accounts`, `chat_credit_transactions`, `chat_sessions`, `chat_messages`, `chat_runs`, and `chat_stream_events`.
3. Add idempotent purchase, reserve, refund, and atomic enqueue RPCs.
4. Add order fulfillment status columns for recoverable entitlement grants.
5. Parse or execute the SQL against an empty PostgreSQL database when available.

### Task 3: Fulfill paid chat orders exactly once

**Files:**
- Create: `apps/api/src/domain/chatCredits.js`
- Create: `apps/api/src/domain/orderFulfillment.js`
- Modify: `apps/api/src/legacy/_lib/toss.js`
- Modify: `apps/api/src/legacy/orders.js`
- Modify: `apps/api/src/legacy/payments/confirm.js`
- Test: `test/chat-fulfillment.test.js`
- Test: `test/point-orders.test.js`
- Test: `test/point-payments.test.js`

1. Reject chat package purchase for guests.
2. Ignore client price and use the fixed server catalog.
3. Grant credits through the idempotent purchase RPC using the order ID as reference.
4. Route point-only and Toss/mixed completion through the same fulfillment service.
5. Keep a paid order completed if fulfillment fails and mark it retryable.

### Task 4: Expose catalog and current balance

**Files:**
- Create: `apps/api/src/domain/chatRepository.js`
- Create: `apps/api/src/http/chat.js`
- Modify: `apps/api/src/gateway.js`
- Test: `test/chat-api.test.js`

1. Add `GET /api/chat/catalog`.
2. Require login and return the fixed catalog plus current question balance.
3. Add the route without creating another Vercel Function.

---

## Phase B: Durable chat sessions and message enqueue

### Task 5: Create or resume a report-scoped chat session

**Files:**
- Modify: `apps/api/src/domain/chatRepository.js`
- Modify: `apps/api/src/http/chat.js`
- Test: `test/chat-sessions.test.js`

1. Read `user_data(kind='archive')` by server-verified owner and archive ID.
2. Validate and size-limit the report snapshot.
3. Upsert one active chat session per user/report and freeze the snapshot.
4. Add session list, create, and detail API contracts.

### Task 6: Atomically enqueue one paid question

**Files:**
- Modify: `apps/api/src/domain/chatRepository.js`
- Modify: `apps/api/src/http/chat.js`
- Create: `apps/api/src/workflows/runner.js`
- Test: `test/chat-enqueue.test.js`

1. Validate `clientRequestId` and a trimmed 1-1,000 character question.
2. Call `enqueue_chat_message` so ownership, messages, run, and one credit reservation share one transaction.
3. Return the original run for duplicate client request IDs.
4. Start the workflow after commit and return `202` immediately.
5. If workflow start fails, persist a recoverable run failure and refund once.

---

## Phase C: Restricted Agent and durable workflow

### Task 7: Build report-only context tools

**Files:**
- Create: `apps/api/src/agent/reportTools.js`
- Create: `apps/api/src/agent/prompt.js`
- Test: `test/chat-agent-context.test.js`

1. Expose only report overview, report section, stored manse facts, and current conversation history.
2. Reject arbitrary URLs, external searches, other archive IDs, and manse recalculation.
3. Treat report text as untrusted quoted context and cap recent history to ten pairs.
4. Produce Korean responses with an explicit insufficient-evidence behavior.

### Task 8: Add persisted generation steps

**Files:**
- Create: `apps/api/src/workflows/chatWorkflow.js`
- Create: `apps/api/src/agent/chatAgent.js`
- Modify: `apps/api/src/domain/chatRepository.js`
- Test: `test/chat-workflow.test.js`

1. Mark the run running and persist a status event.
2. Run at most four agent/model steps with a 1,600-token response cap.
3. Store 200-500 character deltas and periodically update the assistant draft.
4. On success persist the final message, usage, model, completion event, and consumed credit state.
5. On permanent failure persist the error, refund exactly once, and emit an error event.

### Task 9: Integrate Workflow DevKit

**Files:**
- Modify: `apps/api/package.json`
- Create or modify the API build integration required by Workflow DevKit
- Modify: `apps/api/src/workflows/runner.js`
- Test: `test/workflow-runner.test.js`

1. Add `workflow` using the supported Vercel framework adapter.
2. Implement `WorkflowRunner.start(runId)` with `start()` and persist `workflow_run_id`.
3. Keep an injectable inline runner for unit tests only.
4. Verify the Vercel build exposes Workflow protocol routes and the HTTP gateway.

---

## Phase D: Recoverable SSE and chat UI

### Task 10: Add replayable SSE

**Files:**
- Create: `apps/api/src/http/chatEvents.js`
- Modify: `apps/api/src/gateway.js`
- Test: `test/chat-sse.test.js`

1. Authorize run ownership.
2. Send an initial `replace` snapshot.
3. Replay events strictly after `Last-Event-ID`.
4. Poll at no more than once per second, heartbeat every 15 seconds, and close after completion/failure.
5. Treat SSE disconnect as transport-only; never cancel the workflow.

### Task 11: Build the distinct AI chatbot interface

**Files:**
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/app.js`
- Modify: `apps/web/public/styles.css`
- Create: `apps/web/public/chat-stream.js`
- Test: `test/chat-ui.test.js`
- Test: `test/chat-stream-ui.test.js`

1. Add a separate `AI 챗봇 상담` entry, not inside the current follow-up view.
2. Implement credit package purchase, report selection, session list, conversation, and composer states.
3. Optimistically add a user bubble, replace it with server IDs, and attach SSE to the returned run.
4. Reconnect with `Last-Event-ID` and exponential backoff.
5. Restore queued/running/completed/failed state after navigation or reload.

### Task 12: End-to-end verification and deployment documentation

**Files:**
- Modify: `SETUP.md`
- Modify: `package.json`
- Add focused integration tests under `test/`

1. Run the full test and syntax suites.
2. Build both `apps/web` and `apps/api` Vercel projects.
3. Verify one credit for concurrent duplicate sends and one refund for repeated failure handling.
4. Verify no external-information tool or URL is available to the Agent.
5. Document schema rollout, environment variables, Fluid Compute, Workflow Beta, and two-project Vercel setup.

---

## Phase E: Existing 990 KRW follow-up recovery

Implement only after the chatbot is independently usable. Add `followup_requests`, durable execution, status/history screens, recovery-token access for guests, and order-detail links without sharing chat credits, messages, or UI state.
