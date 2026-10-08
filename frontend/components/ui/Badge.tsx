"use client";

import { clsx } from "clsx";
import { useI18n, type MessageKey } from "@/lib/i18n";

type Tone = "blue" | "dark" | "grey" | "outline" | "emerald" | "amber" | "rose";

const tones: Record<Tone, string> = {
  blue: "bg-primary-50 text-primary-700 border border-primary-200/70",
  dark: "bg-ink-900 text-white border border-ink-900",
  grey: "bg-ink-100 text-ink-700 border border-ink-200/60",
  outline: "border border-ink-200 text-ink-700 bg-white shadow-2xs",
  emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
  amber: "bg-amber-50 text-amber-700 border border-amber-200/70",
  rose: "bg-rose-50 text-rose-700 border border-rose-200/70",
};

export function Badge({
  tone = "grey",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useI18n();
  const p = priority.toLowerCase();
  if (p === "high") return <Badge tone="rose">{t("priorityHigh")}</Badge>;
  if (p === "medium") return <Badge tone="amber">{t("priorityMedium")}</Badge>;
  return <Badge tone="grey">{t("priorityLow")}</Badge>;
}

const STATUS_KEYS: Record<string, MessageKey> = {
  submitted: "statusSubmitted",
  open: "statusOpen",
  triaged: "statusTriaged",
  pending_assignment: "statusPendingAssignment",
  ai_processing: "statusAiProcessing",
  assigned: "statusAssigned",
  in_progress: "statusInProgress",
  blocked: "statusBlocked",
  escalated: "statusEscalated",
  under_review: "statusUnderReview",
  resolution_submitted: "statusResolutionSubmitted",
  resolved: "statusResolved",
  closed: "statusClosed",
  rejected: "statusRejected",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const s = status.toLowerCase();
  const key = STATUS_KEYS[s];
  const label = key ? t(key) : status.replace("_", " ");
  if (s === "resolved" || s === "closed")
    return <Badge tone="emerald">{label}</Badge>;
  if (s === "open" || s === "submitted") return <Badge tone="blue">{label}</Badge>;
  if (s === "in_progress" || s === "assigned")
    return <Badge tone="amber">{label}</Badge>;
  return <Badge tone="outline">{label}</Badge>;
}
