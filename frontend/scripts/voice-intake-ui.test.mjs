// Voice-assisted intake UI flow (DEC-038): the conversation inside SubmitForm
// with a fake microphone capture and scripted API responses.

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
let scrollCalls = 0;
dom.window.HTMLElement.prototype.scrollIntoView = () => { scrollCalls += 1; };
const { createRoot } = await import("react-dom/client");

let root, container;
let apiScript;
const apiCalls = { transcribe: [], extract: [], submit: [] };
const captures = [];
const speechCalls = [];

const mockApi = {
  transcribeAudio: (...args) => { apiCalls.transcribe.push(args); return apiScript.transcribe(...args); },
  extractVoiceIntake: (...args) => { apiCalls.extract.push(args); return apiScript.extract(...args); },
  submitGrievance: (...args) => { apiCalls.submit.push(args); return apiScript.submit(...args); },
};

class FakeCapture {
  constructor(onComplete, onError, onLevel) {
    this.onComplete = onComplete;
    this.onError = onError;
    this.onLevel = onLevel;
    this.started = false;
    this.disposed = false;
    captures.push(this);
  }
  async start() { this.started = true; this.onLevel?.(0.5); }
  async stop() { this.stopped = true; return new Blob([new Uint8Array(44)], { type: "audio/wav" }); }
  dispose() { this.disposed = true; }
}

let customPlay = null;

class FakeSpeechPlayer {
  unlock() { speechCalls.push({ type: "unlock" }); }
  play(url) {
    speechCalls.push({ type: "play", url });
    if (customPlay) return customPlay(url);
    return Promise.resolve("played");
  }
  stopCurrent() { speechCalls.push({ type: "stop" }); }
  dispose() { speechCalls.push({ type: "dispose" }); }
}

const mockSpeech = {
  SpeechPlayer: FakeSpeechPlayer,
  readMuted: () => window.localStorage.getItem("grievai-voice-muted") === "true",
  writeMuted: (muted) => window.localStorage.setItem("grievai-voice-muted", muted ? "true" : "false"),
  questionAudioUrl: (kind, language) => `/voice/questions/${kind}.${language}.wav`,
};

const load = sourceLoader({
  "@/lib/api": mockApi,
  "@/lib/session": { useDemoUser: () => ({ user: { id: "mock-citizen" } }) },
  "@/components/ui/ToastProvider": { useToast: () => ({ notify: () => {} }) },
  "@/lib/voice/capture": { VoiceCapture: FakeCapture, recordingSupported: () => true },
  "@/lib/voice/speech": mockSpeech,
  "./GrievanceCard": { AnalysisPanel: () => null },
  "./ImageUpload": {
    ImageUpload: ({ onChange, onBusyChange }) => React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          onBusyChange?.(true);
          onChange({ url: "https://img.example/photo.jpg", publicId: "photo" });
          onBusyChange?.(false);
        },
      },
      "Mock photo",
    ),
  },
  "./LocationCapture": {
    LocationCapture: ({ onChange, suggestedSearch }) => React.createElement(
      "div",
      null,
      React.createElement("span", { "data-suggest": suggestedSearch ? suggestedSearch.text : "" }),
      React.createElement("button", { type: "button", onClick: () => onChange({ latitude: 28.7, longitude: 77.1 }) }, "Mock location"),
    ),
  },
});
const { I18nProvider } = load("lib/i18n/index.tsx");
const { SubmitForm } = load("components/grievance/SubmitForm.tsx");

const extractionFull = {
  title: "Streetlight not working",
  description: "The streetlight outside my house has been dark for three days and it is unsafe at night.",
  location_text: "Sector 9, Rohini",
  category: "electricity",
  priority: "high",
  question_kind: null,
};

beforeEach(() => {
  apiCalls.transcribe.length = 0;
  apiCalls.extract.length = 0;
  apiCalls.submit.length = 0;
  captures.length = 0;
  speechCalls.length = 0;
  customPlay = null;
  scrollCalls = 0;
  window.localStorage.clear();
  apiScript = {
    transcribe: async () => ({ transcript: "The streetlight outside my house has been dark for three days.", language_code: "en-IN" }),
    extract: async () => ({ ...extractionFull }),
    submit: async () => ({ grievanceId: "GRV-TEST-1", message: "Grievance registered", hfEngine: "keyword" }),
  };
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

async function setNativeValue(node, value) {
  await act(async () => {
    const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(node, value);
    node.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
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
  await setNativeValue(container.querySelector("textarea"), text);
  await click("Send");
}

const badgeCount = () => (container.textContent.match(/AI suggestion/g) ?? []).length;
const suggestValue = () => container.querySelector("[data-suggest]")?.getAttribute("data-suggest") ?? null;

test("typed description asks for the missing location, then reviews and submits the captured text", async () => {
  await mount();
  assert.ok(button("Fill the form manually"), "manual mode is the default branch");

  await click("Tell us your problem");
  assert.match(container.textContent, /Describe/);
  assert.equal(captures.length, 0, "switching modes never starts recording on its own");

  const first = "The streetlight outside my house has been dark for three days.";
  await typedAnswer(first);
  assert.equal(apiCalls.extract.length, 1);
  assert.deepEqual(apiCalls.extract[0][0].utterances, [first]);
  assert.deepEqual(apiCalls.extract[0][0].draft, { title: "", description: "" });
  assert.equal(apiCalls.extract[0][0].language, "en-IN");
  assert.match(container.textContent, /Where exactly is the issue located/);

  const second = "Near the park gate on the main road";
  await typedAnswer(second);
  assert.equal(apiCalls.extract.length, 2);
  assert.deepEqual(apiCalls.extract[1][0].utterances, [first, second]);
  assert.deepEqual(apiCalls.extract[1][0].asked_questions, ["location"], "the API receives kinds, not wording");

  assert.match(container.textContent, /Review your complaint/);
  const hidden = [...container.querySelectorAll('input[type="hidden"]')];
  assert.equal(hidden.length, 2, "title and description ride along as hidden form values");
  assert.equal(hidden[0].value, extractionFull.title);
  assert.equal(hidden[1].value, extractionFull.description);
  assert.ok(container.textContent.includes(extractionFull.title), "the review displays the captured title");
  assert.ok(container.textContent.includes(extractionFull.description), "the review displays the captured description");
  assert.equal(container.querySelector("textarea"), null, "the voice review has no editable description");
  assert.equal(container.querySelector('input:not([type="hidden"])'), null, "the voice review has no editable text fields");
  assert.equal(suggestValue(), extractionFull.location_text, "voice location seeds the search box only");
  assert.equal(badgeCount(), 2, "both AI-filled fields are labelled");

  await click("Mock location");
  const submit = container.querySelector('button[type="submit"]');
  await act(async () => submit.click());
  await settle();

  assert.equal(apiCalls.submit.length, 1);
  const payload = apiCalls.submit[0][0];
  assert.equal(payload.title, extractionFull.title);
  assert.equal(payload.description, extractionFull.description, "the conversation text is what gets submitted");
  assert.equal(payload.latitude, 28.7);
  assert.equal(payload.userId, "mock-citizen");
  assert.doesNotMatch(container.textContent, /Review your complaint/, "successful submission resets the conversation");
});

test("voice review text is corrected by switching to the manual form, not by typing in the review", async () => {
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  await typedAnswer("Near the park gate");
  assert.match(container.textContent, /Review your complaint/);

  await click("Switch to manual form");
  assert.equal(container.querySelector('input:not([type="hidden"])').value, extractionFull.title, "the manual form receives the AI draft");
  assert.equal(container.querySelector("textarea").value, extractionFull.description);

  const edited = "The streetlight is still dark and children cannot walk past it safely at night.";
  await setNativeValue(container.querySelector("textarea"), edited);
  assert.equal(container.querySelector("textarea").value, edited, "manual text filling is the way to fix the wording");

  await click("Mock location");
  const submit = container.querySelector('button[type="submit"]');
  await act(async () => submit.click());
  await settle();
  assert.equal(apiCalls.submit.length, 1);
  assert.equal(apiCalls.submit[0][0].description, edited, "the citizen's edit is what gets submitted");
});

test("voice recording uses the spoken language and answers the question by voice", async () => {
  await mount();
  await click("Tell us your problem");
  await chooseLanguage("hi-IN");

  await click("Start speaking");
  assert.equal(captures.length, 1);
  assert.ok(captures[0].started);
  await click("Stop recording");

  assert.equal(apiCalls.transcribe.length, 1);
  assert.equal(apiCalls.transcribe[0][1], "hi-IN");
  assert.equal(apiCalls.extract.length, 1);
  assert.equal(apiCalls.extract[0][0].language, "hi-IN");
  assert.match(container.textContent, /यह समस्या ठीक कहाँ है/, "the question is written in the spoken language");
  assert.ok(
    speechCalls.some((call) => call.type === "play" && call.url === "/voice/questions/location.hi-IN.wav"),
    "the follow-up question is spoken in the selected language",
  );

  await click("Answer by voice");
  assert.equal(captures.length, 2);
  await click("Stop recording");
  assert.equal(apiCalls.transcribe.length, 2);
  assert.deepEqual(apiCalls.extract[1][0].utterances, [
    "The streetlight outside my house has been dark for three days.",
    "The streetlight outside my house has been dark for three days.",
  ]);
  assert.match(container.textContent, /Review your complaint/);
});

test("an optional clarifying question can be skipped", async () => {
  let call = 0;
  apiScript.extract = async () => {
    call += 1;
    return call === 1 ? { ...extractionFull } : { ...extractionFull, question_kind: "clarify" };
  };
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  assert.match(container.textContent, /Where exactly is the issue located/);
  await typedAnswer("Near the park gate");
  assert.match(container.textContent, /Could you clarify a little more\?/);
  assert.ok(
    speechCalls.some((call) => call.type === "play" && call.url === "/voice/questions/clarify.en-IN.wav"),
    "the optional question is spoken in English",
  );

  await click("Skip");
  assert.match(container.textContent, /Review your complaint/);
});

test("changing the language re-speaks and re-renders the open question", async () => {
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  assert.match(container.textContent, /Where exactly is the issue located/);

  await chooseLanguage("mr-IN");
  await settle();
  assert.match(container.textContent, /ही समस्या नेमकी कुठे आहे/, "the card follows the spoken language");
  assert.ok(
    speechCalls.some((call) => call.type === "play" && call.url === "/voice/questions/location.mr-IN.wav"),
    "the open question is re-spoken in Marathi",
  );
});

test("spoken questions can be muted, persist and replay on demand", async () => {
  await mount();
  await click("Tell us your problem");
  await click("Spoken questions on");
  assert.equal(window.localStorage.getItem("grievai-voice-muted"), "true");
  assert.match(container.textContent, /Spoken questions off/);

  await typedAnswer("The streetlight outside my house has been dark for three days.");
  assert.match(container.textContent, /Where exactly is the issue located/);
  assert.equal(speechCalls.filter((call) => call.type === "play").length, 0, "muted questions are not spoken");

  await click("Play again");
  assert.deepEqual(
    speechCalls.filter((call) => call.type === "play").at(-1),
    { type: "play", url: "/voice/questions/location.en-IN.wav" },
    "replay is an explicit gesture and still works while muted",
  );

  await click("Spoken questions off");
  assert.equal(window.localStorage.getItem("grievai-voice-muted"), "false");
});

test("the optional photo step appears before submit and can be skipped", async () => {
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  await typedAnswer("Near the park gate");
  assert.match(container.textContent, /Review your complaint/);
  assert.match(container.textContent, /Add a photo \(optional\)/);
  assert.ok(scrollCalls >= 1, "the photo step is brought into view when the conversation ends");
  assert.ok(button("Skip photo"));

  await click("Skip photo");
  assert.match(container.textContent, /No photo added/);
  assert.ok(button("Add a photo"), "the step can be reopened");

  await click("Mock location");
  const submit = container.querySelector('button[type="submit"]');
  await act(async () => submit.click());
  await settle();
  assert.equal(apiCalls.submit.length, 1);
  assert.equal(apiCalls.submit[0][0].imageUrl, undefined, "skipping sends no image");
});

test("a chosen photo is submitted with the grievance", async () => {
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  await typedAnswer("Near the park gate");
  await click("Mock photo");
  assert.match(container.textContent, /Photo added/);
  await click("Mock location");
  const submit = container.querySelector('button[type="submit"]');
  await act(async () => submit.click());
  await settle();
  assert.equal(apiCalls.submit.length, 1);
  assert.equal(apiCalls.submit[0][0].imageUrl, "https://img.example/photo.jpg");
});

test("extraction failure offers a retry and never blocks manual submission", async () => {
  apiScript.extract = async () => { throw Object.assign(new Error("mock outflow"), { status: 503 }); };
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");

  assert.match(container.textContent, /We couldn't understand the last message/);
  assert.match(container.textContent, /The streetlight outside my house has been dark for three days\./, "typed text is never lost");
  assert.ok(button("Try again"));

  apiScript.extract = async () => ({ ...extractionFull });
  await click("Try again");
  assert.match(container.textContent, /Where exactly is the issue located/, "retry re-runs the extraction");

  await click("Fill the form manually");
  const manualTitle = "Manual title after voice failure";
  await setNativeValue(container.querySelector("input"), manualTitle);
  await setNativeValue(container.querySelector("textarea"), "A manual description typed after the voice failure, long enough to submit.");
  await click("Mock location");
  const submit = container.querySelector('button[type="submit"]');
  await act(async () => submit.click());
  await settle();
  assert.equal(apiCalls.submit.length, 1);
  assert.equal(apiCalls.submit[0][0].title, manualTitle);
});

test("mode switching preserves the draft and the conversation", async () => {
  await mount();
  await setNativeValue(container.querySelector("input"), "Citizen's manual title");
  await setNativeValue(container.querySelector("textarea"), "A manual description the citizen typed before switching, long enough.");

  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  assert.match(container.textContent, /Where exactly is the issue located/);

  await click("Fill the form manually");
  assert.equal(container.querySelector("input").value, "Citizen's manual title", "AI never overwrites citizen text");
  assert.match(container.querySelector("textarea").value, /manual description the citizen typed/);

  await click("Tell us your problem");
  assert.match(container.textContent, /The streetlight outside my house has been dark for three days\./, "conversation survives mode switching");
  assert.match(container.textContent, /Where exactly is the issue located/);
});

test("repeated submit clicks post exactly one grievance", async () => {
  await mount();
  await click("Tell us your problem");
  await typedAnswer("The streetlight outside my house has been dark for three days.");
  await typedAnswer("Near the park gate");
  await click("Mock location");

  let resolveSubmit;
  apiScript.submit = () => new Promise((resolve) => { resolveSubmit = resolve; });
  const submit = container.querySelector('button[type="submit"]');
  await act(async () => { submit.click(); });
  await act(async () => { submit.click(); });
  assert.equal(apiCalls.submit.length, 1, "the submit lock rejects the second attempt");
  await act(async () => { resolveSubmit({ grievanceId: "GRV-X", message: "registered", hfEngine: "keyword" }); });
  await settle();
  assert.match(container.textContent, /GRV-X/);
});

test("opening prompt plays on first Start speaking, appears in conversation log, and then capture starts", async () => {
  let playResolve;
  customPlay = () => new Promise((resolve) => { playResolve = resolve; });

  await mount();
  await click("Tell us your problem");

  // Click Start speaking - this initiates the opening prompt
  const startBtn = button("Start speaking");
  await act(async () => startBtn.click());
  await settle();

  // Opener has started playing, but recording has NOT started yet
  assert.equal(speechCalls.filter((c) => c.type === "play" && c.url === "/voice/questions/intro.en-IN.wav").length, 1);
  assert.equal(captures.length, 0, "recording must not start before the opening prompt finishes playing");
  assert.match(container.textContent, /Namaste\. Please tell me what the problem is/, "opener appears in the conversation log");

  // Playback finishes
  await act(async () => playResolve("played"));
  await settle();

  // Now capture has started
  assert.equal(captures.length, 1);
  assert.ok(captures[0].started);
});

test("muted mode skips opening prompt audio but still adds opener to conversation log and starts capture immediately", async () => {
  await mount();
  await click("Tell us your problem");
  await click("Spoken questions on"); // toggles to muted
  assert.equal(window.localStorage.getItem("grievai-voice-muted"), "true");

  await click("Start speaking");
  assert.equal(speechCalls.filter((c) => c.type === "play").length, 0, "no audio should play when muted");
  assert.match(container.textContent, /Namaste\. Please tell me what the problem is/, "opener is still added as transcript message");
  assert.equal(captures.length, 1, "capture starts immediately when muted");
  assert.ok(captures[0].started);
});

test("opener playback failure still proceeds to start capture", async () => {
  customPlay = async () => "failed";

  await mount();
  await click("Tell us your problem");
  await click("Start speaking");

  assert.equal(speechCalls.filter((c) => c.type === "play" && c.url === "/voice/questions/intro.en-IN.wav").length, 1);
  assert.equal(captures.length, 1, "capture starts even if audio playback fails");
  assert.ok(captures[0].started);
});

test("follow-up Answer by voice does not replay the opener", async () => {
  await mount();
  await click("Tell us your problem");
  await click("Start speaking");

  // First start played the intro
  assert.equal(speechCalls.filter((c) => c.type === "play" && c.url === "/voice/questions/intro.en-IN.wav").length, 1);

  await click("Stop recording");
  assert.match(container.textContent, /Where exactly is the issue located/);

  // Follow-up answer
  await click("Answer by voice");
  assert.equal(speechCalls.filter((c) => c.type === "play" && c.url === "/voice/questions/intro.en-IN.wav").length, 1, "intro was not replayed");
  assert.equal(captures.length, 2);
});

