import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "orange" | "secondary" | "outline" | "ghost" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  /* Main CTAs are solid black; orange carries the accent elsewhere. */
  primary:
    "bg-ink-950 text-white shadow-xs hover:bg-ink-800 active:bg-ink-950 focus-visible:ring-ink-500",
  orange:
    "bg-primary-700 text-white shadow-xs hover:bg-primary-800 active:bg-primary-900 focus-visible:ring-primary-700",
  secondary:
    "bg-ink-100 text-ink-800 hover:bg-ink-200/80 active:bg-ink-200 focus-visible:ring-ink-400",
  outline:
    "border border-ink-200 bg-white text-ink-800 shadow-2xs hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100 focus-visible:ring-primary-700",
  ghost:
    "text-primary-700 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-700",
  dark: "bg-ink-900 text-white shadow-xs hover:bg-ink-800 active:bg-ink-950 focus-visible:ring-ink-500",
};

const sizes: Record<Size, string> = {
  sm: "h-8.5 px-3 text-xs font-medium",
  md: "h-10 px-4 text-sm font-medium",
  lg: "h-11 px-5 text-sm font-semibold",
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
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
