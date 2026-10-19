import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { sourceLoader, frontendRoot } from "./voice-test-loader.mjs";

const { encodeWav, resampleMono } = sourceLoader()("lib/voice/audio.ts");

test("WAV headers and little-endian signed PCM", () => {
  const wav = encodeWav(new Float32Array([-1, 0, 1, 2, NaN]));
  const view = new DataView(wav);
  assert.equal(Buffer.from(wav).subarray(0, 4).toString(), "RIFF");
  assert.equal(Buffer.from(wav).subarray(8, 12).toString(), "WAVE");
  assert.equal(view.getUint32(4, true), wav.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint32(28, true), 32000);
  assert.equal(view.getUint16(32, true), 2);
  assert.equal(view.getUint16(34, true), 16);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true)), [-32768, 0, 32767, 32767, 0]);
});

for (const rate of [8000, 16000, 44100, 48000]) {
  test(`resampling ${rate} Hz preserves a constant mono signal and sample count`, () => {
    const input = new Float32Array(rate).fill(0.25);
    const result = resampleMono(input, rate);
    assert.equal(result.length, 16000);
    assert.ok(result.every((sample) => Math.abs(sample - 0.25) < 0.0001));
  });
}

test("low-pass resampling suppresses frequencies above the target Nyquist limit", () => {
  const sine = (frequency) => Float32Array.from({ length: 48000 }, (_, i) => Math.sin(2 * Math.PI * frequency * i / 48000));
  const rms = (data) => Math.sqrt(data.slice(50, -50).reduce((sum, value) => sum + value * value, 0) / (data.length - 100));
  assert.ok(rms(resampleMono(sine(1000), 48000)) > 0.6);
  assert.ok(rms(resampleMono(sine(12000), 48000)) < 0.1);
});

test("duration/frame caps and actual backend WAV compatibility", () => {
  const wav = encodeWav(new Float32Array(480001));
  assert.equal(wav.byteLength, 960044);
  assert.ok(wav.byteLength < 1024 * 1024);
  assert.equal(new DataView(wav).getUint32(40, true), 480000 * 2);
  assert.equal(resampleMono(new Float32Array(48000 * 31), 48000).length, 480000);
  const repo = path.resolve(frontendRoot, "..");
  const python = path.join(repo, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (fs.existsSync(python)) {
    const result = spawnSync(python, ["-c", "import sys; from backend.app.services.audio_validation import validate_wav; data=sys.stdin.buffer.read(); assert validate_wav(data)==data; print('validated')"], { cwd: repo, input: Buffer.from(wav), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /validated/);
  }
});

test("empty or unsupported samples fail safely", () => {
  assert.throws(() => encodeWav(new Float32Array()), /voiceEmpty/);
  assert.throws(() => resampleMono(new Float32Array(3), 192000), /voiceUnsupported/);
});

function processor(rate) {
  let Processor;
  const messages = [];
  const context = vm.createContext({
    sampleRate: rate, Float32Array,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (data) => messages.push(data) }; } },
    registerProcessor: (_, value) => { Processor = value; },
  });
  vm.runInContext(fs.readFileSync(path.join(frontendRoot, "public/voice-processor.js"), "utf8"), context);
  return { instance: new Processor(), messages };
}

test("worklet never captures before Start, downmixes stereo, flushes on Stop", () => {
  const { instance, messages } = processor(16000);
  instance.process([[new Float32Array(128).fill(1), new Float32Array(128)]]);
  assert.equal(instance.frames, 0);
  instance.port.onmessage({ data: "start" });
  instance.process([[new Float32Array(128).fill(1), new Float32Array(128)]]);
  instance.port.onmessage({ data: "stop" });
  assert.equal(messages[0].samples.length, 128);
  assert.ok(messages[0].samples.every((value) => value === 0.5));
  assert.equal(messages[1].type, "complete");
});

test("worklet enforces 30 seconds even without the main-thread timer", () => {
  const { instance, messages } = processor(16000);
  instance.port.onmessage({ data: "start" });
  for (let i = 0; i < 4000; i++) instance.process([[new Float32Array(128)]]);
  assert.equal(instance.frames, 480000);
  assert.equal(messages.filter((message) => message.type === "complete").length, 1);
  assert.equal(messages.filter((message) => message.samples).reduce((sum, message) => sum + message.samples.length, 0), 480000);
});
