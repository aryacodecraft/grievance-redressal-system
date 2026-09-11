import { clsx } from "clsx";

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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  if (p === "high") return <Badge tone="rose">High priority</Badge>;
  if (p === "medium") return <Badge tone="amber">Medium priority</Badge>;
  return <Badge tone="grey">Low priority</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "resolved" || s === "closed")
    return <Badge tone="emerald">{status}</Badge>;
  if (s === "open" || s === "submitted")
    return <Badge tone="blue">{status}</Badge>;
  if (s === "in_progress" || s === "assigned")
    return <Badge tone="amber">{status.replace("_", " ")}</Badge>;
  return <Badge tone="outline">{status}</Badge>;
}
