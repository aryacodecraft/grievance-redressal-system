"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";

export type DescriptionAction = "append" | "replace" | "cancel";
export function TranscriptionChoice({ changed, signal, resolve, onChoice }: {
  changed: boolean; signal: AbortSignal;
  resolve: (action: DescriptionAction) => void;
  onChoice: (action: DescriptionAction) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const lifecycle = useRef({ generation: 0 });
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const lifecycleState = lifecycle.current;
    const generation = ++lifecycleState.generation;
    const element = dialog.current;
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    element?.showModal();
    cancel.current?.focus();
    const abort = () => onChoice("cancel");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    return () => {
      signal.removeEventListener("abort", abort);
      // Strict Mode immediately replays setup after cleanup. Cancel only if
      // this effect was genuinely removed, not replayed on the same dialog.
      queueMicrotask(() => {
        if (lifecycleState.generation !== generation) return;
        element?.close(); resolve("cancel");
        // Wait for recorder state to re-enable the opener after acceptance.
        window.setTimeout(() => {
          const trigger = opener.current;
          if (!trigger?.isConnected) return;
          // Accepted pre-upload choices disable Transcribe while the request
          // runs. Return to the editable description rather than losing focus.
          const target = trigger.matches(":disabled") ? trigger.closest("form")?.querySelector("textarea") : trigger;
          target?.focus();
        }, 0);
      });
    };
  }, [signal, resolve, onChoice]);
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); onChoice("cancel"); }}
    className="max-w-lg space-y-4 rounded-md border border-ink-200 p-6 backdrop:bg-black/40">
    <h3 id={`${id}-title`} className="font-semibold">{t("voiceChooseDescription")}</h3>
    <p id={`${id}-hint`}>{t(changed ? "voiceChooseChanged" : "voiceChooseBefore")}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => onChoice("append")}>{t("voiceAppend")}</Button>
      <Button type="button" variant="outline" onClick={() => onChoice("replace")}>{t("voiceReplace")}</Button>
      <button ref={cancel} type="button" onClick={() => onChoice("cancel")}
        className="rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">{t("voiceCancel")}</button>
    </div>
  </dialog>;
}
