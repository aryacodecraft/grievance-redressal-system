import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { sourceLoader, frontendRoot } from "./voice-test-loader.mjs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.localStorage = dom.window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.HTMLElement = dom.window.HTMLElement;
dom.window.HTMLMediaElement.prototype.pause = () => {};
dom.window.HTMLMediaElement.prototype.load = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import("react-dom/client");

let root, container, calls, handler, contexts, worklets, tracks, revoked, created;
let fullIntegrationCapture = false;
let automaticChoice = true;
const mockApi = {
  transcribeAudio: (...args) => { calls.push(args); return handler(...args); },
  submitGrievance: async () => { throw new Error("Voice actions must not submit a grievance"); },
};
const load = sourceLoader({
  "@/lib/api": mockApi,
  "@/lib/session": { useDemoUser: () => ({ user: { id: "mock-citizen" } }) },
  "@/components/ui/ToastProvider": { useToast: () => ({ notify: () => {} }) },
  "./GrievanceCard": { AnalysisPanel: () => null },
  "./ImageUpload": { ImageUpload: () => null },
  "./LocationCapture": { LocationCapture: ({ onChange }) => React.createElement("button", { type: "button", onClick: () => onChange({ latitude: 1, longitude: 2 }) }, "Mock location") },
});
const { I18nProvider } = load("lib/i18n/index.tsx");
const { SubmitForm } = load("components/grievance/SubmitForm.tsx");
const { VoiceRecorder } = load("components/grievance/VoiceRecorder.tsx");
const { VoiceCapture } = load("lib/voice/capture.ts");

class NodeMock {
  connect(next) { return next; }
  disconnect() { this.disconnected = true; }
}
class ContextMock {
  constructor() {
    this.sampleRate = 48000; this.state = "running";
    this.audioWorklet = { addModule: async (url) => assert.equal(url, "/voice-processor.js") };
    this.destination = new NodeMock(); contexts.push(this);
  }
  resume() { return Promise.resolve(); }
  createMediaStreamSource() { return new NodeMock(); }
  createGain() { const node = new NodeMock(); node.gain = { value: 1 }; return node; }
  close() { this.state = "closed"; return Promise.resolve(); }
}
class WorkletMock extends NodeMock {
  constructor() {
    super(); worklets.push(this);
    let processor;
    this.port = {
      onmessage: null,
      close: () => { this.closed = true; },
      postMessage: (message) => {
        if (fullIntegrationCapture) {
          processor.port.onmessage({ data: message });
          if (message === "start") {
            for (let offset = 0; offset < 4800; offset += 128) {
              const channel = Float32Array.from({ length: Math.min(128, 4800 - offset) }, (_, i) => 0.25 * Math.sin(2 * Math.PI * 1000 * (offset + i) / 48000));
              processor.process([[channel, channel]]);
            }
          }
          return;
        }
        if (message === "stop") queueMicrotask(() => {
          this.port.onmessage?.({ data: { type: "samples", samples: new Float32Array(4800).fill(0.2) } });
          this.port.onmessage?.({ data: { type: "complete" } });
        });
      },
    };
    if (fullIntegrationCapture) {
      let Processor;
      const deliver = (data) => queueMicrotask(() => this.port.onmessage?.({ data }));
      const context = vm.createContext({
        sampleRate: 48000, Float32Array,
        AudioWorkletProcessor: class { constructor() { this.port = { postMessage: deliver }; } },
        registerProcessor: (_, value) => { Processor = value; },
      });
      vm.runInContext(fs.readFileSync(path.join(frontendRoot, "public/voice-processor.js"), "utf8"), context);
      processor = new Processor();
    }
  }
}
function microphone() {
  const track = { stopped: false, onended: null, stop() { this.stopped = true; } };
  tracks.push(track);
  return { getTracks: () => [track], getAudioTracks: () => [track] };
}

beforeEach(() => {
  automaticChoice = true;
  fullIntegrationCapture = false;
  calls = []; contexts = []; worklets = []; tracks = []; revoked = []; created = [];
  localStorage.clear();
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  window.AudioContext = ContextMock; window.AudioWorkletNode = WorkletMock;
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => microphone() }, configurable: true });
  URL.createObjectURL = (blob) => { created.push(blob); return `blob:mock-${created.length}`; };
  URL.revokeObjectURL = (url) => revoked.push(url);
  window.confirm = () => true;
  handler = async () => ({ transcript: "A sufficiently detailed spoken complaint.", language_code: "en-IN" });
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function mount(component = React.createElement(SubmitForm)) {
  await act(async () => root.render(React.createElement(I18nProvider, null, component)));
}
function button(label) {
  const result = [...container.querySelectorAll("button")].find((node) => node.textContent === label);
  assert.ok(result, `Missing button: ${label}`); return result;
}
async function flushChoices() {
  while (automaticChoice && container.querySelector("dialog[open]")) {
    const dialog = container.querySelector("dialog[open]");
    const replace = window.confirm(dialog.textContent);
    const target = [...dialog.querySelectorAll("button")].find((node) => node.textContent === (replace ? "Replace" : "Cancel"));
    await act(async () => target.click());
  }
}
async function click(label) { await act(async () => button(label).click()); await flushChoices(); }
async function record() { await click("Start recording"); await click("Stop recording"); }
async function description(text) {
  const textarea = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(textarea, text);
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

async function titleValue(text) {
  await act(async () => {
    const input = container.querySelector('input:not([type="file"])');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
const currentTitle = () => container.querySelector('input:not([type="file"])').value;
for (const existing of ["", "Citizen's manual title"]) {
  test(`concise street-light suggestion preserves full transcript and existing title ${JSON.stringify(existing)}`, async () => {
    await mount(); await titleValue(existing); await record();
    const text = "There is a broken street light near my house. Please repair it.";
    handler = async () => ({ transcript: text, language_code: "en-IN" }); await click("Transcribe");
    assert.equal(container.querySelector("textarea").value, text);
    assert.equal(currentTitle(), existing || "broken street light near my house");
    if (existing) {
      window.confirm = () => false; await click("Use suggested title"); assert.equal(currentTitle(), existing);
      window.confirm = () => true; await click("Use suggested title"); assert.equal(currentTitle(), "broken street light near my house");
    }
    assert.equal(container.querySelector("textarea").value, text); assert.equal(calls.length, 1);
  });
}

for (const text of ["Water supply is not working in our neighbourhood.", "पानी की आपूर्ति नहीं हो रही है।", "रस्त्यावरील दिवे चालू नाहीत।"]) {
  test(`Append preserves existing description/title and Unicode: ${text}`, async () => {
    automaticChoice = false; await mount(); await titleValue("My manual title");
    await description("Existing complaint text"); await record();
    handler = async () => ({ transcript: text, language_code: "en-IN" });
    await click("Transcribe"); assert.equal(calls.length, 0);
    assert.ok(button("Append")); assert.ok(button("Replace")); assert.ok(button("Cancel"));
    assert.ok(document.activeElement.textContent === "Cancel");
    await click("Append");
    assert.equal(container.querySelector("textarea").value, "Existing complaint text\n\n" + text);
    assert.equal(currentTitle(), "My manual title"); assert.equal(calls.length, 1);
    await click("Use suggested title");
    assert.equal(container.querySelector("textarea").value, "Existing complaint text\n\n" + text);
    assert.notEqual(currentTitle(), "My manual title");
  });
}
for (const ending of [" ", "\n", "\n\n"]) {
  test(`Append retains existing trailing whitespace ${JSON.stringify(ending)}`, async () => {
    automaticChoice = false; await mount(); await description("Existing text" + ending); await record();
    await click("Transcribe"); await click("Append");
    assert.equal(container.querySelector("textarea").value, "Existing text" + ending + "A sufficiently detailed spoken complaint.");
  });
}
for (const action of ["Append", "Replace", "Cancel"]) {
  test(`in-flight choice ${action} operates on latest description without another upload`, async () => {
    automaticChoice = false; await mount(); await titleValue("Keep current title"); await description("Original description"); await record();
    let resolve; handler = () => new Promise((done) => { resolve = done; });
    await click("Transcribe"); await click("Append"); await description("Latest citizen edits");
    const text = "Water supply is not working in our neighbourhood.";
    await act(async () => resolve({ transcript: text, language_code: "en-IN" }));
    assert.ok(container.querySelector("dialog[open]"));
    assert.equal(container.querySelector("textarea").value, "Latest citizen edits"); await click(action);
    const expected = action === "Append" ? "Latest citizen edits\n\n" + text : action === "Replace" ? text : "Latest citizen edits";
    assert.equal(container.querySelector("textarea").value, expected); assert.equal(currentTitle(), "Keep current title");
    assert.equal(calls.length, 1);
  });
}
test("edits while a post-response chooser is open require another explicit choice", async () => {
  automaticChoice = false; await mount(); await record(); let resolve;
  handler = () => new Promise((done) => { resolve = done; }); await click("Transcribe"); await description("First edits");
  await act(async () => resolve({ transcript: "Water supply is not working.", language_code: "en-IN" }));
  await description("Second edits"); await click("Replace");
  assert.equal(container.querySelector("textarea").value, "Second edits");
  assert.ok(container.querySelector("dialog[open]")); await click("Append");
  assert.equal(container.querySelector("textarea").value, "Second edits\n\nWater supply is not working.");
});
test("Escape cancels before upload, preserving both fields", async () => {
  automaticChoice = false; await mount(); await titleValue("Manual title"); await description("Manual description"); await record();
  await click("Transcribe"); await act(async () => container.querySelector("dialog").dispatchEvent(new window.Event("cancel", { cancelable: true })));
  assert.equal(calls.length, 0); assert.equal(currentTitle(), "Manual title");
  assert.equal(container.querySelector("textarea").value, "Manual description");
});
test("StrictMode effect replay must not cancel an explicit description choice", async () => {
  automaticChoice = false;
  await mount(React.createElement(React.StrictMode, null, React.createElement(SubmitForm)));
  await description("Existing citizen description"); await record(); await click("Transcribe");
  assert.equal(calls.length, 0); await click("Append");
  assert.equal(calls.length, 1);
  assert.equal(container.querySelector("textarea").value, "Existing citizen description\n\nA sufficiently detailed spoken complaint.");
});
test("description dialog wraps Tab/Shift+Tab and returns focus after cancellation", async () => {
  automaticChoice = false; await mount(); await description("Existing citizen text"); await record();
  const trigger = button("Transcribe"); trigger.focus(); await click("Transcribe");
  const dialog = container.querySelector("dialog");
  assert.equal(document.activeElement.textContent, "Cancel");
  await act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
  assert.equal(document.activeElement.textContent, "Append");
  await act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
  assert.equal(document.activeElement.textContent, "Cancel");
  await act(async () => dialog.dispatchEvent(new window.Event("cancel", { cancelable: true })));
  await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
  assert.equal(document.activeElement, trigger); assert.equal(calls.length, 0);
});
test("accepted pre-upload choice returns focus to description while Transcribe is disabled", async () => {
  automaticChoice = false; await mount(); await description("Existing citizen text"); await record();
  handler = () => new Promise(() => {});
  button("Transcribe").focus(); await click("Transcribe"); await click("Append");
  await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
  assert.equal(button("Transcribe").disabled, true);
  assert.equal(document.activeElement, container.querySelector("textarea"));
});
test("discard while awaiting post-response choice aborts insertion and title generation", async () => {
  automaticChoice = false; await mount(); await record(); let resolve;
  handler = () => new Promise((done) => { resolve = done; }); await click("Transcribe"); await description("Latest edits");
  await act(async () => resolve({ transcript: "Water supply is not working.", language_code: "en-IN" }));
  await click("Discard recording"); assert.equal(container.querySelector("dialog"), null);
  assert.equal(container.querySelector("textarea").value, "Latest edits"); assert.equal(currentTitle(), "");
});

for (const [text, expected] of [
  ["Hello! Water supply is not working. Please help us.", "Water supply is not working"],
  ["नमस्ते। पानी की आपूर्ति नहीं हो रही है। कृपया सहायता करें।", "पानी की आपूर्ति नहीं हो रही है"],
  ["नमस्कार। रस्त्यावरील दिवे चालू नाहीत। कृपया मदत करा.", "रस्त्यावरील दिवे चालू नाहीत"],
]) {
  test(`accepted transcript fills empty title and preserves full description: ${expected}`, async () => {
    await mount(); await record(); handler = async () => ({ transcript: text, language_code: "en-IN" });
    await click("Transcribe"); assert.equal(currentTitle(), expected);
    assert.equal(container.querySelector("textarea").value, text);
    await titleValue("Citizen edited title"); await description("Citizen edited description");
    assert.equal(currentTitle(), "Citizen edited title");
    assert.equal(container.querySelector("textarea").value, "Citizen edited description");
    assert.equal(calls.length, 1);
  });
}
test("title typed while pending is preserved; explicit replacement can cancel or accept", async () => {
  await mount(); await record(); let resolve;
  handler = () => new Promise((done) => { resolve = done; }); await click("Transcribe");
  await titleValue("Keep my new title");
  await act(async () => resolve({ transcript: "Water supply is not working. Please repair it.", language_code: "en-IN" }));
  assert.equal(currentTitle(), "Keep my new title"); window.confirm = () => false;
  await click("Use suggested title"); assert.equal(currentTitle(), "Keep my new title");
  window.confirm = () => true; await click("Use suggested title");
  assert.equal(currentTitle(), "Water supply is not working"); assert.equal(calls.length, 1);
});
test("re-transcription preserves earlier generated title and hides suggestions after description edits", async () => {
  await mount(); await record(); await click("Transcribe"); const earlier = currentTitle();
  handler = async () => ({ transcript: "Garbage collection has stopped in our neighbourhood.", language_code: "en-IN" });
  await click("Transcribe"); assert.equal(currentTitle(), earlier);
  assert.ok(button("Use suggested title")); await description("New citizen text after transcription");
  assert.ok(![...container.querySelectorAll("button")].some((node) => node.textContent === "Use suggested title"));
});
test("no useful suggestion leaves title empty while preserving accepted text", async () => {
  await mount(); await record(); handler = async () => ({ transcript: "Hello! Thank you. Please help.", language_code: "en-IN" });
  await click("Transcribe"); assert.equal(currentTitle(), "");
  assert.equal(container.querySelector("textarea").value, "Hello! Thank you. Please help.");
});
test("generated title validates, submits the full transcript and resets without extra requests", async () => {
  await mount();
  await act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  const titleError = load("lib/i18n/en.ts").default.errTitleShort;
  assert.ok(container.textContent.includes(titleError));
  await record();
  const transcript = "Hello! Water supply is not working. Please repair it in our neighbourhood.";
  handler = async () => ({ transcript, language_code: "en-IN" }); await click("Transcribe");
  assert.equal(currentTitle(), "Water supply is not working");
  assert.ok(!container.textContent.includes(titleError));
  await click("Mock location");
  const previous = mockApi.submitGrievance; let payload;
  mockApi.submitGrievance = async (value) => { payload = value; return { grievanceId: "mock-title-id", message: "registered", hfEngine: {} }; };
  try {
    await act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(payload.title, "Water supply is not working"); assert.equal(payload.description, transcript);
    assert.deepEqual(Object.keys(payload).sort(), ["description", "latitude", "longitude", "title", "userId"]);
    assert.equal(currentTitle(), ""); assert.equal(container.querySelector("textarea").value, "");
    assert.equal(container.querySelector("audio"), null); assert.equal(calls.length, 1);
    assert.ok(![...container.querySelectorAll("button")].some((node) => node.textContent === "Use suggested title"));
  } finally { mockApi.submitGrievance = previous; }
});
for (const outcome of ["error", "cancel", "discard", "changed-cancel"]) {
  test(`title is unchanged on ${outcome}`, async () => {
    await mount(); await titleValue("Original citizen title"); await record();
    if (outcome === "cancel") {
      await description("Original citizen description"); window.confirm = () => false; await click("Transcribe");
      assert.equal(calls.length, 0);
    } else if (outcome === "error") {
      handler = async () => { throw new Error("mock failure"); }; await click("Transcribe");
    } else {
      let resolve; handler = () => new Promise((done) => { resolve = done; }); await click("Transcribe");
      if (outcome === "discard") await click("Discard recording");
      else { await description("Changed while pending"); window.confirm = () => false; }
      await act(async () => resolve({ transcript: "Water supply is not working in our neighbourhood.", language_code: "en-IN" }));
      await flushChoices();
    }
    assert.equal(currentTitle(), "Original citizen title");
    assert.ok(![...container.querySelectorAll("button")].some((node) => node.textContent === "Use suggested title"));
  });
}

test("explicit recording, playback, language choice, transcription and cleanup", async () => {
  await mount(); assert.equal(contexts.length, 0); assert.equal(calls.length, 0);
  window.confirm = () => assert.fail("Empty description must insert without confirmation");
  assert.ok(container.querySelector("textarea").compareDocumentPosition(container.querySelector("section")) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  const select = container.querySelector("section select");
  await act(async () => { select.value = "mr-IN"; select.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await record();
  assert.ok(container.querySelector("audio[controls]"));
  assert.ok(tracks.every((track) => track.stopped));
  assert.ok(contexts.every((context) => context.state === "closed"));
  assert.ok(worklets.every((node) => node.closed && node.disconnected));
  assert.equal(calls.length, 0);
  await click("Transcribe");
  assert.equal(calls.length, 1); assert.equal(calls[0][1], "mr-IN");
  assert.match(calls[0][2], /^[a-z0-9-]+$/i);
  assert.equal(calls[0][0].type, "audio/wav");
  assert.equal(container.querySelector("textarea").value, "A sufficiently detailed spoken complaint.");
  assert.match(container.textContent, /Review and edit/);
  await click("Discard recording"); assert.equal(revoked.length, 1);
});

for (const [language, text] of [["hi-IN", "पानी की आपूर्ति बंद है। कृपया सहायता करें।"], ["mr-IN", "पाणीपुरवठा बंद आहे. कृपया मदत करा."]]) {
  test(`empty description receives ${language} Unicode without confirmation`, async () => {
    await mount(); await record();
    const select = container.querySelector("section select");
    await act(async () => { select.value = language; select.dispatchEvent(new window.Event("change", { bubbles: true })); });
    window.confirm = () => assert.fail("No replacement confirmation for empty text");
    handler = async () => ({ transcript: text, language_code: language });
    await click("Transcribe");
    assert.equal(calls.length, 1); assert.equal(calls[0][1], language);
    assert.equal(container.querySelector("textarea").value, text);
  });
}

test("StrictMode ref replay preserves a nonempty WAV and playback source", async () => {
  await mount(React.createElement(React.StrictMode, null, React.createElement(SubmitForm)));
  await record();
  const player = container.querySelector("audio");
  assert.ok(player);
  const wav = await created[0].arrayBuffer();
  const view = new DataView(wav);
  assert.equal(view.getUint32(40, true), 3200); // 4800 source frames -> 1600 PCM frames
  assert.ok(view.getInt16(44, true) > 0);
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(calls.length, 0);
  assert.equal(player.getAttribute("src"), "blob:mock-1");
  assert.deepEqual(revoked, []);
  // Unrelated renders must preserve React's existing src prop too.
  const language = container.querySelector("section select");
  await act(async () => { language.value = "hi-IN"; language.dispatchEvent(new window.Event("change", { bubbles: true })); });
  assert.equal(player.getAttribute("src"), "blob:mock-1");
  await click("Discard recording");
  assert.equal(container.querySelector("audio"), null);
  assert.deepEqual(revoked, ["blob:mock-1"]);
});

test("30-second timer stops capture automatically", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  await mount(); await click("Start recording");
  await act(async () => context.mock.timers.tick(30000));
  assert.ok(container.querySelector("audio"));
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(calls.length, 0);
  context.mock.timers.reset();
});

test("permission denied closes context and preserves typed description", async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); };
  await mount(); await description("My typed complaint"); await click("Start recording");
  assert.match(container.querySelector('[role="alert"]').textContent, /permission was denied/);
  assert.equal(container.querySelector("textarea").value, "My typed complaint");
  assert.equal(contexts[0].state, "closed"); assert.equal(calls.length, 0);
});

test("missing microphone and unsupported APIs have accessible feedback", async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("missing", "NotFoundError"); };
  await mount(); await click("Start recording");
  assert.match(container.querySelector('[role="alert"]').textContent, /No microphone/);
  window.AudioWorkletNode = undefined;
  await click("Start recording");
  assert.match(container.querySelector('[role="alert"]').textContent, /AudioWorklet support/);
});

test("cancel confirmation happens before upload and preserves typed text", async () => {
  await mount(); await description("Keep this typed description"); await record();
  let confirmed = 0;
  window.confirm = () => { confirmed++; assert.equal(calls.length, 0); return false; };
  await click("Transcribe");
  assert.equal(confirmed, 1); assert.equal(calls.length, 0);
  assert.equal(container.querySelector("textarea").value, "Keep this typed description");
});

test("insecure contexts reject recording before permission or hardware access", async () => {
  Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
  navigator.mediaDevices.getUserMedia = () => assert.fail("Insecure context must not request permission");
  await mount(); await description("Keep my typed complaint"); await click("Start recording");
  assert.match(container.querySelector('[role="alert"]').textContent, /AudioWorklet.*HTTPS/);
  assert.equal(container.querySelector("textarea").value, "Keep my typed complaint");
  assert.equal(contexts.length, 0); assert.equal(calls.length, 0);
});

test("recorder exposes labelled native controls, live status and playback name", async () => {
  await mount();
  const section = container.querySelector("section");
  assert.ok(document.getElementById(section.getAttribute("aria-labelledby"))?.textContent);
  const select = section.querySelector("select");
  assert.ok(section.querySelector(`label[for='${select.id}']`)?.textContent);
  assert.deepEqual([...select.options].map((option) => option.value), ["en-IN", "hi-IN", "mr-IN"]);
  const status = section.querySelector('[role="status"]');
  assert.equal(status.getAttribute("aria-live"), "polite");
  const idle = status.textContent;
  await click("Start recording"); assert.notEqual(status.textContent, idle);
  assert.ok(select.disabled); assert.equal(button("Stop recording").disabled, false);
  await click("Stop recording");
  const player = section.querySelector("audio");
  assert.ok(player.controls); assert.ok(player.getAttribute("aria-label"));
  for (const control of section.querySelectorAll("button")) {
    assert.ok(control.textContent.trim()); assert.equal(control.type, "button");
    assert.equal(control.getAttribute("tabindex"), null);
    assert.ok(control.className.includes("focus-visible:ring-2"));
    assert.ok([...control.querySelectorAll("svg")].every((icon) => icon.getAttribute("aria-hidden") === "true"));
  }
});

test("navigation unmount pauses playback and revokes its URL", async () => {
  await mount(); await record();
  const player = container.querySelector("audio"); let paused = 0;
  player.pause = () => { paused++; };
  await act(async () => root.render(null));
  assert.ok(paused > 0); assert.deepEqual(revoked, ["blob:mock-1"]);
  assert.ok(tracks.every((track) => track.stopped)); assert.equal(calls.length, 0);
});

test("successful replacement is confirmed before upload and is editable", async () => {
  await mount(); await description("Replace this description"); await record();
  let confirmed = false;
  window.confirm = () => { confirmed = true; assert.equal(calls.length, 0); return true; };
  handler = async () => { assert.ok(confirmed); return { transcript: "पाणीपुरवठा बंद आहे. कृपया मदत करा.", language_code: "mr-IN" }; };
  await click("Transcribe");
  assert.equal(container.querySelector("textarea").value, "पाणीपुरवठा बंद आहे. कृपया मदत करा.");
  await description("Edited by citizen");
  assert.equal(container.querySelector("textarea").value, "Edited by citizen");
});

for (const accept of [true, false]) {
  test(`in-flight editing asks again; newer text ${accept ? "replaced with consent" : "preserved"}`, async () => {
    await mount(); await description("Initial complaint"); await record();
    let resolve; let confirmations = 0;
    window.confirm = () => ++confirmations === 1 || accept;
    handler = () => new Promise((done) => { resolve = done; });
    await click("Transcribe"); await description("Newer citizen description");
    await act(async () => resolve({ transcript: "पानी की आपूर्ति बंद है। कृपया सहायता करें।", language_code: "hi-IN" }));
    await flushChoices();
    assert.equal(confirmations, 2);
    assert.equal(container.querySelector("textarea").value, accept ? "पानी की आपूर्ति बंद है। कृपया सहायता करें।" : "Newer citizen description");
  });
}

for (const status of [401, 429, 502, 503, 504]) {
  test(`transcription ${status} keeps typed text and does not retry`, async () => {
    await mount(); await description("Keep my complaint"); await record();
    let confirmed = 0;
    window.confirm = () => { confirmed++; assert.equal(calls.length, 0); return true; };
    handler = async () => { throw Object.assign(new Error("mock failure"), { status }); };
    await click("Transcribe");
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(container.querySelector("textarea").value, "Keep my complaint");
    assert.equal(calls.length, 1);
    assert.equal(confirmed, 1);
    if (status === 503) assert.match(container.querySelector('[role="alert"]').textContent, /unavailable or disabled/);
  });
}

test("network failure after confirmation preserves the existing description", async () => {
  await mount(); await description("Keep this complaint when offline"); await record();
  let confirmed = false;
  window.confirm = () => { assert.equal(calls.length, 0); confirmed = true; return true; };
  handler = async () => { assert.ok(confirmed); throw new TypeError("Mock network failure"); };
  await click("Transcribe");
  assert.equal(calls.length, 1);
  assert.equal(container.querySelector("textarea").value, "Keep this complaint when offline");
  assert.ok(container.querySelector('[role="alert"]'));
});

for (const accept of [true, false]) {
  test(`typing into initially empty description during transcription ${accept ? "requires consent to replace" : "preserves new text on cancellation"}`, async () => {
    await mount(); await record(); let resolve; let confirmations = 0;
    window.confirm = () => { confirmations++; return accept; };
    handler = () => new Promise((done) => { resolve = done; });
    await click("Transcribe");
    assert.equal(confirmations, 0); assert.equal(calls.length, 1);
    await description("A newer description entered while waiting");
    await act(async () => resolve({ transcript: "The water supply has been interrupted since yesterday.", language_code: "en-IN" }));
    await flushChoices();
    assert.equal(confirmations, 1);
    assert.equal(container.querySelector("textarea").value, accept ? "The water supply has been interrupted since yesterday." : "A newer description entered while waiting");
    assert.equal(calls.length, 1); // the second confirmation never uploads again
  });
}

test("unmount while recording stops tracks, context, port and timers", async () => {
  await mount(); await click("Start recording");
  await act(async () => root.render(null));
  assert.ok(tracks.every((track) => track.stopped));
  assert.ok(contexts.every((context) => context.state === "closed"));
  assert.ok(worklets.every((node) => node.closed));
});

test("late microphone permission after disposal is immediately stopped", async () => {
  let allow;
  navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => { allow = resolve; });
  const capture = new VoiceCapture(() => assert.fail("Disposed capture completed"), () => {});
  const pending = capture.start(); capture.dispose(); allow(microphone()); await pending;
  assert.ok(tracks.every((track) => track.stopped)); assert.equal(contexts[0].state, "closed");
});

test("discard aborts pending transcription and ignores its late result", async () => {
  await mount(); await record(); let resolve;
  handler = () => new Promise((done) => { resolve = done; });
  await click("Transcribe"); const signal = calls[0][3];
  await click("Discard recording"); assert.ok(signal.aborted);
  await act(async () => resolve({ transcript: "Never insert this late text", language_code: "en-IN" }));
  assert.equal(container.querySelector("textarea").value, "");
  assert.equal(container.querySelector("audio"), null); assert.equal(revoked.length, 1);
});

test("re-record revokes the previous playback URL; all actions are non-submit buttons", async () => {
  await mount(); await record(); await click("Re-record");
  assert.equal(revoked.length, 1); assert.equal(container.querySelector("audio"), null);
  assert.ok([...container.querySelectorAll("section button")].every((node) => node.type === "button"));
});

for (const [language, label, code] of [["hi", "रिकॉर्डिंग शुरू करें", "hi-IN"], ["mr", "रेकॉर्डिंग सुरू करा", "mr-IN"]]) {
  test(`${language} interface copy and spoken-language default`, async () => {
    localStorage.setItem("grievai-language", language);
    await mount(React.createElement(VoiceRecorder, { prepareTranscription: () => "", onTranscript: () => true }));
    assert.ok(button(label)); assert.equal(container.querySelector("select").value, code);
  });
}

test("device failure releases recording resources and does not upload", async () => {
  await mount(); await click("Start recording");
  await act(async () => worklets[0].onprocessorerror());
  assert.match(container.querySelector('[role="alert"]').textContent, /stopped working/);
  assert.ok(tracks.every((track) => track.stopped));
  assert.ok(contexts.every((context) => context.state === "closed"));
  assert.equal(calls.length, 0);
});

test("each deliberate transcription attempt uses a new key", async () => {
  await mount(); await record(); await click("Transcribe"); await click("Transcribe");
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0][2], calls[1][2]);
});

test("normal form submission cancels pending voice and preserves payload/reset behavior", async () => {
  await mount(); await description("An existing complaint with enough detail for validation.");
  const title = container.querySelector('input:not([type="file"])');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(title, "Water supply complaint");
    title.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("Mock location"); await record(); let resolve;
  handler = () => new Promise((done) => { resolve = done; });
  await click("Transcribe"); const signal = calls[0][3];
  let payload;
  const previous = mockApi.submitGrievance;
  mockApi.submitGrievance = async (value) => {
    payload = value;
    return { grievanceId: "mock-id", message: "registered", hfEngine: {} };
  };
  try {
    await act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(payload.description, "An existing complaint with enough detail for validation.");
    assert.equal(payload.title, "Water supply complaint");
    assert.equal(payload.userId, "mock-citizen");
    assert.equal(payload.latitude, 1); assert.equal(payload.longitude, 2);
    assert.ok(signal.aborted);
    await act(async () => resolve({ transcript: "Late response must not replace the reset form", language_code: "en-IN" }));
    assert.equal(container.querySelector("textarea").value, "");
    assert.equal(container.querySelector("audio"), null);
  } finally { mockApi.submitGrievance = previous; }
});

// Opt-in cross-stack cases: pytest supplies an isolated, mock-only loopback server.
// Ordinary npm test:voice never starts a backend or makes network requests.
if (process.env.VOICE_E2E_URL) {
  const base = process.env.VOICE_E2E_URL;
  assert.equal(new URL(base).hostname, "127.0.0.1");
  const nativeFetch = global.fetch;
  global.fetch = (url, init) => {
    assert.equal(new URL(url).origin, base, "External HTTP is forbidden in Stage6");
    return nativeFetch(url, init);
  };
  const actualApi = sourceLoader()("lib/api.ts");
  const texts = {
    "en-IN": "The water supply has been interrupted since yesterday.",
    "hi-IN": "पानी की आपूर्ति कल से बंद है। कृपया सहायता करें।",
    "mr-IN": "कालपासून पाणीपुरवठा बंद आहे. कृपया मदत करा.",
  };
  let integrationRequest;
  async function setupIntegration(mode = "success") {
    assert.ok((await fetch(`${base}/__voice_test/scenario?mode=${mode}`)).ok);
    actualApi.setStoredTokens(process.env.VOICE_E2E_TOKEN);
    fullIntegrationCapture = true;
    integrationRequest = null;
    handler = (...args) => {
      const pending = actualApi.transcribeAudio(...args);
      integrationRequest = pending.catch(() => undefined);
      return pending;
    };
    await mount(); await record();
  }
  async function finishTranscription() {
    await click("Transcribe");
    // Unlike immediate mocks, real loopback HTTP finishes after the click's act.
    if (integrationRequest) await act(async () => { await integrationRequest; });
  }
  const stats = async () => (await fetch(`${base}/__voice_test/stats`)).json();

  for (const language of ["en-IN", "hi-IN", "mr-IN"]) {
    test(`Stage6 recorded ${language} WAV traverses authenticated backend/provider into form`, async () => {
      await setupIntegration();
      const select = container.querySelector("section select");
      await act(async () => { select.value = language; select.dispatchEvent(new window.Event("change", { bubbles: true })); });
      window.confirm = () => assert.fail("Empty description must not ask for replacement");
      await finishTranscription();
      assert.equal(calls.length, 1);
      assert.equal(container.querySelector("textarea").value, texts[language]);
      assert.equal(container.querySelector('[role="alert"]'), null);
    });
  }
  test("Stage6 cancelled replacement makes zero HTTP/provider calls", async () => {
    await setupIntegration(); await description("Keep the existing complaint");
    const before = await stats(); window.confirm = () => false;
    await finishTranscription();
    assert.deepEqual(await stats(), before);
    assert.equal(container.querySelector("textarea").value, "Keep the existing complaint");
  });
  test("Stage6 confirmed replacement inserts the real backend mock response", async () => {
    await setupIntegration(); await description("Replace with consent");
    window.confirm = () => { assert.equal(calls.length, 0); return true; };
    await finishTranscription();
    assert.equal(container.querySelector("textarea").value, texts["en-IN"]);
  });
  for (const mode of ["disabled", "failure", "timeout", "invalid_response"]) {
    test(`Stage6 backend ${mode} preserves typed description`, async () => {
      await setupIntegration(mode); await description("Keep typed text on any backend error");
      const before = await stats(); await finishTranscription();
      assert.equal(container.querySelector("textarea").value, "Keep typed text on any backend error");
      assert.ok(container.querySelector('[role="alert"]'));
      const after = await stats(); assert.equal(after.posts, before.posts + 1);
      assert.equal(after.provider, before.provider + (mode === "disabled" ? 0 : 1));
    });
  }
  test("Stage6 actual HTTP rejects bad JWT, audio and multipart without provider calls", async () => {
    await setupIntegration(); const before = await stats();
    const audio = created[0];
    actualApi.clearStoredTokens();
    await assert.rejects(actualApi.transcribeAudio(audio, "en-IN", "missing-client-token"), (error) => error.status === 401);
    actualApi.setStoredTokens("invalid-test-token");
    await assert.rejects(actualApi.transcribeAudio(audio, "en-IN", "invalid-token"), (error) => error.status === 401);
    actualApi.setStoredTokens(process.env.VOICE_E2E_TOKEN);
    for (const [blob, status] of [[new Blob(["not WAV"]), 415], [audio.slice(0, 50), 400],
      [new Blob([new Uint8Array(1048577)]), 413], [new Blob([new Uint8Array(2097153)]), 413]]) {
      await assert.rejects(actualApi.transcribeAudio(blob, "en-IN", crypto.randomUUID()), (error) => error.status === status);
    }
    const missing = await fetch(`${base}/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${process.env.VOICE_E2E_TOKEN}` }, body: new FormData() });
    assert.equal(missing.status, 400);
    const form = new FormData(); form.append("file", audio, "recording.wav"); form.append("language_code", "en-IN");
    assert.equal((await fetch(`${base}/transcribe`, { method: "POST", body: form })).status, 401);
    assert.equal((await stats()).provider, before.provider);
  });
}
