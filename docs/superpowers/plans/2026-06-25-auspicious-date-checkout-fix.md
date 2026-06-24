# Paid Auspicious-Date Checkout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the paid `auspicious-date` product flow from calendar selection through checkout and report generation, and make neutral page headers readable.

**Architecture:** Keep the existing product catalog, checkout, payment recovery, and report-plan pipeline. Add `auspicious-date` as a first-class product, carry a validated `{ purpose, dates }` selection through every existing purchase boundary, and include it in the report context and prompt. Change neutral `.view-title` colors at the shared CSS rule while preserving white text on colored headers.

**Tech Stack:** Browser JavaScript, Node.js API handlers, Node test runner, CSS.

---

### Task 1: Add failing paid 택일 flow tests

**Files:**
- Create: `test/auspicious-date-flow.test.js`

- [ ] Assert that the web and admin catalogs define `auspicious-date`, calendar confirmation opens that product, and `calendarPick` crosses checkout, purchase recovery, and analysis request boundaries.
- [ ] Assert that `buildPlanPrompt()` includes the selected purpose and candidate dates.
- [ ] Assert that neutral `.view-title` and its button use dark text while `.emerald` and `.rose` retain white text.
- [ ] Run `node --test test/auspicious-date-flow.test.js` and confirm the assertions fail against the current hard-coded `saju-analysis` flow.

### Task 2: Restore the paid product and context propagation

**Files:**
- Modify: `apps/web/public/app.js`
- Modify: `apps/web/public/admin.js`

- [ ] Add a paid `auspicious-date` catalog row using plan `fortune`, with a local fallback price and runtime-config override support.
- [ ] Change calendar confirmation to `openMemberModal("auspicious-date")`.
- [ ] Parse the stored calendar selection into `currentCheckout.calendarPick`, render its purpose and dates in checkout details, persist it in `purchase`, and forward it through point payment, Toss return, order retry, and `startAnalysis()`.
- [ ] Include `calendarPick: meta.calendarPick || null` in `/api/saju/analyze` requests.
- [ ] Add the same product to `DEFAULT_PRODUCTS` so admin-provided name, price, description, and prompt are retained.

### Task 3: Generate a dedicated 택일 report

**Files:**
- Modify: `apps/api/src/legacy/saju/analyze.js`
- Modify: `apps/api/src/legacy/_lib/analysis.js`

- [ ] Normalize calendar input to a non-empty purpose and 2-10 unique `YYYY-MM-DD` dates; reject invalid paid 택일 requests with HTTP 400.
- [ ] Register `auspicious-date` in API product names and the plan-based report branch.
- [ ] Add a 택일 plan focus, fallback sections, and section focus.
- [ ] Add the purpose and sorted candidate dates to the report context and prompt so the model compares only the user-selected dates.
- [ ] Run `node --test test/auspicious-date-flow.test.js` and confirm it passes.

### Task 4: Fix neutral header contrast and verify

**Files:**
- Modify: `apps/web/public/styles.css`

- [ ] Set the default `.view-title` color to `var(--ink)` and buttons to `currentColor`.
- [ ] Set `.view-title.emerald` and `.view-title.rose` back to white.
- [ ] Run `npm run check` and `npm test`; require exit code 0 from both.
- [ ] Inspect `git diff --check` and the final diff for unrelated changes.
