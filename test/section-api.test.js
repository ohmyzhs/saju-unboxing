import test from "node:test";
import assert from "node:assert/strict";

import { validateSectionBatchInput } from "../apps/api/src/legacy/saju/section.js";

test("accepts one or two complete section descriptors", () => {
  const sections = [
    { id: "s0", title: "첫 제목", angle: "첫 핵심" },
    { id: "s1", title: "둘째 제목", angle: "둘째 핵심" },
  ];
  assert.deepEqual(validateSectionBatchInput(sections), sections);
  assert.deepEqual(validateSectionBatchInput(sections.slice(0, 1)), sections.slice(0, 1));
});

test("rejects empty and oversized batches", () => {
  assert.throws(() => validateSectionBatchInput([]), /1~2개/);
  assert.throws(() => validateSectionBatchInput([
    { id: "s0", title: "1", angle: "1" },
    { id: "s1", title: "2", angle: "2" },
    { id: "s2", title: "3", angle: "3" },
  ]), /1~2개/);
});

test("rejects incomplete batch section descriptors", () => {
  assert.throws(
    () => validateSectionBatchInput([{ id: "s0", title: "제목" }]),
    /id, title, angle/,
  );
  assert.throws(
    () => validateSectionBatchInput([{ id: "", title: "제목", angle: "핵심" }]),
    /id, title, angle/,
  );
});
