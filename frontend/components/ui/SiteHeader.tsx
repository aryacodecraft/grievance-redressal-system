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
    <header className="border-b border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-700 text-lg font-bold text-white"
          >
            G
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-ink-900 dark:text-white">
              GrievAI
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
              National Grievance Redressal Portal
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-40 truncate text-sm text-ink-500 sm:block dark:text-ink-400">
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="rounded-md px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-ink-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 sm:block dark:text-primary-300 dark:hover:bg-ink-800"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/submit"
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            File a Grievance
          </Link>
        </div>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-t border-ink-100 px-4 py-1 md:hidden dark:border-ink-800"
        aria-label="Primary mobile"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
