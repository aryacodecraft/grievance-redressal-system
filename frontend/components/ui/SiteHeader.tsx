"use client";

import Link from "next/link";
import { useDemoUser } from "@/lib/session";

const links = [
  { href: "/", label: "Home" },
  { href: "/submit", label: "Register Complaint" },
  { href: "/track", label: "Track Status" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const { user, signOut } = useDemoUser();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 font-bold text-white shadow-xs transition-transform group-hover:scale-105"
          >
            G
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-ink-950">
              GrievAI
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              National Grievance Portal
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-950"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <span className="hidden max-w-40 truncate text-xs font-medium text-ink-500 sm:block">
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950 sm:block"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/submit"
            className="rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-primary-700 hover:shadow-sm active:scale-[0.98]"
          >
            File Grievance
          </Link>
        </div>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-t border-ink-100 px-4 py-1.5 md:hidden"
        aria-label="Primary mobile"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-950"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
