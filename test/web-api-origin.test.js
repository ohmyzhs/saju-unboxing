import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("browser entrypoints load runtime config before application code", () => {
  for (const path of ["../apps/web/public/index.html", "../apps/web/public/admin.html", "../apps/web/public/setup.html"]) {
    const html = read(path);
    assert.ok(html.indexOf("runtime-config.js") >= 0, `${path} loads runtime config`);
    assert.ok(html.indexOf("api-client.js") > html.indexOf("runtime-config.js"), `${path} loads API client after config`);
  }
});

test("browser API calls use the configured API client", () => {
  for (const path of ["../apps/web/public/app.js", "../apps/web/public/admin.js", "../apps/web/public/setup.html"]) {
    const source = read(path);
    assert.doesNotMatch(source, /(?<![.\w])fetch\((?:`|\")\/api\//, `${path} has no direct API fetch`);
  }
  const app = read("../apps/web/public/app.js");
  assert.doesNotMatch(app, /location\.href\s*=\s*"\/api\//);
  assert.match(app, /window\.SajuApi/);
});
