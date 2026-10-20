/** Playback of the pre-recorded question clips (DEC-039).
 *
 * Every question is a fixed template, so the audio is a static file under
 * `/voice/questions/` — generated once per language and committed. No network
 * call to a TTS provider, no per-conversation spend, and questions still play
 * when Sarvam is unreachable.
 *
 * Browsers block audio that starts outside a user gesture. Questions play
 * *after* an async STT/LLM round-trip, so `unlock()` must be called from a real
 * tap (start/send/retry) and the shared AudioContext reused afterwards. If the
 * context stays suspended (or Web Audio is unavailable), playback falls back
 * to an <audio> element, which works once the page has had an interaction.
 */

export const SPEECH_MUTE_KEY = "grievai-voice-muted";

export type SpeechLanguage = "en-IN" | "hi-IN" | "mr-IN";

export type SpeechOutcome = "played" | "failed" | "cancelled";

/** Static asset path for one question kind. */
export function questionAudioUrl(kind: string, language: SpeechLanguage): string {
  return `/voice/questions/${kind}.${language}.wav`;
}

export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(SPEECH_MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(SPEECH_MUTE_KEY, muted ? "true" : "false");
  } catch {
    // Private mode / storage disabled — the toggle still works for this session.
  }
}

/** How long to wait for a suspended context to resume before using <audio>. */
const RESUME_TIMEOUT_MS = 300;

export class SpeechPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private element: HTMLAudioElement | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private token = 0;
  private disposed = false;
  private cancelActive: (() => void) | null = null;

  /** Must be called from a user gesture; safe to call repeatedly. */
  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.context && typeof window.AudioContext === "function") {
        this.context = new window.AudioContext();
      }
      if (this.context?.state === "suspended") {
        void this.context.resume().catch(() => undefined);
      }
    } catch {
      this.context = null;
    }
  }

  /** Play one clip. Resolves when playback ends, is superseded, or fails. */
  async play(url: string): Promise<SpeechOutcome> {
    // Cancel first, then take the token — stopCurrent() also bumps it.
    this.stopCurrent();
    const token = ++this.token;
    if (this.disposed) return "cancelled";

    const context = await this.readyContext();
    if (this.disposed || token !== this.token) return "cancelled";
    if (context) {
      try {
        const decoded = await this.load(context, url);
        if (this.disposed || token !== this.token) return "cancelled";
        return await this.startBuffer(context, decoded, token);
      } catch {
        // Fall through to <audio>: some browsers reject decodeAudioData on a
        // suspended/closed context, and a missing clip should degrade quietly.
      }
    }

    if (typeof window !== "undefined" && typeof window.Audio === "function") {
      return this.startElement(url, token);
    }
    return "failed";
  }

  /** Stop whatever is playing or about to play. */
  stopCurrent(): void {
    this.token += 1;
    // Detach first: the cancel/finish callback clears these fields itself.
    const cancel = this.cancelActive;
    const source = this.source;
    const element = this.element;
    this.cancelActive = null;
    this.source = null;
    this.element = null;
    cancel?.();
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
    }
    if (element) {
      element.onended = null;
      element.onerror = null;
      element.pause();
      element.removeAttribute("src");
    }
    if (this.context && this.context.state === "running" && typeof this.context.suspend === "function") {
      void this.context.suspend().catch(() => undefined);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopCurrent();
    this.buffers.clear();
    if (this.context && this.context.state !== "closed") {
      void this.context.close().catch(() => undefined);
    }
    this.context = null;
  }

  /** The shared context, but only if it is actually running. */
  private async readyContext(): Promise<AudioContext | null> {
    const context = this.context;
    if (!context || context.state === "closed") return null;
    if (context.state === "running") return context;
    if (context.state === "suspended") {
      try {
        await Promise.race([
          context.resume(),
          new Promise<void>((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS)),
        ]);
      } catch {
        // Denied — the caller falls back to <audio>.
      }
      // Re-read through the field: the local is narrowed to "suspended" by TS.
      return this.context === context && this.context.state === "running" ? context : null;
    }
    return null;
  }

  private async load(context: AudioContext, url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(url, decoded);
    return decoded;
  }

  private startBuffer(context: AudioContext, buffer: AudioBuffer, token: number): Promise<SpeechOutcome> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (outcome: SpeechOutcome) => {
        if (settled) return;
        settled = true;
        if (this.source === source) this.source = null;
        if (this.cancelActive === cancel) this.cancelActive = null;
        resolve(outcome);
      };
      const cancel = () => finish("cancelled");

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => finish(token === this.token ? "played" : "cancelled");
      this.source = source;
      this.cancelActive = cancel;
      try {
        source.start();
      } catch {
        finish("failed");
      }
    });
  }

  private startElement(url: string, token: number): Promise<SpeechOutcome> {
    return new Promise((resolve) => {
      const element = new window.Audio(url);
      element.preload = "auto";
      let settled = false;
      const finish = (outcome: SpeechOutcome) => {
        if (settled) return;
        settled = true;
        element.onended = null;
        element.onerror = null;
        if (this.element === element) this.element = null;
        if (this.cancelActive === cancel) this.cancelActive = null;
        resolve(outcome);
      };
      const cancel = () => {
        element.pause();
        finish("cancelled");
      };

      this.element = element;
      this.cancelActive = cancel;
      element.onended = () => finish(token === this.token ? "played" : "cancelled");
      element.onerror = () => finish("failed");
      try {
        // Older/jsdom-like environments may not return a Promise from play().
        const started = element.play();
        if (started && typeof started.catch === "function") {
          started.catch(() => finish("failed"));
        }
      } catch {
        finish("failed");
      }
    });
  }
}
