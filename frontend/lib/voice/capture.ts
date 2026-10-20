import { encodeWav, resampleMono, VOICE_MAX_SECONDS } from "./audio";

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true
    && typeof window.AudioContext === "function" && typeof window.AudioWorkletNode === "function"
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** One recording session; dispose also handles late permission responses. */
export class VoiceCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private mute: GainNode | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  private samples: Float32Array | null = null;
  private count = 0;
  private disposed = false;
  private finished = false;
  private hardwareStopped = false;
  private complete: (() => void) | null = null;
  private reject: ((error: Error) => void) | null = null;
  private stopped: Promise<void> | null = null;
  private analyser: AnalyserNode | null = null;
  private levelFrame: number | null = null;
  private levelBuffer: Uint8Array<ArrayBuffer> | null = null;

  constructor(
    private onComplete: () => void,
    private onError: (error: Error) => void,
    /** Optional audio-level tap (0..1, ~12 Hz) for a live meter. */
    private onLevel?: (level: number) => void,
  ) {}

  async start(): Promise<void> {
    if (!recordingSupported()) throw new Error("voiceUnsupported");
    try {
      this.context = new window.AudioContext();
      // Resume within the click gesture, before waiting for permission.
      const resumed = this.context.resume();
      void resumed.catch(() => undefined);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 }, echoCancellation: true }, video: false });
      if (this.disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      await resumed;
      if (this.disposed) return;
      const context = this.context;
      if (!context?.audioWorklet || context.sampleRate < 8000 || context.sampleRate > 96000) throw new Error("voiceUnsupported");
      await context.audioWorklet.addModule("/voice-processor.js");
      if (this.disposed) return;
      this.samples = new Float32Array(Math.floor(context.sampleRate * VOICE_MAX_SECONDS));
      this.source = context.createMediaStreamSource(stream);
      if (this.onLevel && typeof context.createAnalyser === "function") {
        this.analyser = context.createAnalyser();
        this.analyser.fftSize = 512;
        this.levelBuffer = new Uint8Array(this.analyser.fftSize);
        this.source.connect(this.analyser);
        this.startLevelLoop();
      }
      this.worklet = new window.AudioWorkletNode(context, "grievai-voice");
      this.mute = context.createGain();
      this.mute.gain.value = 0;
      this.stopped = new Promise<void>((resolve, reject) => { this.complete = resolve; this.reject = reject; });
      // Attach a handler now: device failure may occur before Stop is clicked.
      void this.stopped.catch(() => undefined);
      this.worklet.port.onmessage = ({ data }) => {
        if (this.disposed || this.finished) return;
        if (data.type === "samples" && data.samples instanceof Float32Array && this.samples) {
          const count = Math.min(data.samples.length, this.samples.length - this.count);
          this.samples.set(data.samples.subarray(0, count), this.count);
          this.count += count;
        }
        if (data.type === "complete") {
          this.finished = true;
          this.stopHardware(); // switch the microphone off before resampling
          this.complete?.();
          this.onComplete();
        }
      };
      const fail = () => {
        if (this.disposed || this.finished) return;
        const error = new Error("voiceDeviceError");
        this.reject?.(error);
        this.onError(error);
        this.dispose();
      };
      this.worklet.onprocessorerror = fail;
      stream.getAudioTracks().forEach((track) => { track.onended = fail; });
      this.source.connect(this.worklet);
      this.worklet.connect(this.mute).connect(context.destination);
      if (context.state !== "running") {
        try {
          await context.resume();
        } catch {
          // Handled downstream if resume fails
        }
      }
      this.worklet.port.postMessage("start");
      this.timer = setTimeout(() => this.requestStop(), VOICE_MAX_SECONDS * 1000);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private requestStop() {
    if (this.disposed || this.finished) return;
    this.worklet?.port.postMessage("stop");
  }

  private startLevelLoop() {
    if (typeof requestAnimationFrame !== "function") return;
    let last = 0;
    const tick = () => {
      if (this.disposed || this.finished) return;
      const now = performance.now();
      if (now - last >= 80) {
        last = now;
        const analyser = this.analyser;
        const buffer = this.levelBuffer;
        if (analyser && buffer) {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const value = (buffer[i] - 128) / 128;
            sum += value * value;
          }
          // RMS of speech is ~0.02–0.2; scale ×3 and clamp for a usable meter.
          this.onLevel?.(Math.min(1, Math.sqrt(sum / buffer.length) * 3));
        }
      }
      this.levelFrame = requestAnimationFrame(tick);
    };
    this.levelFrame = requestAnimationFrame(tick);
  }

  private stopLevelLoop() {
    if (this.levelFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.levelFrame);
    this.levelFrame = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.levelBuffer = null;
  }

  async stop(): Promise<Blob> {
    if (!this.context || !this.samples || this.disposed) throw new Error("voiceEmpty");
    const rate = this.context.sampleRate;
    this.requestStop();
    this.stopTimer = setTimeout(() => this.reject?.(new Error("voiceDeviceError")), 2000);
    try {
      await this.stopped;
      if (this.disposed || !this.samples) throw new Error("voiceEmpty");
      const mono = this.samples.subarray(0, this.count);
      const wav = encodeWav(resampleMono(mono, rate));
      return new Blob([wav], { type: "audio/wav" });
    } finally {
      this.dispose();
    }
  }

  private stopHardware() {
    if (this.hardwareStopped) return;
    this.hardwareStopped = true;
    clearTimeout(this.timer);
    this.stopLevelLoop();
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.onprocessorerror = null;
      this.worklet.port.close();
      this.worklet.disconnect();
    }
    this.source?.disconnect(); this.mute?.disconnect();
    this.stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => undefined);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer); clearTimeout(this.stopTimer);
    this.reject?.(new Error("voiceCancelled"));
    this.stopHardware();
    this.samples = null;
  }
}
