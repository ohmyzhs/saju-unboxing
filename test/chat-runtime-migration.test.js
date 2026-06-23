import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260623170000_chat_runtime_repair.sql", import.meta.url),
  "utf8",
);

test("챗봇 런타임 migration은 uuid-ossp 없이 안전한 UUID를 생성한다", () => {
  assert.doesNotMatch(schema, /^\s*\+/m, "patch marker가 schema SQL에 남아 있으면 안 된다");
  assert.doesNotMatch(migration, /^\s*\+/m, "patch marker가 SQL에 남아 있으면 안 된다");
  assert.doesNotMatch(schema, /uuid_generate_v4\s*\(/i);
  assert.doesNotMatch(migration, /uuid_generate_v4\s*\(/i);
  assert.match(migration, /create extension if not exists pgcrypto/i);
  assert.match(migration, /gen_random_uuid\s*\(/i);
  for (const table of ["events", "analyses", "users", "point_transactions", "chat_credit_transactions", "chat_sessions", "chat_messages", "chat_runs"]) {
    assert.match(migration, new RegExp(`alter table ${table}\\s+alter column id set default gen_random_uuid\\(\\)`, "i"));
  }
});

test("운영 복구 migration은 챗봇 필수 객체와 권한을 멱등 보장한다", () => {
  assert.match(migration, /alter table site_config\s+add column if not exists chat_model text/i);
  for (const table of [
    "chat_credit_accounts",
    "chat_credit_transactions",
    "chat_sessions",
    "chat_messages",
    "chat_runs",
    "chat_stream_events",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`, "i"));
  }
  for (const fn of [
    "create_chat_session",
    "grant_chat_credits",
    "reserve_chat_credit",
    "refund_chat_credit",
    "enqueue_chat_message",
    "fail_chat_run",
    "claim_chat_run",
    "append_chat_draft",
    "complete_chat_run",
  ]) {
    assert.match(migration, new RegExp(`create or replace function ${fn}`, "i"));
    assert.match(migration, new RegExp(`grant execute on function ${fn}\\(`, "i"));
  }
  assert.match(migration, /alter table orders\s+add column if not exists fulfillment_status text/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
});
