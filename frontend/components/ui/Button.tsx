import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-700 text-white hover:bg-primary-800 focus-visible:ring-primary-500",
  secondary:
    "bg-ink-100 text-ink-900 hover:bg-ink-200 focus-visible:ring-ink-400 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700",
  outline:
    "border border-ink-300 bg-white text-ink-900 hover:border-primary-600 hover:text-primary-700 focus-visible:ring-primary-500 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100",
  ghost:
    "text-primary-700 hover:bg-primary-50 focus-visible:ring-primary-500 dark:text-primary-300 dark:hover:bg-ink-800",
  dark: "bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-ink-500 dark:bg-white dark:text-ink-900",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
