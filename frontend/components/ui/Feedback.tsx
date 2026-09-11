import type { ReactNode } from "react";
import { clsx } from "clsx";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 py-10 text-xs font-medium text-ink-500"
    >
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-primary-600"
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
    <div className="rounded-xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink-900">
        {title}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-ink-500">{hint}</p>
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
        "rounded-xl border px-4 py-3 text-xs leading-relaxed transition-all",
        tone === "info" &&
          "border-primary-200/80 bg-primary-50/70 text-primary-900 font-medium",
        tone === "error" &&
          "border-rose-200 bg-rose-50 text-rose-900 font-medium"
      )}
    >
      {children}
    </div>
  );
}
