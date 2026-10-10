"use client";

import { ShieldCheck } from "lucide-react";
import { useDemoUser } from "@/lib/session";

/** Shared admin page header (title, subtitle, signed-in identity). */
export function AdminHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { user } = useDemoUser();

  return (
    <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink-950">{title}</h1>
            <span className="inline-flex items-center gap-1 rounded-sm bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-800 border border-primary-200">
              <ShieldCheck size={12} />
              Admin
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
        </div>
        {user && (
          <span className="text-xs text-ink-500">
            Signed in as: <strong className="font-medium text-ink-800">{user.email || user.citizen_id || user.name}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
