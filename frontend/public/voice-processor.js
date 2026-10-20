/* AudioWorklet scope: no network, persistence, playback, or automatic start. */
/* global AudioWorkletProcessor, sampleRate, registerProcessor */
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.frames = 0;
    this.chunk = new Float32Array(2048);
    this.used = 0;
    this.port.onmessage = ({ data }) => {
      if (data === "start") this.recording = true;
      if (data === "stop") this.finish();
    };
  }
  flush() {
    if (!this.used) return;
    const chunk = this.chunk.slice(0, this.used);
    this.port.postMessage({ type: "samples", samples: chunk }, [chunk.buffer]);
    this.used = 0;
  }
  finish() {
    this.recording = false;
    this.flush();
    this.port.postMessage({ type: "complete" });
  }
  process(inputs) {
    if (!this.recording) return true;
    const channels = inputs[0];
    if (!channels?.length) return true;
    const remaining = Math.floor(sampleRate * 30) - this.frames;
    const count = Math.min(channels[0].length, remaining);
    for (let i = 0; i < count; i++) {
      let mono = 0;
      for (const channel of channels) mono += channel[i] ?? 0;
      this.chunk[this.used++] = mono / channels.length;
      this.frames++;
      if (this.used === this.chunk.length) this.flush();
    }
    if (this.frames >= Math.floor(sampleRate * 30)) this.finish();
    return true; // connected output is silence; microphone is never monitored
  }
}
registerProcessor("grievai-voice", VoiceProcessor);
