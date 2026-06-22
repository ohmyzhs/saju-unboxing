import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

test("web and API have independent Vercel project roots", () => {
  assert.equal(existsSync(new URL("apps/web/vercel.json", root)), true);
  assert.equal(existsSync(new URL("apps/api/vercel.json", root)), true);
  assert.equal(existsSync(new URL("apps/web/public/index.html", root)), true);
  assert.equal(existsSync(new URL("apps/api/api/gateway.js", root)), true);
  const apiConfig = JSON.parse(readFileSync(new URL("apps/api/vercel.json", root), "utf8"));
  assert.equal(apiConfig.outputDirectory, "public");
});

test("the root compatibility deployment exposes one gateway function", () => {
  const config = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
  assert.equal(config.outputDirectory, "apps/web/public");
  assert.equal(existsSync(new URL("api/gateway.js", root)), true);
});
