// VoiceCapture lifecycle (the class shared by the conversational intake).
// The retired single-shot recorder used to carry these tests; they are kept
// here so permission, device-failure, timer and cleanup behavior stay covered.
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { sourceLoader } from "./voice-test-loader.mjs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;

const { VoiceCapture } = sourceLoader()("lib/voice/capture.ts");

let contexts, worklets, tracks;

class NodeMock {
  connect(next) { return next; }
  disconnect() {}
}
class ContextMock {
  constructor() {
    this.sampleRate = 48000;
    this.state = "running";
    this.destination = new NodeMock();
    this.audioWorklet = { addModule: async () => {} };
    contexts.push(this);
  }
  resume() { return Promise.resolve(); }
  createMediaStreamSource() { return new NodeMock(); }
  createGain() { const node = new NodeMock(); node.gain = { value: 0 }; return node; }
  close() { this.state = "closed"; return Promise.resolve(); }
}
class WorkletMock extends NodeMock {
  constructor() {
    super();
    worklets.push(this);
    this.port = {
      onmessage: null,
      closed: false,
      close: () => { this.port.closed = true; },
      postMessage: (message) => {
        if (message === "stop") queueMicrotask(() => {
          this.port.onmessage?.({ data: { type: "samples", samples: new Float32Array(4800).fill(0.2) } });
          this.port.onmessage?.({ data: { type: "complete" } });
        });
      },
    };
  }
}
function microphone() {
  const track = { stopped: false, onended: null, stop() { this.stopped = true; } };
  tracks.push(track);
  return { getTracks: () => [track], getAudioTracks: () => [track] };
}

beforeEach(() => {
  contexts = []; worklets = []; tracks = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  window.AudioContext = ContextMock;
  window.AudioWorkletNode = WorkletMock;
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: async () => microphone() },
    configurable: true,
  });
});
afterEach(() => {
  dom.window.close?.();
});

test("start → stop returns a 16 kHz mono WAV and releases hardware", async () => {
  let completed = 0;
  const errors = [];
  const capture = new VoiceCapture(() => { completed += 1; }, (error) => errors.push(error));
  await capture.start();
  const blob = await capture.stop();

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), "RIFF");
  assert.equal(Buffer.from(bytes.subarray(8, 12)).toString(), "WAVE");
  assert.equal(view.getUint32(24, true), 16000, "resampled to 16 kHz");
  assert.equal(view.getUint32(40, true), 4800 * 2 * 16000 / 48000, "1600 frames of PCM");
  assert.equal(completed, 1);
  assert.deepEqual(errors, []);
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(contexts[0].state, "closed");
  assert.ok(worklets.every((node) => node.port.closed));
});

test("sequential recording sessions (session 1 stop -> session 2 start -> stop) succeed cleanly", async () => {
  let completed = 0;
  const errors = [];
  const capture1 = new VoiceCapture(() => { completed += 1; }, (error) => errors.push(error));
  await capture1.start();
  const blob1 = await capture1.stop();
  assert.equal(completed, 1);
  assert.equal(contexts[0].state, "closed");

  const capture2 = new VoiceCapture(() => { completed += 1; }, (error) => errors.push(error));
  await capture2.start();
  assert.equal(contexts[1].state, "running");
  const blob2 = await capture2.stop();
  assert.equal(completed, 2);
  assert.equal(contexts[1].state, "closed");
  assert.ok(blob1.size > 0 && blob2.size > 0);
  assert.deepEqual(errors, []);
});

test("permission denied closes the context and surfaces the DOMException", async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); };
  const capture = new VoiceCapture(() => assert.fail("must not complete"), () => {});
  await assert.rejects(capture.start(), (error) => error.name === "NotAllowedError");
  assert.equal(contexts[0].state, "closed");
  assert.equal(tracks.length, 0);
});

test("missing microphone surfaces NotFoundError without leaking resources", async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("missing", "NotFoundError"); };
  const capture = new VoiceCapture(() => assert.fail("must not complete"), () => {});
  await assert.rejects(capture.start(), (error) => error.name === "NotFoundError");
  assert.equal(contexts[0].state, "closed");
});

test("unsupported APIs and insecure contexts reject before permission", async () => {
  window.AudioWorkletNode = undefined;
  navigator.mediaDevices.getUserMedia = () => assert.fail("must not request permission");
  const capture = new VoiceCapture(() => {}, () => {});
  await assert.rejects(capture.start(), /voiceUnsupported/);
  assert.equal(contexts.length, 0);

  window.AudioWorkletNode = WorkletMock;
  Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
  await assert.rejects(capture.start(), /voiceUnsupported/);
  assert.equal(contexts.length, 0);
});

test("dispose while recording stops tracks, context and port", async () => {
  const capture = new VoiceCapture(() => {}, () => {});
  await capture.start();
  capture.dispose();
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(contexts[0].state, "closed");
  assert.ok(worklets.every((node) => node.port.closed));
});

test("late permission after dispose is stopped immediately", async () => {
  let allow;
  navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => { allow = resolve; });
  const capture = new VoiceCapture(() => assert.fail("disposed capture must not complete"), () => {});
  const pending = capture.start();
  capture.dispose();
  allow(microphone());
  await pending;
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(contexts[0].state, "closed");
});

test("30-second timer stops the worklet and completes the capture", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  let completed = 0;
  const capture = new VoiceCapture(() => { completed += 1; }, () => {});
  await capture.start();
  context.mock.timers.tick(30000);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(completed, 1);
  assert.ok(tracks.every((track) => track.stopped));
  context.mock.timers.reset();
});

test("processor failure reports voiceDeviceError and releases resources", async () => {
  const errors = [];
  const capture = new VoiceCapture(() => assert.fail("must not complete"), (error) => errors.push(error.message));
  await capture.start();
  worklets[0].onprocessorerror();
  assert.deepEqual(errors, ["voiceDeviceError"]);
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(contexts[0].state, "closed");
  assert.ok(worklets.every((node) => node.port.closed));
});
