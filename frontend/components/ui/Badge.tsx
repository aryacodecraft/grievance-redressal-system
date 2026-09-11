import { clsx } from "clsx";

type Tone = "blue" | "dark" | "grey" | "outline";

const tones: Record<Tone, string> = {
  blue: "bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200",
  dark: "bg-ink-900 text-white dark:bg-white dark:text-ink-900",
  grey: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
  outline:
    "border border-ink-300 text-ink-700 dark:border-ink-700 dark:text-ink-300",
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
  if (p === "high") return <Badge tone="dark">High priority</Badge>;
  if (p === "medium") return <Badge tone="blue">Medium priority</Badge>;
  return <Badge tone="grey">Low priority</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "resolved" || s === "closed")
    return <Badge tone="dark">{status}</Badge>;
  if (s === "open" || s === "submitted")
    return <Badge tone="blue">{status}</Badge>;
  return <Badge tone="outline">{status}</Badge>;
}
