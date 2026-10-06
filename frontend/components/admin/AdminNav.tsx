"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, LineChart, ShieldCheck } from "lucide-react";
import { useDemoUser } from "@/lib/session";

const TABS = [
  { href: "/admin", label: "Grievance Queue", Icon: LayoutList },
  { href: "/admin/analytics", label: "Executive Analytics", Icon: LineChart },
];

/** Top sub-tab navigation shared by the admin queue and analytics pages. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-b border-ink-200/80 bg-white px-4 sm:px-6 lg:px-8"
      aria-label="Admin sections"
    >
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary-600 text-primary-800"
                  : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800"
              }`}
            >
              <Icon size={15} className={active ? "text-primary-600" : "text-ink-400"} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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
            Signed in as: <strong className="font-medium text-ink-800">{user.email}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
