import type { ReactNode } from "react";
import { clsx } from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-ink-200/80 bg-white shadow-xs transition-shadow duration-200 hover:shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4.5">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs font-normal text-ink-500">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("px-6 py-5", className)}>{children}</div>;
}
