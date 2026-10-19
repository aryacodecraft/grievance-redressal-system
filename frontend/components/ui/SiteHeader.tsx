"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoUser } from "@/lib/session";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { Bell, Menu, X } from "lucide-react";
import { NotificationBadgeLink } from "@/components/notifications/NotificationBadgeLink";

/**
 * Top header for citizens and logged-out visitors. Staff accounts skip it
 * entirely and get the sticky left sidebar instead — see AppShell.
 */
const links = [
  { href: "/", label: "Home" },
  { href: "/submit", label: "Register Grievance" },
  { href: "/track", label: "Track Grievance" },
];

export function SiteHeader() {
  const { user, signOut } = useDemoUser();
  const { language, setLanguage, t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const linkIsActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="relative sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center flex-1 min-w-0">
          <Link href="/" className="flex items-center gap-2 group truncate">
            <span className="text-base font-extrabold tracking-tight text-ink-950">
              SAMARTH
            </span>
            <span className="hidden text-xs font-semibold text-ink-500 sm:inline">
              &mdash; National Grievance Portal
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex shrink-0" aria-label="Primary">
          {[...links, ...(user ? [{ href: "/profile", label: "Profile" }] : [])].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={linkIsActive(l.href) ? "page" : undefined}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors hover:bg-ink-100/70 hover:text-ink-950 ${linkIsActive(l.href) ? "bg-primary-50 text-primary-700" : "text-ink-600"}`}
            >
              {l.href === "/" ? t("home") : l.href === "/submit" ? t("register") : l.href === "/track" ? t("track") : t("profile")}
            </Link>
          ))}
        </nav>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center justify-end gap-2 flex-1 min-w-0">
          <label className="sr-only" htmlFor="language-select">{t("language")}</label>
          <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className="h-8 rounded-md border border-ink-200 bg-white px-2 text-xs font-semibold text-ink-700 shadow-2xs focus:border-primary-700 focus:outline-none">
            {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          {user ? (
            <>
              <NotificationBadgeLink Icon={Bell} compact className="rounded p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-950" />
              <div className="hidden items-center gap-1.5 sm:flex">
                <span className="max-w-40 truncate text-xs font-medium text-ink-600">
                  {user.email || user.citizen_id || user.name}
                </span>
                <span className="rounded-sm bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-700 border border-primary-200">
                  Citizen
                </span>
              </div>
              <button
                onClick={signOut}
                className="rounded-sm px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
              >
              {t("signOut")}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-sm px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
            >
              {t("signIn")}
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <NotificationBadgeLink
              Icon={Bell}
              compact
              className="rounded p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-950"
            />
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="inline-flex items-center justify-center rounded-md p-2 text-ink-700 hover:bg-ink-100 hover:text-ink-950 focus:outline-none"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-ink-200 bg-white px-4 pt-3 pb-5 shadow-lg md:hidden animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            {[...links, ...(user ? [{ href: "/profile", label: "Profile" }] : [])].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={linkIsActive(l.href) ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  linkIsActive(l.href)
                    ? "bg-primary-50 text-primary-700"
                    : "text-ink-700 hover:bg-ink-100/70 hover:text-ink-950"
                }`}
              >
                {l.href === "/"
                  ? t("home")
                  : l.href === "/submit"
                    ? t("register")
                    : l.href === "/track"
                      ? t("track")
                      : t("profile")}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-ink-100 pt-4 space-y-3">
            {/* Language Selector */}
            <div className="flex items-center justify-between">
              <label htmlFor="mobile-language-select" className="text-xs font-semibold text-ink-600">
                {t("language")}
              </label>
              <select
                id="mobile-language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value as typeof language)}
                className="h-8 rounded-md border border-ink-200 bg-white px-2 text-xs font-semibold text-ink-700 shadow-2xs focus:border-primary-700 focus:outline-none"
              >
                {LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* User Session & Authentication Actions */}
            {user ? (
              <div className="rounded-md bg-ink-50 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium text-ink-700">
                    {user.email || user.citizen_id || user.name}
                  </span>
                  <span className="rounded-sm bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-700 border border-primary-200">
                    Citizen
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full rounded-md border border-ink-300 bg-white py-2 text-xs font-semibold text-ink-700 shadow-2xs transition hover:bg-ink-100 active:bg-ink-200"
                >
                  {t("signOut")}
                </button>
              </div>
            ) : (
              <div className="pt-1">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-md bg-ink-950 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-ink-800"
                >
                  {t("signIn")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
