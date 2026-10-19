// Pre-recorded question playback and asset completeness (DEC-039).
//
// The player is DOM-facing, so the test installs a minimal window with a fake
// AudioContext/<audio>. No real audio device or network is touched.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test, beforeEach, afterEach } from "node:test";
import { sourceLoader, frontendRoot } from "./voice-test-loader.mjs";

const speech = sourceLoader()("lib/voice/speech.ts");
const intake = sourceLoader()("lib/voice/intake.ts");
const { SpeechPlayer, questionAudioUrl, readMuted, writeMuted, SPEECH_MUTE_KEY } = speech;

const LANGUAGES = ["en-IN", "hi-IN", "mr-IN"];

// ---------------------------------------------------------------------------
// Assets: one clip per question kind per language, committed once.
// ---------------------------------------------------------------------------

test("every question kind has a non-empty WAV clip in every language", () => {
  assert.equal(intake.INTAKE_QUESTION_KINDS.length, 8);
  for (const language of LANGUAGES) {
    for (const kind of intake.INTAKE_QUESTION_KINDS) {
      const file = path.join(frontendRoot, "public", "voice", "questions", `${kind}.${language}.wav`);
      assert.ok(fs.existsSync(file), `missing clip: ${path.relative(frontendRoot, file)}`);
      const data = fs.readFileSync(file);
      assert.ok(data.length > 1000, `${kind}.${language}.wav is suspiciously small`);
      assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", `${kind}.${language}.wav is not a WAV file`);
      assert.equal(data.subarray(8, 12).toString("ascii"), "WAVE", `${kind}.${language}.wav is not a WAV file`);
    }
  }
});

test("opening prompt has a non-empty WAV clip in every language", () => {
  for (const language of LANGUAGES) {
    const file = path.join(frontendRoot, "public", "voice", "questions", `intro.${language}.wav`);
    assert.ok(fs.existsSync(file), `missing clip: ${path.relative(frontendRoot, file)}`);
    const data = fs.readFileSync(file);
    assert.ok(data.length > 1000, `intro.${language}.wav is suspiciously small`);
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", `intro.${language}.wav is not a WAV file`);
    assert.equal(data.subarray(8, 12).toString("ascii"), "WAVE", `intro.${language}.wav is not a WAV file`);
  }
});

test("audio URLs point at the static assets", () => {
  assert.equal(questionAudioUrl("intro", "en-IN"), "/voice/questions/intro.en-IN.wav");
  assert.equal(questionAudioUrl("location", "hi-IN"), "/voice/questions/location.hi-IN.wav");
  assert.equal(questionAudioUrl("clarify", "mr-IN"), "/voice/questions/clarify.mr-IN.wav");
});

// ---------------------------------------------------------------------------
// Mute preference.
// ---------------------------------------------------------------------------

beforeEach(() => {
  const store = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
    },
  };
});

afterEach(() => {
  delete global.window;
});

test("mute preference round-trips and defaults to off", () => {
  assert.equal(readMuted(), false);
  writeMuted(true);
  assert.equal(global.window.localStorage.getItem(SPEECH_MUTE_KEY), "true");
  assert.equal(readMuted(), true);
  writeMuted(false);
  assert.equal(readMuted(), false);
});

test("a storage failure never throws", () => {
  global.window.localStorage.getItem = () => { throw new Error("denied"); };
  global.window.localStorage.setItem = () => { throw new Error("denied"); };
  assert.equal(readMuted(), false);
  assert.doesNotThrow(() => writeMuted(true));
});

// ---------------------------------------------------------------------------
// Web Audio path.
// ---------------------------------------------------------------------------

class FakeSource {
  constructor(context) {
    this.context = context;
    this.onended = null;
    this.started = false;
    this.stopped = false;
  }
  connect(node) { this.output = node; }
  start() { this.started = true; this.context.sources.push(this); }
  stop() { this.stopped = true; this.onended?.(); }
  disconnect() { this.disconnected = true; }
}

class FakeContext {
  constructor() {
    this.state = "suspended";
    this.destination = {};
    this.sources = [];
    FakeContext.instances.push(this);
  }
  async resume() { this.state = "running"; }
  async decodeAudioData(buffer) { return { bytes: buffer.byteLength }; }
  createBufferSource() { return new FakeSource(this); }
  async close() { this.state = "closed"; }
}
FakeContext.instances = [];

function installContext() {
  FakeContext.instances = [];
  global.window.AudioContext = FakeContext;
  return FakeContext;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function waitFor(predicate, label = "condition") {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await flush();
  }
  throw new Error(`timed out waiting for ${label}`);
}

let fetchCalls;
beforeEach(() => {
  fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(url);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(64) };
  };
});

test("plays through the unlocked AudioContext and caches the clip", async () => {
  installContext();
  const player = new SpeechPlayer();
  player.unlock();
  assert.equal(FakeContext.instances.length, 1);
  await flush();
  assert.equal(FakeContext.instances[0].state, "running");

  const first = player.play("/voice/questions/when.en-IN.wav");
  await waitFor(() => FakeContext.instances[0].sources.length === 1, "playback start");
  assert.equal(fetchCalls.length, 1);
  FakeContext.instances[0].sources[0].onended?.();
  assert.equal(await first, "played");

  const second = player.play("/voice/questions/when.en-IN.wav");
  await waitFor(() => FakeContext.instances[0].sources.length === 2, "replay start");
  assert.equal(fetchCalls.length, 1, "the decoded buffer is reused");
  FakeContext.instances[0].sources[1].onended?.();
  assert.equal(await second, "played");

  player.dispose();
  assert.equal(FakeContext.instances[0].state, "closed");
});

test("a new question supersedes the previous one", async () => {
  installContext();
  const player = new SpeechPlayer();
  player.unlock();
  await flush();

  const first = player.play("/voice/questions/details.en-IN.wav");
  await waitFor(() => FakeContext.instances[0].sources.length === 1, "first start");
  const second = player.play("/voice/questions/location.en-IN.wav");
  assert.equal(await first, "cancelled");
  await waitFor(() => FakeContext.instances[0].sources.length === 2, "second start");
  assert.equal(FakeContext.instances[0].sources[0].stopped, true);
  FakeContext.instances[0].sources[1].onended?.();
  assert.equal(await second, "played");
});

test("stopCurrent cancels pending playback", async () => {
  installContext();
  const player = new SpeechPlayer();
  player.unlock();
  await flush();

  const playing = player.play("/voice/questions/danger.en-IN.wav");
  await waitFor(() => FakeContext.instances[0].sources.length === 1, "start");
  player.stopCurrent();
  assert.equal(await playing, "cancelled");
});

test("a missing clip fails instead of hanging", async () => {
  installContext();
  delete global.window.Audio; // no element fallback: this is the failure path
  global.fetch = async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
  const player = new SpeechPlayer();
  player.unlock();
  await flush();
  assert.equal(await player.play("/voice/questions/nope.en-IN.wav"), "failed");
});

// ---------------------------------------------------------------------------
// <audio> fallback (no Web Audio, or the context could not be resumed).
// ---------------------------------------------------------------------------

class FakeAudio {
  constructor(url) { this.url = url; this.paused = false; FakeAudio.instances.push(this); }
  play() { this.started = true; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() {}
}
FakeAudio.instances = [];

beforeEach(() => {
  FakeAudio.instances = [];
  global.window.Audio = FakeAudio;
});

test("falls back to an <audio> element without Web Audio", async () => {
  const player = new SpeechPlayer();
  const playing = player.play("/voice/questions/affected.en-IN.wav");
  await waitFor(() => FakeAudio.instances.length === 1, "element creation");
  assert.equal(FakeAudio.instances[0].url, "/voice/questions/affected.en-IN.wav");
  assert.equal(FakeAudio.instances[0].started, true);
  FakeAudio.instances[0].onended?.();
  assert.equal(await playing, "played");
});

test("a blocked element reports failure", async () => {
  FakeAudio.prototype.play = () => Promise.reject(new Error("NotAllowedError"));
  const player = new SpeechPlayer();
  assert.equal(await player.play("/voice/questions/affected.en-IN.wav"), "failed");
  FakeAudio.prototype.play = function () { this.started = true; return Promise.resolve(); };
});

test("dispose stops playback and is idempotent", async () => {
  installContext();
  const player = new SpeechPlayer();
  player.unlock();
  await flush();
  const playing = player.play("/voice/questions/frequency.en-IN.wav");
  await waitFor(() => FakeContext.instances[0].sources.length === 1, "start");
  player.dispose();
  player.dispose();
  assert.equal(await playing, "cancelled");
  assert.equal(await player.play("/voice/questions/frequency.en-IN.wav"), "cancelled");
});
