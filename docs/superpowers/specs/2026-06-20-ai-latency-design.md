# AI model routing and report latency design

## Goal

Keep the report contract and visible amount of content unchanged while reducing
the time and repeated prompt processing needed to generate section bodies. Add
`deepseek-v4-flash` and `minimax-m3` as working administrator model choices.

“Same result” means the same response fields, section count, section order,
body-length rules, safety rules, and progressive rendering behavior. Generated
wording cannot be byte-identical because model output is nondeterministic and
administrators may select a different model.

## Current behavior and bottleneck

The analysis endpoint first generates a plan containing 7–10 sections (6–8 for
compatibility). The browser then starts one `/api/saju/section` request per
section with `Promise.all`. Calls are already parallel, but every request repeats
the full product prompt, the full saju context, and all title constraints. Most
of those instructions apply only to planning and are redundant during body
generation.

The current OpenAI-compatible client can call `deepseek-v4-flash`. OpenCode Go
exposes `minimax-m3` through the Anthropic-compatible `/messages` endpoint, so a
model-aware transport is required rather than only adding a select option.

## Chosen approach

### 1. Model profiles and transport routing

- Keep `glm-5.2` and `kimi-k2.7-code` behavior available.
- Add `deepseek-v4-flash` to the OpenAI-compatible chat-completions profile.
- Add `minimax-m3` to the Anthropic-compatible messages profile.
- Route by a small explicit model profile map. Unknown saved models retain the
  current OpenAI-compatible behavior for backward compatibility.
- Use strict `json_schema` where the selected endpoint accepts it. For a profile
  without strict schema support, require JSON-only output, extract the JSON text,
  parse it, and validate the required response shape. Retry once only when the
  response is unparsable or structurally invalid.

### 2. Section-only compact prompt

The planning call keeps the complete product prompt because it determines the
headline, section selection, title diversity, lucky data, and report structure.

Section-body calls receive a compact prompt containing only rules that can
affect a body:

- the selected section title and angle;
- the subject names and full saju context;
- 3–4 paragraph body length;
- Korean, honorific tone, concrete daily-life interpretation;
- no hanja or exposed saju terminology;
- no fear, medical, disaster, investment, or deterministic claims;
- no duplication with the other section titles;
- body-only JSON response.

Planning-only title construction, headline, score, lucky-item, and global
section-count instructions are omitted. Administrator extra instructions remain
included so existing customization is not lost.

### 3. Two-section parallel batches

- The browser groups sections in original order, two per batch.
- It starts all batches concurrently. A 7–10 section report therefore uses 4–5
  body requests instead of 7–10.
- `/api/saju/section` accepts either the existing single `section` payload or a
  new `sections` array, preserving backward compatibility.
- A batch response returns `{ sections: [{ id, body }] }` and the browser fills
  each matching placeholder as soon as that batch finishes.
- The final archive is written only after all batches settle, exactly as today.
- A failed batch retries its two members as existing single-section requests.
  Failure remains isolated to those sections; other completed content stays
  visible.

This combines prompt reduction with fewer repeated contexts and fewer network
round trips without converting the report into one large, timeout-prone call.

## Data flow

1. `/api/saju/analyze` computes manse and generates the unchanged report plan.
2. The browser renders the headline, lucky data, titles, and placeholders.
3. The browser partitions plan sections into ordered pairs and sends all pairs
   to `/api/saju/section` concurrently.
4. The section endpoint loads the configured model once per request, selects the
   proper transport, and generates both bodies from one compact prompt.
5. The browser merges bodies by section id and preserves plan order.
6. After all batches settle, the complete report is archived and the existing
   completion event is emitted.

## Error handling

- Invalid or empty AI output returns a normal JSON error with the current status
  handling.
- Structured-output fallback is model-profile-specific; it is not triggered for
  every successful call.
- Batch shape validation requires exactly the requested ids and non-empty body
  strings. Unknown, duplicate, or missing ids fail the batch.
- Browser fallback retries failed batch members individually and uses the
  existing temporary placeholder only if the individual retry also fails.
- Existing unknown administrator model values remain visible as “current,
  unverified” and are not silently replaced.

## Administrator UI

The model selector contains:

- `glm-5.2` (default)
- `kimi-k2.7-code`
- `deepseek-v4-flash` (speed-oriented)
- `minimax-m3`

The current warning that DeepSeek and MiniMax always fail is replaced with an
endpoint-aware explanation. Saving behavior and `site_config.ai_model` remain
unchanged.

## Testing and acceptance

Tests are written before production changes and cover:

- administrator HTML exposes both new exact model ids;
- model profiles route DeepSeek to chat completions and MiniMax to messages;
- JSON text extraction and malformed-output rejection;
- batch output validation, including missing and duplicate ids;
- two-item grouping preserves order for odd and even section counts;
- batch failure can fall back to single-section generation;
- existing single-section request and response contracts still work.

Acceptance checks:

- a 7–10 section plan still renders and archives 7–10 ordered bodies;
- compatibility still renders and archives 6–8 ordered bodies;
- section body requirements remain 3–4 paragraphs;
- body-generation request count becomes `ceil(sectionCount / 2)` when batches
  succeed;
- all modified JavaScript files pass syntax checks and the automated tests pass;
- no deployment, model-default change, or administrator selection change is made
  automatically.

## Out of scope

- Reducing report section count or paragraph count.
- Changing the default model automatically.
- Rewriting the plan prompt or saju interpretation rules.
- Adding streaming transport or changing archive persistence semantics.
- Guaranteeing identical prose across nondeterministic or different models.
