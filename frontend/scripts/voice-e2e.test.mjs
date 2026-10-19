// Cross-stack voice intake E2E: the real conversational intake UI drives the
// real `lib/api.ts` client against the pytest loopback harness, which forwards
// validated WAVs to a mocked Sarvam provider and answers extraction with a
// canned reply (no LLM, no external network).
//
// Runs only when `VOICE_E2E_URL` is set (the opt-in pytest harness,
// `VOICE_E2E=1 pytest tests/test_voice_e2e.py`, supplies it); `npm run
// test:voice` never starts a backend or makes network requests.
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { sourceLoader } from "./voice-test-loader.mjs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.localStorage = dom.window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.HTMLElement = dom.window.HTMLElement;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import("react-dom/client");

const base = process.env.VOICE_E2E_URL;
assert.ok(base, "VOICE_E2E_URL is required (run via tests/test_voice_e2e.py)");
assert.equal(new URL(base).hostname, "127.0.0.1");
const nativeFetch = global.fetch;
global.fetch = (url, init) => {
  assert.equal(new URL(url).origin, base, "External HTTP is forbidden in voice E2E");
  return nativeFetch(url, init);
};

const { encodeWav } = sourceLoader()("lib/voice/audio.ts");
const actualApi = sourceLoader()("lib/api.ts");
const wav = encodeWav(new Float32Array(1600).fill(0.2));

let root, container;
const captures = [];
const speechCalls = [];

class FakeCapture {
  constructor(onComplete, onError, onLevel) {
    this.onComplete = onComplete;
    this.onError = onError;
    this.onLevel = onLevel;
    captures.push(this);
  }
  async start() { this.started = true; this.onLevel?.(0.5); }
  async stop() { this.stopped = true; return new Blob([wav], { type: "audio/wav" }); }
  dispose() { this.disposed = true; }
}

class FakeSpeechPlayer {
  unlock() { speechCalls.push({ type: "unlock" }); }
  play(url) { speechCalls.push({ type: "play", url }); return Promise.resolve("played"); }
  stopCurrent() { speechCalls.push({ type: "stop" }); }
  dispose() { speechCalls.push({ type: "dispose" }); }
}

const mockApi = {
  transcribeAudio: (...args) => actualApi.transcribeAudio(...args),
  extractVoiceIntake: (...args) => actualApi.extractVoiceIntake(...args),
  submitGrievance: async () => { throw new Error("Voice E2E must not submit a grievance"); },
};

const load = sourceLoader({
  "@/lib/api": mockApi,
  "@/lib/session": { useDemoUser: () => ({ user: { id: "voice-e2e-citizen" } }) },
  "@/components/ui/ToastProvider": { useToast: () => ({ notify: () => {} }) },
  "@/lib/voice/capture": { VoiceCapture: FakeCapture, recordingSupported: () => true },
  "@/lib/voice/speech": {
    SpeechPlayer: FakeSpeechPlayer,
    readMuted: () => window.localStorage.getItem("grievai-voice-muted") === "true",
    writeMuted: (muted) => window.localStorage.setItem("grievai-voice-muted", muted ? "true" : "false"),
    questionAudioUrl: (kind, language) => `/voice/questions/${kind}.${language}.wav`,
  },
  "./GrievanceCard": { AnalysisPanel: () => null },
  "./ImageUpload": { ImageUpload: () => null },
  "./LocationCapture": { LocationCapture: () => null },
});
const { I18nProvider } = load("lib/i18n/index.tsx");
const { SubmitForm } = load("components/grievance/SubmitForm.tsx");

const providerTexts = {
  "en-IN": "The water supply has been interrupted since yesterday.",
  "hi-IN": "पानी की आपूर्ति कल से बंद है। कृपया सहायता करें।",
  "mr-IN": "कालपासून पानीपुरवठा बंद आहे. कृपया मदत करा.",
};
const locationQuestion = {
  "en-IN": "Where exactly is the issue located",
  "hi-IN": "यह समस्या ठीक कहाँ है",
  "mr-IN": "ही समस्या नेमकी कुठे आहे",
};

beforeEach(() => {
  captures.length = 0;
  speechCalls.length = 0;
  window.localStorage.clear();
  actualApi.setStoredTokens(process.env.VOICE_E2E_TOKEN);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount() {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(SubmitForm))));
}

function button(label) {
  const result = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === label || (node.textContent ?? "").startsWith(label),
  );
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function click(label) {
  await act(async () => button(label).click());
  await settle();
}

async function waitFor(check, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (check()) return;
    assert.ok(Date.now() < deadline, `Timed out waiting for ${label}`);
    await settle();
  }
}

async function chooseLanguage(code) {
  const select = container.querySelector("#intake-language");
  assert.ok(select, "intake language select missing");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(select, code);
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

async function typedAnswer(text) {
  await click("Type instead");
  const textarea = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(textarea, text);
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("Send");
}

async function enterVoice() {
  await mount();
  await click("Tell us your problem");
}

async function useScenario(mode) {
  const res = await fetch(`${base}/__voice_test/scenario?mode=${mode}`);
  assert.ok(res.ok, `scenario ${mode}`);
}

const stats = async () => (await fetch(`${base}/__voice_test/stats`)).json();

for (const [language, transcript] of Object.entries(providerTexts)) {
  test(`actual ${language} WAV traverses the intake into the conversation`, async () => {
    await useScenario("success");
    await enterVoice();
    await chooseLanguage(language);
    const before = await stats();

    await click("Start speaking");
    await click("Stop recording");
    await waitFor(() => container.textContent.includes(transcript), "provider transcript");
    await waitFor(() => container.textContent.includes(locationQuestion[language]), "follow-up question");

    const after = await stats();
    assert.equal(after.posts, before.posts + 1);
    assert.equal(after.provider, before.provider + 1);
    assert.equal(after.extractions, before.extractions + 1);
    assert.ok(
      speechCalls.some((call) => call.type === "play" && call.url === `/voice/questions/location.${language}.wav`),
      "the follow-up question is spoken in the selected language",
    );
  });
}

test("the canned extraction reaches the read-only review", async () => {
  await useScenario("success");
  await enterVoice();
  await click("Start speaking");
  await click("Stop recording");
  await waitFor(() => container.textContent.includes("Where exactly is the issue located"), "location question");

  await typedAnswer("Near the park gate");
  await waitFor(() => container.textContent.includes("Review your complaint"), "review");

  assert.ok(container.textContent.includes("Water supply interrupted"), "AI title shown");
  assert.ok(
    container.textContent.includes("The water supply has been interrupted since yesterday."),
    "AI description shown",
  );
  const hidden = [...container.querySelectorAll('input[type="hidden"]')];
  assert.equal(hidden.length, 2, "the review keeps title and description in the payload");
  assert.equal(hidden[0].value, "Water supply interrupted");
  assert.equal(hidden[1].value, "The water supply has been interrupted since yesterday.");
  assert.equal(container.querySelector("textarea"), null, "the voice review is read-only");
  assert.equal(container.querySelector('button[type="submit"]'), null, "no submit in this harness");
});

for (const [mode, providerCalls] of [["disabled", 0], ["failure", 1], ["timeout", 1], ["invalid_response", 1]]) {
  test(`backend ${mode} leaves the conversation recoverable`, async () => {
    await useScenario(mode);
    await enterVoice();
    const before = await stats();

    await click("Start speaking");
    await click("Stop recording");
    await waitFor(() => container.querySelector('[role="alert"]'), "error alert");

    const after = await stats();
    assert.equal(after.posts, before.posts + 1);
    assert.equal(after.provider, before.provider + providerCalls);
    assert.equal(after.extractions, before.extractions, "failed transcription never reaches extraction");
    assert.equal(container.querySelector("textarea"), null, "no review opened");
    assert.equal(container.querySelector('button[type="submit"]'), null);
  });
}

test("actual HTTP rejects bad JWT, audio and multipart without provider calls", async () => {
  const before = await stats();
  const blob = new Blob([wav], { type: "audio/wav" });

  await assert.rejects(actualApi.transcribeAudio(blob, "en-IN", "invalid-token"), (error) => error.status === 401);
  actualApi.setStoredTokens(process.env.VOICE_E2E_TOKEN);
  for (const [candidate, status] of [
    [new Blob(["not WAV"]), 415],
    [blob.slice(0, 50), 400],
    [new Blob([new Uint8Array(1048577)]), 413],
    [new Blob([new Uint8Array(2097153)]), 413],
  ]) {
    await assert.rejects(
      actualApi.transcribeAudio(candidate, "en-IN", crypto.randomUUID()),
      (error) => error.status === status,
    );
  }

  const missing = await fetch(`${base}/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOICE_E2E_TOKEN}` },
    body: new FormData(),
  });
  assert.equal(missing.status, 400);
  const form = new FormData();
  form.append("file", blob, "recording.wav");
  form.append("language_code", "en-IN");
  assert.equal((await fetch(`${base}/transcribe`, { method: "POST", body: form })).status, 401);
  assert.equal((await stats()).provider, before.provider);
});
