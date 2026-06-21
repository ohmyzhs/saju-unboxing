import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Vercel Fluid Compute allows report APIs up to the Hobby maximum", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.functions["api/**/*.js"].maxDuration, 300);
  assert.equal(config.functions["api/**/*.js"].memory, 512);
});
