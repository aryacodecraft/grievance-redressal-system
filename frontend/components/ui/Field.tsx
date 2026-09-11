import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { clsx } from "clsx";

const controlClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-900 placeholder:text-ink-400 " +
  "shadow-2xs transition-all duration-150 " +
  "hover:border-ink-300 " +
  "focus:border-primary-600 focus:outline-none focus:ring-3 focus:ring-primary-500/15 " +
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-700">
        {label}
        {required && <span className="text-primary-600"> *</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1.5 block text-xs text-ink-500">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1.5 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx("h-10", controlClass, props.className)}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(controlClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx("h-10", controlClass, props.className)}
    />
  );
}
