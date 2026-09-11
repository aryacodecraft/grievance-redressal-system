import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { clsx } from "clsx";

const controlClass =
  "w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 " +
  "focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100 " +
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 " +
  "dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100 dark:focus:ring-primary-900";

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
      <span className="mb-1 block text-sm font-medium text-ink-800 dark:text-ink-200">
        {label}
        {required && <span className="text-primary-600"> *</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-xs font-medium text-ink-900 dark:text-white">
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
