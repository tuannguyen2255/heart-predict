const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

function loadBrowserModule(file, initial = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, window: { localStorage: storage } });
  return { api: exports, values };
}

test("fresh login replaces the legacy session and supplies the current token", () => {
  const { api, values } = loadBrowserModule("lib/client-session.ts", { access_token: "old.session.signature" });
  api.saveSession("new.session.signature", "alice");
  assert.equal(api.getAccessToken(), "new.session.signature");
  assert.equal(values.get("username"), "alice");
  assert.equal(values.has("access_token"), false);
});

test("existing token-only sessions work without another login", () => {
  const { api } = loadBrowserModule("lib/client-session.ts", { token: "valid.session.signature" });
  assert.equal(api.getAccessToken(), "valid.session.signature");
});

test("invalid registration token does not mask a legacy token", () => {
  const { api } = loadBrowserModule("lib/client-session.ts", {
    token: "undefined", access_token: "valid.legacy.signature",
  });
  assert.equal(api.getAccessToken(), "valid.legacy.signature");
});

test("missing or invalid tokens cannot create a signed-in session", () => {
  const { api, values } = loadBrowserModule("lib/client-session.ts");
  for (const value of [undefined, null, "undefined", "null", "", "a..b"]) {
    assert.throws(() => api.saveSession(value, "alice"));
  }
  assert.equal(api.getAccessToken(), null);
  assert.equal(values.has("username"), false);
});

test("logout clears both token names and keeps language preference", () => {
  const { api, values } = loadBrowserModule("lib/client-session.ts", {
    token: "one.two.three", access_token: "four.five.six", username: "alice", language: "vi",
  });
  api.clearSession();
  assert.equal(api.getAccessToken(), null);
  assert.equal(values.get("language"), "vi");
});

test("HTML gateway timeout remains a timeout message", async () => {
  const { api } = loadBrowserModule("lib/api-errors.ts");
  const message = await api.apiErrorMessage(new Response("<html>Gateway Timeout</html>", { status: 504 }));
  assert.match(message, /quá lâu/);
  assert.doesNotMatch(message, /đăng nhập/);
});

test("preserves backend timeout detail, distinguishes login expiry", async () => {
  const { api } = loadBrowserModule("lib/api-errors.ts");
  const response = new Response(JSON.stringify({ detail: "AI phản hồi quá lâu; thử lại." }), { status: 504 });
  assert.equal(await api.apiErrorMessage(response), "AI phản hồi quá lâu; thử lại.");
  assert.match(await api.apiErrorMessage(new Response("", { status: 401 })), /đăng nhập/);
});

test("formats FastAPI validation issues without object coercion", async () => {
  const { api } = loadBrowserModule("lib/api-errors.ts");
  const response = new Response(JSON.stringify({
    detail: [
      { loc: ["body", "oldpeak"], msg: "Input should be greater than or equal to -5", type: "greater_than_equal" },
      { loc: ["body", "height"], msg: "Input should be greater than or equal to 50", type: "greater_than_equal" },
    ],
  }), { status: 422, headers: { "content-type": "application/json" } });
  const message = await api.apiErrorMessage(response);
  assert.match(message, /Oldpeak/);
  assert.match(message, /Chiều cao/);
  assert.doesNotMatch(message, /\[object Object\]/);
});
