import type { MessageKey } from "@/lib/i18n";

/** Map capture/transcription/extraction failures onto citizen-facing copy.
 *  Shared by the conversational intake and the manual-mode error surfaces so
 *  every voice failure is explained with the same wording. */
export function voiceErrorMessage(error: unknown): MessageKey {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "voicePermission";
    if (error.name === "NotFoundError") return "voiceNoDevice";
    if (error.name === "NotReadableError" || error.name === "OverconstrainedError") return "voiceDeviceError";
    if (error.name === "AbortError") return "voiceTimeout";
    if (["voiceUnsupported", "voiceEmpty", "voiceDeviceError"].includes(error.message)) return error.message as MessageKey;
  }
  const status = (error as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return "voiceAuth";
  if (status === 503) return "voiceUnavailable";
  if (status === 429) return "voiceRateLimit";
  if (status === 409) return "voiceConflict";
  if (status === 408 || status === 504) return "voiceTimeout";
  return "voiceFailure";
}

/** Idempotency key for /transcribe and intake retries (randomUUID + fallback). */
export function newIdempotencyKey(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
}
