import type { ReactNode } from "react";
import { clsx } from "clsx";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-8 text-sm text-ink-500 dark:text-ink-400"
    >
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-ink-300 border-t-primary-600"
      />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center dark:border-ink-700">
      <p className="text-sm font-medium text-ink-800 dark:text-ink-200">
        {title}
      </p>
      {hint && (
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{hint}</p>
      )}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-md border px-4 py-3 text-sm",
        tone === "info" &&
          "border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-200",
        tone === "error" &&
          "border-ink-800 bg-ink-900 text-white dark:border-ink-200 dark:bg-ink-100 dark:text-ink-900"
      )}
    >
      {children}
    </div>
  );
}
