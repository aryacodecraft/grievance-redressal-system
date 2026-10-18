/** Conversational intake domain logic: pure, DOM-free, unit-testable.
 *
 * VoiceIntake (the component) performs side effects — recording, STT, LLM
 * extraction — and dispatches actions here. The reducer enforces legal
 * transitions, so concurrent transcriptions, question loops and invalid
 * states are impossible by construction rather than by ad-hoc booleans.
 */

import type { MessageKey } from "@/lib/i18n";

export type IntakePhase =
  | "idle"
  | "listening"
  | "transcribing"
  | "processing"
  | "awaiting_answer"
  | "ready_for_review"
  | "error";

export type IntakeField = "title" | "description";

export interface IntakeMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

/** Normalized extraction (camelCase form of the /grievance-intake/extract reply). */
export interface IntakeExtraction {
  title: string | null;
  description: string | null;
  locationText: string | null;
  category: string | null;
  priority: "low" | "medium" | "high" | null;
  question: string | null;
}

/** Structural shape of the raw API response — kept here so this module stays
 *  dependency-free (api.ts zod-validates the same shape). */
export interface IntakeExtractionResponse {
  title: string | null;
  description: string | null;
  location_text: string | null;
  category: string | null;
  priority: "low" | "medium" | "high" | null;
  question: string | null;
}

export function toExtraction(raw: IntakeExtractionResponse): IntakeExtraction {
  return {
    title: raw.title,
    description: raw.description,
    locationText: raw.location_text,
    category: raw.category,
    priority: raw.priority,
    question: raw.question,
  };
}

export type IntakeQuestionKind = "details" | "location" | "clarify";

export interface IntakeQuestion {
  kind: IntakeQuestionKind;
  /** Optional questions may be skipped; required ones only via "skip to review". */
  optional: boolean;
  /** Display text. Model-authored for "clarify"; null → component resolves
   *  the localized template via questionTemplateKey(). */
  text: string | null;
}

/** A question with its display text resolved (what the reducer stores). */
export type PlannedQuestion = IntakeQuestion & { text: string };

export interface IntakeState {
  phase: IntakePhase;
  /** Where to return when a recording is abandoned mid-flight. */
  resume: IntakePhase;
  failedStep: "transcribe" | "extract" | null;
  errorKey: MessageKey | null;
  messages: IntakeMessage[];
  /** Everything the citizen said, in order — the extraction context. */
  utterances: string[];
  /** Question texts already asked (advisory context for the LLM). */
  asked: string[];
  pending: PlannedQuestion | null;
  detailsAsked: boolean;
  locationAsked: boolean;
  clarifyAsked: boolean;
  extraction: IntakeExtraction | null;
}

export const initialIntakeState: IntakeState = {
  phase: "idle",
  resume: "idle",
  failedStep: null,
  errorKey: null,
  messages: [],
  utterances: [],
  asked: [],
  pending: null,
  detailsAsked: false,
  locationAsked: false,
  clarifyAsked: false,
  extraction: null,
};

export type IntakeAction =
  | { type: "START" }
  | { type: "RECORDING_STOPPED" }
  | { type: "RECORDING_CANCELLED" }
  | { type: "UTTERANCE_ADDED"; text: string }
  | { type: "EXTRACTED"; extraction: IntakeExtraction; plan: PlannedQuestion | null }
  | { type: "QUESTION_SKIPPED" }
  | { type: "FAILED"; step: "transcribe" | "extract"; errorKey: MessageKey }
  | { type: "RETRY" }
  | { type: "RESET" };

/** Phases each action may fire from — everything else is a no-op. */
const ALLOWED: Record<IntakeAction["type"], IntakePhase[]> = {
  START: ["idle", "awaiting_answer", "error"],
  RECORDING_STOPPED: ["listening"],
  RECORDING_CANCELLED: ["listening"],
  UTTERANCE_ADDED: ["idle", "transcribing", "awaiting_answer", "error"],
  EXTRACTED: ["processing"],
  QUESTION_SKIPPED: ["awaiting_answer"],
  FAILED: ["listening", "transcribing", "processing", "awaiting_answer"],
  RETRY: ["error"],
  RESET: ["idle", "listening", "transcribing", "processing", "awaiting_answer", "ready_for_review", "error"],
};

function nextMessageId(state: IntakeState): number {
  return state.messages.reduce((max, message) => Math.max(max, message.id), 0) + 1;
}

export function intakeReducer(state: IntakeState, action: IntakeAction): IntakeState {
  if (!ALLOWED[action.type].includes(state.phase)) return state;

  switch (action.type) {
    case "START":
      return { ...state, phase: "listening", resume: state.phase, errorKey: null, failedStep: null };
    case "RECORDING_STOPPED":
      return { ...state, phase: "transcribing" };
    case "RECORDING_CANCELLED":
      return { ...state, phase: state.resume === "listening" ? "idle" : state.resume };
    case "UTTERANCE_ADDED": {
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state,
        phase: "processing",
        messages: [...state.messages, { id: nextMessageId(state), role: "user", text }],
        utterances: [...state.utterances, text],
      };
    }
    case "EXTRACTED": {
      const redundant = action.plan !== null && (
        (action.plan.kind === "details" && state.detailsAsked)
        || (action.plan.kind === "location" && state.locationAsked)
        || (action.plan.kind === "clarify" && state.clarifyAsked)
      );
      const plan = redundant ? null : action.plan;
      if (!plan) {
        return { ...state, extraction: action.extraction, pending: null, phase: "ready_for_review" };
      }
      return {
        ...state,
        extraction: action.extraction,
        pending: plan,
        phase: "awaiting_answer",
        messages: [...state.messages, { id: nextMessageId(state), role: "assistant", text: plan.text }],
        asked: [...state.asked, plan.text],
        detailsAsked: state.detailsAsked || plan.kind === "details",
        locationAsked: state.locationAsked || plan.kind === "location",
        clarifyAsked: state.clarifyAsked || plan.kind === "clarify",
      };
    }
    case "QUESTION_SKIPPED":
      return { ...state, pending: null, phase: "ready_for_review" };
    case "FAILED":
      return { ...state, phase: "error", failedStep: action.step, errorKey: action.errorKey };
    case "RETRY":
      return {
        ...state,
        failedStep: state.failedStep,
        phase: state.failedStep === "transcribe" ? "transcribing" : "processing",
        errorKey: null,
      };
    case "RESET":
      return { ...initialIntakeState };
  }
}

/** Minimum description length worth entering review with (mirrors the form schema). */
export const INTAKE_DESCRIPTION_MIN = 20;

/** Deterministic question policy: ask only what is actually missing, at most
 *  once per kind, and stop asking as soon as the complaint is complete.
 *  Returns null when the intake should move on to review. */
export function planNextStep(input: {
  extraction: IntakeExtraction;
  description: string;
  hasCoords: boolean;
  detailsAsked: boolean;
  locationAsked: boolean;
  clarifyAsked: boolean;
}): IntakeQuestion | null {
  const descriptionOk = input.description.trim().length >= INTAKE_DESCRIPTION_MIN;
  if (!descriptionOk && !input.detailsAsked) {
    return { kind: "details", optional: false, text: null };
  }
  if (!input.hasCoords && !input.locationAsked) {
    return { kind: "location", optional: false, text: null };
  }
  if (descriptionOk && input.extraction.question && !input.clarifyAsked) {
    return { kind: "clarify", optional: true, text: input.extraction.question };
  }
  return null;
}

export function questionTemplateKey(kind: IntakeQuestionKind): MessageKey {
  if (kind === "location") return "intakeQuestionLocation";
  if (kind === "details") return "intakeQuestionDetails";
  return "intakeQuestionClarify";
}

/** A field is AI-writable only while the citizen has neither edited it nor
 *  filled it themselves; user edits are preserved across re-extractions. */
export function computeLocks(input: {
  values: { title: string; description: string };
  dirty: { title: boolean; description: boolean };
  ai: { title: boolean; description: boolean };
}): { title: boolean; description: boolean } {
  return {
    title: input.dirty.title || (input.values.title.trim() !== "" && !input.ai.title),
    description: input.dirty.description || (input.values.description.trim() !== "" && !input.ai.description),
  };
}

export interface MergeResult {
  values: { title: string; description: string };
  changed: { field: IntakeField; value: string }[];
  ai: { title: boolean; description: boolean };
}

/** Apply a validated extraction to the draft, skipping locked fields.
 *  Pure: the caller writes `changed` back into the form store. */
export function mergeExtraction(input: {
  current: { title: string; description: string };
  locks: { title: boolean; description: boolean };
  ai: { title: boolean; description: boolean };
  extraction: IntakeExtraction;
}): MergeResult {
  const values = { ...input.current };
  const changed: MergeResult["changed"] = [];
  const ai = { ...input.ai };
  for (const field of ["title", "description"] as const) {
    const candidate = field === "title" ? input.extraction.title : input.extraction.description;
    if (!candidate || input.locks[field]) continue;
    if (values[field] === candidate) {
      ai[field] = true;
      continue;
    }
    values[field] = candidate;
    ai[field] = true;
    changed.push({ field, value: candidate });
  }
  return { values, changed, ai };
}

export type IntakeStep = "describe" | "clarify" | "review";

/** Progress indicator mapping. "submit" is surfaced by the submit flow itself. */
export function intakeStep(state: IntakeState): IntakeStep {
  if (state.phase === "ready_for_review") return "review";
  if (state.phase === "awaiting_answer") return "clarify";
  if (state.phase === "error" && state.messages.length > 0) return "clarify";
  return "describe";
}
