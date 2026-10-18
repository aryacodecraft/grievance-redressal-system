// Voice-assisted intake (DEC-038): pure state machine, API client, and the
// full conversation flow inside SubmitForm with mocked audio/network.

import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { sourceLoader } from "./voice-test-loader.mjs";

// ---------------------------------------------------------------------------
// Domain logic: intake reducer, question policy, merge rules (no DOM).
// ---------------------------------------------------------------------------

const intake = sourceLoader()("lib/voice/intake.ts");
const { intakeReducer, initialIntakeState, planNextStep, computeLocks, mergeExtraction, intakeStep, toExtraction, questionTemplateKey } = intake;

const extraction = {
  title: "Streetlight not working",
  description: "The streetlight outside my house has been dark for three days.",
  locationText: "Sector 9, Rohini",
  category: "electricity",
  priority: "high",
  question: null,
};
const base = (overrides = {}) => ({ ...initialIntakeState, ...overrides });

test("planNextStep asks only what is missing, at most once per kind", () => {
  const input = {
    extraction,
    description: extraction.description,
    hasCoords: false,
    detailsAsked: false,
    locationAsked: false,
    clarifyAsked: false,
  };
  assert.deepEqual(planNextStep({ ...input, description: "too short" }), { kind: "details", optional: false, text: null });
  assert.deepEqual(planNextStep(input), { kind: "location", optional: false, text: null });
  assert.deepEqual(
    planNextStep({ ...input, hasCoords: true, extraction: { ...extraction, question: "Which lane?" } }),
    { kind: "clarify", optional: true, text: "Which lane?" },
  );
  assert.equal(planNextStep({ ...input, hasCoords: true }), null);
  assert.equal(planNextStep({ ...input, locationAsked: true }), null);
  assert.deepEqual(planNextStep({ ...input, description: "short", detailsAsked: true }), { kind: "location", optional: false, text: null });
  assert.equal(
    planNextStep({ ...input, hasCoords: true, extraction: { ...extraction, question: "Which lane?" }, clarifyAsked: true }),
    null,
  );
});

test("reducer drives the legal conversation flow and blocks invalid transitions", () => {
  let state = intakeReducer(initialIntakeState, { type: "START" });
  assert.equal(state.phase, "listening");
  assert.equal(state.resume, "idle");
  assert.equal(intakeReducer(state, { type: "START" }), state, "double START is a no-op");

  state = intakeReducer(state, { type: "RECORDING_STOPPED" });
  assert.equal(state.phase, "transcribing");
  assert.equal(intakeReducer(state, { type: "EXTRACTED", extraction, plan: null }), state, "extraction before the utterance is ignored");

  state = intakeReducer(state, { type: "UTTERANCE_ADDED", text: "  The light is broken  " });
  assert.equal(state.phase, "processing");
  assert.deepEqual(state.utterances, ["The light is broken"]);
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].role, "user");
  assert.equal(intakeReducer(state, { type: "UTTERANCE_ADDED", text: "again" }), state, "no second utterance while processing");

  state = intakeReducer(state, { type: "EXTRACTED", extraction, plan: { kind: "location", optional: false, text: "Where?" } });
  assert.equal(state.phase, "awaiting_answer");
  assert.deepEqual(state.asked, ["Where?"]);
  assert.equal(state.locationAsked, true);
  assert.equal(state.messages.at(-1).role, "assistant");

  state = intakeReducer(state, { type: "START" });
  assert.equal(state.resume, "awaiting_answer");
  state = intakeReducer(state, { type: "RECORDING_CANCELLED" });
  assert.equal(state.phase, "awaiting_answer", "cancelling returns to the question");

  state = intakeReducer(state, { type: "UTTERANCE_ADDED", text: "Near the park gate" });
  state = intakeReducer(state, { type: "EXTRACTED", extraction, plan: null });
  assert.equal(state.phase, "ready_for_review");
  assert.equal(state.pending, null);
  assert.deepEqual(state.utterances, ["The light is broken", "Near the park gate"]);
});

test("reducer suppresses redundant questions, supports failures and resets", () => {
  let typed = intakeReducer(initialIntakeState, { type: "UTTERANCE_ADDED", text: "Typed first message" });
  assert.equal(typed.phase, "processing", "a typed first message works from idle");
  typed = intakeReducer(typed, { type: "FAILED", step: "extract", errorKey: "voiceFailure" });
  typed = intakeReducer(typed, { type: "UTTERANCE_ADDED", text: "Typed recovery" });
  assert.equal(typed.phase, "processing", "typing after a failure replaces the failed attempt");

  let state = base({ phase: "processing", locationAsked: true });
  state = intakeReducer(state, { type: "EXTRACTED", extraction, plan: { kind: "location", optional: false, text: "Again?" } });
  assert.equal(state.phase, "ready_for_review", "an already-asked kind never repeats");

  state = base({ phase: "awaiting_answer", pending: { kind: "details", optional: false, text: "More?" } });
  state = intakeReducer(state, { type: "QUESTION_SKIPPED" });
  assert.equal(state.phase, "ready_for_review");
  assert.equal(state.pending, null);

  state = base({ phase: "transcribing" });
  state = intakeReducer(state, { type: "FAILED", step: "transcribe", errorKey: "voiceTimeout" });
  assert.equal(state.phase, "error");
  state = intakeReducer(state, { type: "RETRY" });
  assert.equal(state.phase, "transcribing");
  assert.equal(state.errorKey, null);

  state = base({ phase: "processing" });
  state = intakeReducer(state, { type: "FAILED", step: "extract", errorKey: "voiceFailure" });
  state = intakeReducer(state, { type: "RETRY" });
  assert.equal(state.phase, "processing", "extract retries re-run the extraction");

  state = intakeReducer(state, { type: "RESET" });
  assert.deepEqual(state, initialIntakeState);

  assert.equal(intakeStep(base({ phase: "awaiting_answer" })), "clarify");
  assert.equal(intakeStep(base({ phase: "ready_for_review" })), "review");
  assert.equal(intakeStep(base()), "describe");
});

test("merge rules preserve citizen edits and let AI refresh its own fields", () => {
  const empty = { title: "", description: "" };
  const unlocked = { title: false, description: false };

  let result = mergeExtraction({
    current: empty,
    locks: unlocked,
    ai: { title: false, description: false },
    extraction,
  });
  assert.deepEqual(result.values, { title: extraction.title, description: extraction.description });
  assert.deepEqual(result.ai, { title: true, description: true });
  assert.equal(result.changed.length, 2);

  result = mergeExtraction({
    current: { title: "Citizen title", description: "Citizen description text long enough" },
    locks: { title: true, description: true },
    ai: { title: false, description: false },
    extraction,
  });
  assert.deepEqual(result.values, { title: "Citizen title", description: "Citizen description text long enough" });
  assert.deepEqual(result.changed, []);

  const refreshed = mergeExtraction({
    current: { title: "Old AI title", description: "Old AI description" },
    locks: unlocked,
    ai: { title: true, description: true },
    extraction,
  });
  assert.equal(refreshed.values.title, extraction.title, "AI-owned fields are refined");

  const nulls = mergeExtraction({
    current: { title: "Keep me", description: "Keep my description too" },
    locks: unlocked,
    ai: { title: false, description: false },
    extraction: { title: null, description: null, locationText: null, category: null, priority: null, question: null },
  });
  assert.deepEqual(nulls.values, { title: "Keep me", description: "Keep my description too" });

  assert.deepEqual(
    computeLocks({ values: empty, dirty: { title: false, description: false }, ai: { title: false, description: false } }),
    { title: false, description: false },
  );
  assert.deepEqual(
    computeLocks({ values: { title: "Manual", description: "" }, dirty: { title: false, description: false }, ai: { title: false, description: false } }),
    { title: true, description: false },
    "citizen-written content is locked",
  );
  assert.deepEqual(
    computeLocks({ values: { title: "AI", description: "AI text" }, dirty: { title: false, description: false }, ai: { title: true, description: true } }),
    { title: false, description: false },
    "AI-written content may be refreshed",
  );
  assert.deepEqual(
    computeLocks({ values: empty, dirty: { title: true, description: true }, ai: { title: true, description: true } }),
    { title: true, description: true },
    "dirty fields stay locked even when AI-owned",
  );
});

test("response mapping and template keys", () => {
  assert.deepEqual(toExtraction({ title: null, description: "D", location_text: "L", category: null, priority: "low", question: "Q" }), {
    title: null,
    description: "D",
    locationText: "L",
    category: null,
    priority: "low",
    question: "Q",
  });
  assert.equal(questionTemplateKey("location"), "intakeQuestionLocation");
  assert.equal(questionTemplateKey("details"), "intakeQuestionDetails");
  assert.equal(questionTemplateKey("clarify"), "intakeQuestionClarify");
});

// ---------------------------------------------------------------------------
// API client: POST /grievance-intake/extract.
// ---------------------------------------------------------------------------

const api = sourceLoader()("lib/api.ts");
const originalFetch = global.fetch;
const tokens = new Map();
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const extractionBody = { title: "T", description: "D", location_text: null, category: "water", priority: null, question: null };

beforeEach(() => {
  global.window = {};
  global.localStorage = {
    getItem: (key) => tokens.get(key) ?? null,
    setItem: (key, value) => tokens.set(key, value),
    removeItem: (key) => tokens.delete(key),
  };
  tokens.clear();
  api.setStoredTokens("mock-access", "mock-refresh");
  global.fetch = () => { throw new Error("Unmocked network is forbidden"); };
});
afterEach(() => { global.fetch = originalFetch; delete global.window; delete global.localStorage; });

test("extract posts JSON with bearer token and validates the reply", async () => {
  let seen;
  global.fetch = async (url, init) => {
    seen = { url, init };
    return response(extractionBody);
  };
  const result = await api.extractVoiceIntake({
    utterances: ["hello"],
    language: "en-IN",
    draft: { title: "", description: "" },
    asked_questions: ["Where?"],
  });
  assert.ok(seen.url.endsWith("/grievance-intake/extract"));
  assert.equal(seen.init.headers.Authorization, "Bearer mock-access");
  assert.equal(seen.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(seen.init.body), {
    utterances: ["hello"],
    language: "en-IN",
    draft: { title: "", description: "" },
    asked_questions: ["Where?"],
  });
  assert.equal(result.title, "T");
});

test("missing token never calls the network", async () => {
  api.clearStoredTokens();
  await assert.rejects(api.extractVoiceIntake({ utterances: ["x"], language: "en-IN" }), (error) => error.status === 401);
});

for (const status of [400, 502, 503, 504]) {
  test(`HTTP ${status} is surfaced once without automatic retries`, async () => {
    tokens.delete("grievai-refresh-token");
    let calls = 0;
    global.fetch = async () => { calls += 1; return response({ error: "mock failure" }, status); };
    await assert.rejects(api.extractVoiceIntake({ utterances: ["x"], language: "en-IN" }), (error) => error.status === status);
    assert.equal(calls, 1);
  });
}

test("malformed extraction replies are rejected by Zod", async () => {
  for (const body of [{}, { ...extractionBody, title: 5 }, { ...extractionBody, category: "space" }, { ...extractionBody, priority: "urgent" }]) {
    global.fetch = async () => response(body);
    await assert.rejects(api.extractVoiceIntake({ utterances: ["x"], language: "en-IN" }));
  }
});

test("intake timeout aborts a stalled request", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  global.fetch = async (_, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const pending = api.extractVoiceIntake({ utterances: ["x"], language: "en-IN" });
  context.mock.timers.tick(api.INTAKE_TIMEOUT_MS);
  await assert.rejects(pending, (error) => error.name === "AbortError");
  context.mock.timers.reset();
});
