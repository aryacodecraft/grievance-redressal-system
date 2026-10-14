import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { sourceLoader } from "./voice-test-loader.mjs";

const api = sourceLoader()("lib/api.ts");
const originalFetch = global.fetch;
const tokens = new Map();
beforeEach(() => {
  global.window = {};
  global.localStorage = { getItem: (key) => tokens.get(key) ?? null, setItem: (key, value) => tokens.set(key, value), removeItem: (key) => tokens.delete(key) };
  tokens.clear(); api.setStoredTokens("mock-access", "mock-refresh");
  global.fetch = () => { throw new Error("Unmocked network is forbidden"); };
});
afterEach(() => { global.fetch = originalFetch; delete global.window; delete global.localStorage; });
const blob = () => new Blob([new Uint8Array(44)], { type: "audio/wav" });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

for (const [language, text] of [["en-IN", "A complaint"], ["hi-IN", "पानी बंद है।"], ["mr-IN", "पाणी बंद आहे."]]) {
  test(`multipart ${language}: JWT, no manual content-type, Unicode`, async () => {
    let calls = 0;
    global.fetch = async (url, init) => {
      calls++;
      assert.ok(url.endsWith("/transcribe"));
      assert.equal(init.headers.Authorization, "Bearer mock-access");
      assert.equal(init.headers["Idempotency-Key"], "one-attempt");
      assert.equal(init.headers["Content-Type"], undefined);
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get("file").name, "recording.wav");
      assert.equal(init.body.get("language_code"), language);
      return response({ transcript: text, language_code: language, request_id: "mock" });
    };
    assert.equal((await api.transcribeAudio(blob(), language, "one-attempt")).transcript, text);
    assert.equal(calls, 1);
  });
}

test("missing access token never sends audio", async () => {
  api.clearStoredTokens();
  await assert.rejects(api.transcribeAudio(blob(), "en-IN", "missing"), (error) => error.status === 401);
});

test("401 refresh retains multipart body and idempotency key", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/refresh")) return response({ access_token: "mock-renewed" });
    if (calls.length === 1) return response({ error: "expired" }, 401);
    return response({ transcript: "result", language_code: null });
  };
  await api.transcribeAudio(blob(), "en-IN", "same-key");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].init.body, calls[2].init.body);
  assert.equal(calls[2].init.headers["Idempotency-Key"], "same-key");
  assert.equal(calls[2].init.headers.Authorization, "Bearer mock-renewed");
  assert.equal(calls[1].init.headers["Content-Type"], "application/json");
});

for (const status of [401, 409, 429, 502, 503, 504]) {
  test(`HTTP ${status} is surfaced without paid request retries`, async () => {
    tokens.delete("grievai-refresh-token");
    let calls = 0;
    global.fetch = async () => { calls++; return response({ error: "mock failure" }, status); };
    await assert.rejects(api.transcribeAudio(blob(), "en-IN", "failure"), (error) => error.status === status);
    assert.equal(calls, 1);
  });
}

test("malformed/empty transcription rejected by Zod", async () => {
  for (const body of [{}, { transcript: " ", language_code: "hi-IN" }, { transcript: "text", language_code: "xx" }]) {
    global.fetch = async () => response(body);
    await assert.rejects(api.transcribeAudio(blob(), "en-IN", "schema"));
  }
});

test("network error is not retried", async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new TypeError("mock offline"); };
  await assert.rejects(api.transcribeAudio(blob(), "en-IN", "offline"));
  assert.equal(calls, 1);
});

test("total transcription timeout aborts a stalled request", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  global.fetch = async (_, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const pending = api.transcribeAudio(blob(), "en-IN", "timeout");
  context.mock.timers.tick(api.TRANSCRIPTION_TIMEOUT_MS);
  await assert.rejects(pending, (error) => error.name === "AbortError");
  context.mock.timers.reset();
});

test("existing JSON grievance submission contract remains unchanged", async () => {
  const payload = { title: "Title", description: "Existing typed description", userId: "citizen", latitude: 1, longitude: 2 };
  global.fetch = async (url, init) => {
    assert.ok(url.endsWith("/submit-grievance"));
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(init.body), payload);
    return response({ grievanceId: "mock-reference", message: "registered", hfEngine: { category: "water", priority: "low", isUrgent: false, keywords: [], explanation: "" } });
  };
  assert.equal((await api.submitGrievance(payload)).grievanceId, "mock-reference");
});

test("failed refresh never resends audio", async () => {
  let calls = 0;
  global.fetch = async (url) => { calls++; return response({ error: "invalid" }, url.endsWith("/auth/refresh") ? 403 : 401); };
  await assert.rejects(api.transcribeAudio(blob(), "en-IN", "invalid-jwt"), (error) => error.status === 401);
  assert.equal(calls, 2); assert.equal(api.getStoredAccessToken(), null);
});

test("cancelling a stalled refresh does not sign the citizen out", async () => {
  const controller = new AbortController();
  let enteredRefresh;
  const refreshed = new Promise((resolve) => { enteredRefresh = resolve; });
  global.fetch = async (url, init) => {
    if (!url.endsWith("/auth/refresh")) return response({ error: "expired" }, 401);
    enteredRefresh();
    return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("cancel", "AbortError"))));
  };
  const pending = api.transcribeAudio(blob(), "en-IN", "cancel-refresh", controller.signal);
  await refreshed; controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.equal(api.getStoredAccessToken(), "mock-access");
});
