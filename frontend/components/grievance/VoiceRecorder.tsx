"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Mic, Square, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { transcribeAudio } from "@/lib/api";
import type { VoiceLanguage } from "@/lib/types";
import { VoiceCapture } from "@/lib/voice/capture";
import { newIdempotencyKey, voiceErrorMessage } from "@/lib/voice/errors";

type Phase = "idle" | "starting" | "recording" | "encoding" | "ready" | "transcribing";
const phaseMessage: Record<Phase, MessageKey> = {
  idle: "voiceIdle", starting: "voiceStarting", recording: "voiceRecording",
  encoding: "voiceEncoding", ready: "voiceReady", transcribing: "voiceProcessing",
};

export function VoiceRecorder({ prepareTranscription, onTranscript, disabled = false }: {
  prepareTranscription: (signal: AbortSignal) => string | null | Promise<string | null>;
  onTranscript: (text: string, originalDescription: string, signal: AbortSignal) => boolean | Promise<boolean>;
  disabled?: boolean;
}) {
  const { t, language: interfaceLanguage } = useI18n();
  const id = useId();
  const [language, setLanguage] = useState<VoiceLanguage>(() => `${interfaceLanguage}-IN` as VoiceLanguage);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const capture = useRef<VoiceCapture | null>(null);
  const audioElement = useRef<HTMLAudioElement>(null);
  const currentUrl = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const stopping = useRef(false);
  const busy = useRef(false);
  const ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const playbackRef = useCallback((element: HTMLAudioElement | null) => {
    if (!element && audioElement.current) {
      // Strict Mode replays ref detach/attach on mount. Leave React's src
      // intact; actual discard/unmount cleanup revokes the owned Blob URL.
      audioElement.current.pause();
    }
    audioElement.current = element;
  }, []);

  function cleanup() {
    epoch.current++;
    clearInterval(ticker.current);
    capture.current?.dispose(); capture.current = null;
    request.current?.abort(); request.current = null;
    audioElement.current?.pause();
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
    busy.current = false; stopping.current = false;
  }

  // Navigation/unmount must also cancel pending permission and transcription.
  useEffect(() => () => {
    epoch.current++;
    clearInterval(ticker.current);
    capture.current?.dispose();
    request.current?.abort();
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
  }, []);

  function discard() {
    cleanup(); setAudio(null); setUrl(null); setSeconds(0);
    setPhase("idle"); setError(null); setNotice(null);
  }

  async function stop(session: VoiceCapture, generation: number) {
    if (stopping.current || epoch.current !== generation) return;
    stopping.current = true;
    clearInterval(ticker.current);
    setPhase("encoding");
    try {
      const wav = await session.stop();
      if (epoch.current !== generation) return;
      const nextUrl = URL.createObjectURL(wav);
      currentUrl.current = nextUrl; setUrl(nextUrl); setAudio(wav); setPhase("ready");
    } catch (cause) {
      if (epoch.current === generation) { setError(voiceErrorMessage(cause)); setPhase("idle"); }
    } finally {
      if (epoch.current === generation) { capture.current = null; busy.current = false; stopping.current = false; }
    }
  }

  async function start() {
    if (disabled || busy.current) return;
    cleanup(); setAudio(null); setUrl(null); setError(null); setNotice(null); setSeconds(0);
    const generation = epoch.current;
    busy.current = true; setPhase("starting");
    const session = new VoiceCapture(
      () => { void stop(session, generation); },
      (cause) => {
        if (epoch.current !== generation) return;
        cleanup(); setError(voiceErrorMessage(cause)); setPhase("idle");
      },
    );
    capture.current = session;
    try {
      await session.start();
      if (epoch.current !== generation) return;
      setPhase("recording");
      const started = performance.now();
      ticker.current = setInterval(() => setSeconds(Math.min(30, Math.floor((performance.now() - started) / 1000))), 250);
    } catch (cause) {
      if (epoch.current !== generation) return;
      capture.current = null; busy.current = false; setPhase("idle");
      const message = voiceErrorMessage(cause);
      setError(message === "voiceFailure" ? "voiceDeviceError" : message);
    }
  }

  async function transcribe() {
    if (disabled || busy.current || !audio) return;
    busy.current = true;
    const generation = epoch.current;
    const controller = new AbortController(); request.current = controller;
    try {
      const original = await prepareTranscription(controller.signal);
      if (epoch.current !== generation) return;
      if (original === null) { setNotice("voiceKept"); return; }
      setPhase("transcribing"); setError(null); setNotice(null);
      const key = newIdempotencyKey();
      const result = await transcribeAudio(audio, language, key, controller.signal);
      if (epoch.current !== generation) return;
      const inserted = await onTranscript(result.transcript, original, controller.signal);
      if (epoch.current !== generation) return;
      setNotice(inserted ? "voiceInserted" : "voiceKept");
    } catch (cause) {
      if (epoch.current === generation) setError(voiceErrorMessage(cause));
    } finally {
      if (epoch.current === generation) { busy.current = false; request.current = null; setPhase("ready"); }
    }
  }

  const locked = disabled || phase === "starting" || phase === "recording" || phase === "encoding" || phase === "transcribing";
  return (
    <section aria-labelledby={`${id}-title`} className="mt-3 space-y-3 rounded-md border border-ink-200 bg-ink-50/50 p-4">
      <h3 id={`${id}-title`} className="text-sm font-semibold text-ink-900">{t("voiceTitle")}</h3>
      <p className="text-xs leading-5 text-ink-500">{t("voiceHint")}</p>
      <label htmlFor={`${id}-language`} className="block text-xs font-medium text-ink-700">{t("voiceLanguage")}</label>
      <Select id={`${id}-language`} value={language} disabled={locked} onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}>
        <option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="mr-IN">मराठी</option>
      </Select>
      <div className="flex flex-wrap gap-2">
        {phase === "recording" ? (
          <Button type="button" variant="orange" size="sm" onClick={() => { if (capture.current) void stop(capture.current, epoch.current); }} disabled={disabled}>
            <Square size={14} aria-hidden="true" />{t("voiceStop")}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => void start()} disabled={locked}>
            <Mic size={14} aria-hidden="true" />{t(audio ? "voiceAgain" : "voiceStart")}
          </Button>
        )}
        {(audio || phase !== "idle") && <Button type="button" variant="ghost" size="sm" onClick={discard} disabled={disabled}>{t("voiceDiscard")}</Button>}
        {audio && <Button type="button" size="sm" onClick={() => void transcribe()} disabled={locked}>
          {phase === "transcribing" && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}{t("voiceTranscribe")}
        </Button>}
      </div>
      {url && <audio ref={playbackRef} controls preload="metadata" src={url} aria-label={t("voicePlayback")} className="h-10 w-full" />}
      <p role="status" aria-live="polite" className="text-xs text-ink-600">{notice ? t(notice) : t(phaseMessage[phase], { seconds })}</p>
      {error && <p role="alert" className="text-xs font-medium text-red-600">{t(error)}</p>}
    </section>
  );
}
