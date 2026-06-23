import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../apps/web/public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../apps/web/public/app.js", import.meta.url), "utf8");

test("궁합의 두 대상 슬롯에서 새 프로필을 즉시 추가할 수 있다", () => {
  assert.match(html, /data-compat-add="a"/);
  assert.match(html, /data-compat-add="b"/);
  assert.match(app, /profileReturnContext/);
  assert.match(app, /compatSlot/);
  assert.match(app, /showView\("compatibility"\)/);
  assert.match(app, /select\.value\s*=\s*profile\.id/);
  assert.match(app, /currentViewName === "profile"[\s\S]*profileReturnContext = null/);
});
