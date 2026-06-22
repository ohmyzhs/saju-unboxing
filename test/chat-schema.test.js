import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("챗봇 질의권과 대화 정본 테이블을 정의한다", () => {
  for (const table of [
    "chat_credit_accounts",
    "chat_credit_transactions",
    "chat_sessions",
    "chat_messages",
    "chat_runs",
    "chat_stream_events",
  ]) {
    assert.match(schema, new RegExp(`create table if not exists ${table}`, "i"));
  }
  assert.match(schema, /balance integer not null default 0 check \(balance >= 0\)/i);
  assert.match(schema, /unique \(user_id, source_archive_id\)/i);
  assert.match(schema, /unique \(session_id, client_request_id\)/i);
  assert.match(schema, /primary key \(run_id, seq\)/i);
});

test("구매·예약·환원·메시지 enqueue를 원자적 RPC로 정의한다", () => {
  for (const fn of [
    "create_chat_session",
    "fail_chat_run",
    "claim_chat_run",
    "append_chat_draft",
    "complete_chat_run",
    "grant_chat_credits",
    "reserve_chat_credit",
    "refund_chat_credit",
    "enqueue_chat_message",
  ]) {
    assert.match(schema, new RegExp(`create or replace function ${fn}`, "i"));
    assert.match(schema, new RegExp(`revoke all on function ${fn}\\(`, "i"));
    assert.match(schema, new RegExp(`grant execute on function ${fn}\\(`, "i"));
  }
  assert.match(schema, /for update/i);
  assert.match(schema, /insufficient_chat_credits/i);
  assert.match(schema, /on conflict \(session_id, client_request_id\)/i);
  assert.match(schema, /from user_data[\s\S]*kind = 'archive'/i);
  assert.match(schema, /pg_column_size\(archive_data\)/i);
});

test("주문 fulfillment 실패를 결제 상태와 분리해 재처리할 수 있다", () => {
  assert.match(schema, /alter table orders\s+add column if not exists fulfillment_status text/i);
  assert.match(schema, /alter table orders\s+add column if not exists fulfillment_error text/i);
  assert.match(schema, /alter table orders\s+add column if not exists fulfilled_at timestamptz/i);
});
