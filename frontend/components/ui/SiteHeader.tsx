"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoUser } from "@/lib/session";

/**
 * Top header for citizens and logged-out visitors. Staff accounts skip it
 * entirely and get the sticky left sidebar instead — see AppShell.
 */
const links = [
  { href: "/", label: "Home" },
  { href: "/submit", label: "Register Complaint" },
  { href: "/track", label: "Track Status" },
];

export function SiteHeader() {
  const { user, signOut } = useDemoUser();
  const pathname = usePathname();

  const linkIsActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 group">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary-600 font-bold text-white shadow-xs transition-transform group-hover:scale-105"
          >
            G
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-ink-950">
              GrievAI
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-ink-500 sm:block">
              National Grievance Portal
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={linkIsActive(l.href) ? "page" : undefined}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors hover:bg-ink-100/70 hover:text-ink-950 ${linkIsActive(l.href) ? "bg-primary-50 text-primary-700" : "text-ink-600"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden items-center gap-1.5 sm:flex">
                <span className="max-w-40 truncate text-xs font-medium text-ink-600">
                  {user.email}
                </span>
                <span className="rounded-sm bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-700 border border-primary-200">
                  Citizen
                </span>
              </div>
              <button
                onClick={signOut}
                className="rounded-sm px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-sm px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      <nav
        className="flex gap-0.5 overflow-x-auto border-t border-ink-100 px-4 py-1 md:hidden"
        aria-label="Primary mobile"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={linkIsActive(l.href) ? "page" : undefined}
            className={`whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium hover:bg-ink-100 hover:text-ink-950 ${linkIsActive(l.href) ? "bg-primary-50 text-primary-700" : "text-ink-600"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
