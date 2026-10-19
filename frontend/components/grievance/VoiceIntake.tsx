"use client";

/** Conversational voice intake (DEC-038).
 *
 * `useVoiceIntake` owns the session state machine and side effects (recording,
 * STT, LLM extraction) and lives in SubmitForm, so switching between voice and
 * manual entry never loses the conversation. `VoiceIntake` is the presentational
 * panel; `IntakeModeToggle` is the voice/manual picker at the top of the form.
 *
 * Everything here renders INSIDE the outer complaint <form>, so every button is
 * type="button" and the typed-answer Enter key is handled manually (no nested
 * forms, no accidental submits).
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { LoaderCircle, Mic, RotateCcw, Send, SkipForward, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { voiceEn, voiceHi, voiceMr } from "@/lib/i18n/voice";
import { extractVoiceIntake, transcribeAudio } from "@/lib/api";
import type { VoiceLanguage } from "@/lib/types";
import { recordingSupported, VoiceCapture } from "@/lib/voice/capture";
import { newIdempotencyKey, voiceErrorMessage } from "@/lib/voice/errors";
import { questionAudioUrl, readMuted, SpeechPlayer, writeMuted, type SpeechOutcome } from "@/lib/voice/speech";
import {
  computeLocks,
  initialIntakeState,
  intakeReducer,
  intakeStep,
  mergeExtraction,
  planNextStep,
  questionTemplateKey,
  toExtraction,
  type IntakeQuestionKind,
  type IntakeState,
  type PlannedQuestion,
} from "@/lib/voice/intake";

export interface VoiceIntakeController {
  state: IntakeState;
  level: number;
  seconds: number;
  language: VoiceLanguage;
  setLanguage: (language: VoiceLanguage) => void;
  ready: boolean;
  /** Spoken questions are on unless the citizen muted them (persisted). */
  muted: boolean;
  toggleMuted: () => void;
  /** Replay the current question in the selected language. */
  replay: () => void;
  /** True when the current question's clip could not be played. */
  audioFailed: boolean;
  /** Fields last filled by AI (for the "AI suggestion" badges). */
  ai: { title: boolean; description: boolean };
  /** Stop everything and clear the conversation (draft fields are kept). */
  reset: () => void;
  actions: {
    start: () => void;
    stop: () => void;
    cancelRecording: () => void;
    sendTyped: (text: string) => void;
    skip: () => void;
    retry: () => void;
  };
}

export interface VoiceIntakeOptions {
  disabled: boolean;
  getValues: () => { title: string; description: string };
  getDirty: () => { title: boolean; description: boolean };
  hasCoords: () => boolean;
  applyField: (field: "title" | "description", value: string) => void;
  onLocationSuggestion: (text: string) => void;
  onReadyChange: (ready: boolean) => void;
}

/** Phases where a typed answer / typed description is acceptable. */
const TYPABLE: IntakeState["phase"][] = ["idle", "awaiting_answer", "error"];
const STARTABLE: IntakeState["phase"][] = ["idle", "awaiting_answer", "error"];

/** Question wording in the SPOKEN language, not the interface language — the
 *  card, transcript and audio must agree (DEC-039). */
const QUESTION_PACKS: Record<VoiceLanguage, Record<string, string>> = {
  "en-IN": voiceEn,
  "hi-IN": voiceHi,
  "mr-IN": voiceMr,
};

function questionText(kind: IntakeQuestionKind, language: VoiceLanguage): string {
  return QUESTION_PACKS[language][questionTemplateKey(kind)];
}

export function useVoiceIntake(options: VoiceIntakeOptions): VoiceIntakeController {
  const { language: interfaceLanguage } = useI18n();
  const [state, dispatch] = useReducer(intakeReducer, initialIntakeState);
  const [language, setLanguage] = useState<VoiceLanguage>(() => `${interfaceLanguage}-IN` as VoiceLanguage);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [ai, setAi] = useState({ title: false, description: false });
  const [muted, setMutedState] = useState(false);
  /** Message id whose clip failed, so the hint disappears with the question. */
  const [audioFailedFor, setAudioFailedFor] = useState<number | null>(null);

  const player = useRef<SpeechPlayer | null>(null);
  const mutedRef = useRef(false);

  const getPlayer = useCallback(() => {
    if (!player.current) player.current = new SpeechPlayer();
    return player.current;
  }, []);

  const speak = useCallback((kind: IntakeQuestionKind, messageId: number) => {
    void getPlayer().play(questionAudioUrl(kind, language)).then((outcome) => {
      if (outcome === "failed") setAudioFailedFor(messageId);
    }).catch(() => setAudioFailedFor(messageId));
  }, [getPlayer, language]);

  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  const capture = useRef<VoiceCapture | null>(null);
  const audio = useRef<Blob | null>(null);
  const request = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const busy = useRef(false);
  const stopping = useRef(false);
  const ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const aiRef = useRef({ title: false, description: false });
  const lastSuggestion = useRef<string | null>(null);
  const lastSpoken = useRef("");
  const lastMessageId = state.messages.length ? state.messages[state.messages.length - 1].id : 0;
  // Re-speak an open question when the citizen changes language.
  const speakKey = `${lastMessageId}:${language}`;

  // Muted preference is client-only; deferred so the first render matches SSR.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const stored = readMuted();
      mutedRef.current = stored;
      setMutedState(stored);
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const hardStop = useCallback(() => {
    epoch.current += 1;
    clearInterval(ticker.current);
    capture.current?.dispose();
    capture.current = null;
    request.current?.abort();
    request.current = null;
    player.current?.stopCurrent();
    busy.current = false;
    stopping.current = false;
    setLevel(0);
    setSeconds(0);
  }, []);

  // Navigation/unmount and submission must cancel pending permission/requests.
  useEffect(() => () => hardStop(), [hardStop]);
  useEffect(() => {
    if (!options.disabled) return undefined;
    // Deferred: the rule against synchronous setState in effects; the cancel
    // must still happen even when submission is triggered from the manual branch.
    const handle = window.setTimeout(hardStop, 0);
    return () => window.clearTimeout(handle);
  }, [options.disabled, hardStop]);
  useEffect(() => {
    optionsRef.current.onReadyChange(state.phase === "ready_for_review");
  }, [state.phase]);

  // Speak each newly asked question in the citizen's selected language
  // (DEC-039). The clip is a static asset; the AudioContext was unlocked by
  // the tap that produced this question, so autoplay policy is satisfied.
  useEffect(() => {
    if (state.phase !== "awaiting_answer" || !state.pending) return;
    if (!lastMessageId || lastSpoken.current === speakKey) return;
    lastSpoken.current = speakKey;
    if (mutedRef.current) return;
    speak(state.pending.kind, lastMessageId);
  }, [state.phase, state.pending, lastMessageId, speakKey, speak]);

  // Leaving the question (answer sent, skipped, reset) silences it immediately.
  useEffect(() => {
    if (state.phase !== "awaiting_answer" && state.phase !== "prompting") {
      player.current?.stopCurrent();
    }
  }, [state.phase]);

  useEffect(() => () => {
    player.current?.dispose();
    player.current = null;
  }, []);

  async function extract(utterances: string[], generation: number) {
    const controller = new AbortController();
    request.current = controller;
    try {
      const raw = await extractVoiceIntake({
        utterances,
        language,
        draft: optionsRef.current.getValues(),
        asked_questions: state.asked,
      }, controller.signal);
      if (epoch.current !== generation) return;
      const extraction = toExtraction(raw);
      const current = optionsRef.current.getValues();
      const locks = computeLocks({
        values: current,
        dirty: optionsRef.current.getDirty(),
        ai: aiRef.current,
      });
      const merged = mergeExtraction({ current, locks, ai: aiRef.current, extraction });
      for (const change of merged.changed) optionsRef.current.applyField(change.field, change.value);
      aiRef.current = merged.ai;
      setAi(merged.ai);
      if (extraction.locationText && extraction.locationText !== lastSuggestion.current) {
        lastSuggestion.current = extraction.locationText;
        optionsRef.current.onLocationSuggestion(extraction.locationText);
      }
      const plan = planNextStep({
        extraction,
        description: merged.values.description,
        hasCoords: optionsRef.current.hasCoords(),
        detailsAsked: state.detailsAsked,
        locationAsked: state.locationAsked,
        clarifyAsked: state.clarifyAsked,
      });
      const planned: PlannedQuestion | null = plan
        ? { ...plan, text: questionText(plan.kind, language) }
        : null;
      dispatch({ type: "EXTRACTED", extraction, plan: planned });
    } catch (cause) {
      if (epoch.current !== generation) return;
      dispatch({ type: "FAILED", step: "extract", errorKey: voiceErrorMessage(cause) });
    } finally {
      if (epoch.current === generation) request.current = null;
    }
  }

  async function transcribeAndExtract(blob: Blob, generation: number, baseUtterances: string[]) {
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await transcribeAudio(blob, language, newIdempotencyKey(), controller.signal);
      if (epoch.current !== generation) return;
      const text = result.transcript.trim();
      if (!text) {
        dispatch({ type: "FAILED", step: "transcribe", errorKey: "voiceEmpty" });
        return;
      }
      dispatch({ type: "UTTERANCE_ADDED", text });
      await extract([...baseUtterances, text], generation);
    } catch (cause) {
      if (epoch.current !== generation) return;
      dispatch({ type: "FAILED", step: "transcribe", errorKey: voiceErrorMessage(cause) });
    } finally {
      if (epoch.current === generation) request.current = null;
    }
  }

  async function finish(session: VoiceCapture, generation: number) {
    if (stopping.current || epoch.current !== generation) return;
    stopping.current = true;
    clearInterval(ticker.current);
    try {
      const blob = await session.stop();
      if (epoch.current !== generation) return;
      audio.current = blob;
      setLevel(0);
      dispatch({ type: "RECORDING_STOPPED" });
      await transcribeAndExtract(blob, generation, state.utterances);
    } catch (cause) {
      if (epoch.current !== generation) return;
      dispatch({ type: "FAILED", step: "transcribe", errorKey: voiceErrorMessage(cause) });
    } finally {
      if (epoch.current === generation) {
        stopping.current = false;
        busy.current = false;
        setSeconds(0);
      }
    }
  }

  async function start() {
    if (optionsRef.current.disabled || busy.current || !STARTABLE.includes(state.phase)) return;
    // Gesture unlock: the next question arrives after async STT + LLM.
    getPlayer().unlock();
    player.current?.stopCurrent();

    const isFirstStart = state.messages.length === 0 && state.utterances.length === 0;
    epoch.current += 1;
    const generation = epoch.current;
    busy.current = true;

    if (isFirstStart) {
      const intro = QUESTION_PACKS[language].intakeIntro;
      dispatch({ type: "PROMPT_STARTED", text: intro });

      if (!mutedRef.current) {
        let outcome: SpeechOutcome;
        try {
          const introUrl = questionAudioUrl("intro", language);
          outcome = await Promise.race([
            getPlayer().play(introUrl),
            new Promise<SpeechOutcome>((resolve) => setTimeout(() => resolve("failed"), 10000)),
          ]);
        } catch {
          outcome = "failed";
        }

        if (epoch.current !== generation) return;
        if (outcome === "cancelled") {
          busy.current = false;
          return;
        }
      }
    }

    dispatch({ type: "START" });
    audio.current = null;
    const session = new VoiceCapture(
      () => { void finish(session, generation); },
      (cause) => {
        if (epoch.current !== generation) return;
        const message = voiceErrorMessage(cause);
        hardStop();
        dispatch({ type: "FAILED", step: "transcribe", errorKey: message === "voiceFailure" ? "voiceDeviceError" : message });
      },
      (value) => { if (epoch.current === generation) setLevel(value); },
    );
    capture.current = session;
    try {
      await session.start();
      if (epoch.current !== generation) return;
      const started = performance.now();
      setSeconds(0);
      ticker.current = setInterval(() => setSeconds(Math.min(30, Math.floor((performance.now() - started) / 1000))), 250);
    } catch (cause) {
      if (epoch.current !== generation) return;
      session.dispose();
      capture.current = null;
      busy.current = false;
      const message = voiceErrorMessage(cause);
      dispatch({ type: "FAILED", step: "transcribe", errorKey: message === "voiceFailure" ? "voiceDeviceError" : message });
    }
  }

  function sendTyped(text: string) {
    const trimmed = text.trim();
    if (!trimmed || optionsRef.current.disabled || busy.current || !TYPABLE.includes(state.phase)) return;
    getPlayer().unlock();
    player.current?.stopCurrent();
    dispatch({ type: "UTTERANCE_ADDED", text: trimmed });
    const generation = epoch.current;
    busy.current = true;
    void extract([...state.utterances, trimmed], generation).finally(() => { busy.current = false; });
  }

  function retry() {
    if (optionsRef.current.disabled || busy.current) return;
    getPlayer().unlock();
    const generation = epoch.current;
    busy.current = true;
    if (state.failedStep === "extract" && state.utterances.length) {
      dispatch({ type: "RETRY" });
      void extract(state.utterances, generation).finally(() => { busy.current = false; });
    } else if (state.failedStep === "transcribe" && audio.current) {
      dispatch({ type: "RETRY" });
      void transcribeAndExtract(audio.current, generation, state.utterances).finally(() => { busy.current = false; });
    } else {
      busy.current = false;
      void start();
    }
  }

  const reset = useCallback(() => {
    hardStop();
    setAudioFailedFor(null);
    aiRef.current = { title: false, description: false };
    setAi(aiRef.current);
    lastSuggestion.current = null;
    dispatch({ type: "RESET" });
  }, [hardStop]);

  const audioFailed = audioFailedFor !== null && audioFailedFor === lastMessageId;

  return {
    state,
    level,
    seconds,
    language,
    setLanguage,
    ready: state.phase === "ready_for_review",
    muted,
    toggleMuted: () => {
      const next = !mutedRef.current;
      mutedRef.current = next;
      setMutedState(next);
      writeMuted(next);
      if (next) player.current?.stopCurrent();
    },
    replay: () => {
      if (!state.pending) return;
      getPlayer().unlock();
      speak(state.pending.kind, lastMessageId);
    },
    audioFailed,
    ai,
    reset,
    actions: {
      start: () => void start(),
      stop: () => { if (capture.current) void finish(capture.current, epoch.current); },
      cancelRecording: () => { hardStop(); dispatch({ type: "RECORDING_CANCELLED" }); },
      sendTyped,
      skip: () => dispatch({ type: "QUESTION_SKIPPED" }),
      retry: () => void retry(),
    },
  };
}

const PROGRESS_KEYS: MessageKey[] = ["intakeProgressDescribe", "intakeProgressClarify", "intakeProgressReview"];
const LEVEL_THRESHOLDS = [0.08, 0.2, 0.4, 0.6, 0.8];

export function VoiceIntake({ intake, disabled, onSwitchManual }: {
  intake: VoiceIntakeController;
  disabled: boolean;
  onSwitchManual: () => void;
}) {
  const { t } = useI18n();
  const { state } = intake;
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const supported = recordingSupported();
  const step = intakeStep(state);
  const stepIndex = step === "describe" ? 0 : step === "clarify" ? 1 : 2;
  const busyPhase = state.phase === "transcribing" || state.phase === "processing";
  const answering = state.phase === "awaiting_answer";
  const showInputs = state.phase === "idle" || state.phase === "prompting" || state.phase === "listening" || answering;

  const statusText =
    state.phase === "prompting" ? t("intakeSpeaking")
    : state.phase === "listening" ? t("intakeListening", { seconds: intake.seconds })
    : state.phase === "transcribing" ? t("intakeTranscribing")
    : state.phase === "processing" ? t("intakeThinking")
    : answering ? t("intakeAnswerHint")
    : state.phase === "ready_for_review" ? t("intakeReady")
    : state.phase === "error" ? (state.failedStep === "extract" ? t("intakeExtractError") : t(state.errorKey ?? "voiceFailure"))
    : t("intakeDescribeHint");

  function send() {
    const text = draft.trim();
    if (!text) return;
    intake.actions.sendTyped(text);
    setDraft("");
    setTyping(false);
  }

  const summary = state.extraction;
  const hasSummary = Boolean(summary && (summary.title || summary.locationText || summary.category || summary.priority));

  return (
    <section aria-label={t("intakeVoiceTitle")} className="space-y-4">
      <ol className="flex flex-wrap items-center gap-1 text-[11px] font-medium" aria-label={t("intakeModeLabel")}>
        {PROGRESS_KEYS.map((key, index) => (
          <li
            key={key}
            aria-current={index === stepIndex ? "step" : undefined}
            className={`rounded-full px-2 py-0.5 ${
              index === stepIndex ? "bg-ink-900 text-white"
              : index < stepIndex ? "bg-ink-100 text-ink-700"
              : "bg-ink-50 text-ink-400"
            }`}
          >
            {t(key)}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="intake-language" className="text-xs font-medium text-ink-600">
          {t("voiceLanguage")}
        </label>
        <Select
          id="intake-language"
          className="w-36"
          value={intake.language}
          disabled={disabled || busyPhase || state.phase === "listening" || state.phase === "prompting"}
          onChange={(event) => intake.setLanguage(event.target.value as VoiceLanguage)}
        >
          <option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="mr-IN">मराठी</option>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={intake.muted}
          aria-label={intake.muted ? t("intakeQuestionUnmute") : t("intakeQuestionMute")}
          title={intake.muted ? t("intakeQuestionUnmute") : t("intakeQuestionMute")}
          onClick={intake.toggleMuted}
          disabled={disabled}
        >
          {intake.muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
          {intake.muted ? t("intakeQuestionSpokenOff") : t("intakeQuestionSpokenOn")}
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-ink-200 bg-ink-50/60 p-3">
        {state.phase === "listening" ? (
          <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
            {LEVEL_THRESHOLDS.map((threshold, index) => (
              <span
                key={threshold}
                className={`w-1.5 rounded-sm ${intake.level >= threshold ? "bg-orange-500" : "bg-ink-200"}`}
                style={{ height: `${6 + index * 4}px` }}
              />
            ))}
          </span>
        ) : state.phase === "prompting" ? (
          <Volume2 size={16} className="animate-pulse text-orange-500" aria-hidden="true" />
        ) : busyPhase ? (
          <LoaderCircle size={16} className="animate-spin text-orange-500" aria-hidden="true" />
        ) : (
          <Mic size={16} className="text-ink-400" aria-hidden="true" />
        )}
        <p
          role={state.phase === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`text-xs leading-5 ${state.phase === "error" ? "font-medium text-red-600" : "text-ink-600"}`}
        >
          {statusText}
        </p>
      </div>

      {state.messages.length > 0 && (
        <div
          role="log"
          aria-label={t("intakeTranscript")}
          className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-ink-100 bg-white p-3"
        >
          {state.messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : undefined}>
              <p className="text-[10px] uppercase tracking-wider text-ink-400">
                {message.role === "user" ? t("intakeYou") : t("intakeAssistant")}
              </p>
              <p
                className={`inline-block whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-800"
                }`}
              >
                {message.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {answering && state.pending && (
        <div className="space-y-2 rounded-md border border-orange-200 bg-orange-50/60 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-ink-900">{questionText(state.pending.kind, intake.language)}</p>
            <Button type="button" variant="ghost" size="sm" onClick={intake.replay} disabled={disabled}>
              <RotateCcw size={14} aria-hidden="true" />{t("intakeQuestionReplay")}
            </Button>
          </div>
          {intake.audioFailed && !intake.muted && (
            <p className="text-xs leading-5 text-ink-500">{t("intakeQuestionAudioFailed")}</p>
          )}
          {state.pending.kind === "location" && (
            <p className="text-xs leading-5 text-ink-500">{t("intakeLocationNote")}</p>
          )}
        </div>
      )}

      {showInputs && (
        <div className="space-y-3">
          {!supported && state.phase === "idle" && (
            <p className="text-xs leading-5 text-ink-500">{t("voiceUnsupported")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {state.phase === "listening" ? (
              <Button type="button" variant="orange" size="sm" onClick={intake.actions.stop} disabled={disabled}>
                <Square size={14} aria-hidden="true" />{t("voiceStop")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="orange"
                size="sm"
                onClick={intake.actions.start}
                disabled={disabled || !supported || state.phase === "prompting"}
              >
                <Mic size={14} aria-hidden="true" />{answering ? t("intakeAnswerVoice") : t("intakeStart")}
              </Button>
            )}
            {(state.phase === "listening" || state.phase === "prompting") && (
              <Button type="button" variant="ghost" size="sm" onClick={intake.actions.cancelRecording} disabled={disabled}>
                {t("voiceCancel")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTyping((value) => !value)}
              disabled={disabled || busyPhase || state.phase === "prompting"}
            >
              {t("intakeTypeInstead")}
            </Button>
            {answering && (
              <Button type="button" variant="ghost" size="sm" onClick={intake.actions.skip} disabled={disabled}>
                <SkipForward size={14} aria-hidden="true" />
                {state.pending?.optional ? t("intakeSkip") : t("intakeSkipToReview")}
              </Button>
            )}
          </div>
          {typing && (
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("intakeTypePlaceholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={send} disabled={disabled || !draft.trim()}>
                <Send size={14} aria-hidden="true" />{t("intakeSend")}
              </Button>
            </div>
          )}
        </div>
      )}

      {state.phase === "error" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={intake.actions.retry} disabled={disabled}>
              {t("intakeRetry")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={intake.reset} disabled={disabled}>
              {t("intakeCancel")}
            </Button>
          </div>
        </div>
      )}

      {hasSummary && summary && (
        <div className="rounded-md border border-ink-100 bg-white p-3">
          <p className="text-xs font-semibold text-ink-700">{t("intakeSummaryTitle")}</p>
          <dl className="mt-2 space-y-1 text-xs leading-5 text-ink-600">
            {summary.title && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-400">{t("intakeSummaryIssue")}</dt>
                <dd>{summary.title}</dd>
              </div>
            )}
            {summary.locationText && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-400">{t("intakeSummaryLocation")}</dt>
                <dd>{summary.locationText}</dd>
              </div>
            )}
            {summary.category && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-400">{t("intakeSummaryCategory")}</dt>
                <dd className="capitalize">{summary.category}</dd>
              </div>
            )}
            {summary.priority && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-400">{t("intakeSummaryPriority")}</dt>
                <dd className="capitalize">{summary.priority}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={intake.reset} disabled={disabled}>
          {t("intakeCancel")}
        </Button>
        <span className="text-[11px] text-ink-400">{t("intakeCancelNote")}</span>
        <span className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={onSwitchManual} disabled={disabled}>
          {t("intakeSwitchManual")}
        </Button>
      </div>
    </section>
  );
}

export function IntakeModeToggle({ value, onChange, disabled = false }: {
  value: "voice" | "manual";
  onChange: (mode: "voice" | "manual") => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const MODES = [
    { mode: "voice" as const, title: t("intakeVoiceTitle"), hint: t("intakeVoiceHint") },
    { mode: "manual" as const, title: t("intakeManualTitle"), hint: t("intakeManualHint") },
  ];
  return (
    <div role="radiogroup" aria-label={t("intakeModeLabel")} className="grid gap-3 sm:grid-cols-2">
      {MODES.map((option) => {
        const selected = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.mode)}
            className={`rounded-lg border p-4 text-left transition ${
              selected
                ? option.mode === "voice"
                  ? "border-orange-400 bg-orange-50/70 ring-1 ring-orange-300"
                  : "border-ink-400 bg-ink-50 ring-1 ring-ink-300"
                : "border-ink-200 bg-white hover:border-ink-300"
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-900">
              {option.title}
              <span
                aria-hidden="true"
                className={`inline-block h-3 w-3 rounded-full border ${
                  selected ? "border-orange-500 bg-orange-500" : "border-ink-300 bg-white"
                }`}
              />
            </span>
            <span className="mt-1 block text-xs leading-5 text-ink-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
