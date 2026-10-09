import Link from "next/link";
import { MapPin, Mail, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n, type MessageKey } from "@/lib/i18n";

const quickLinks: { href: string; key: MessageKey }[] = [
  { href: "/", key: "home" },
  { href: "/submit", key: "register" },
  { href: "/track", key: "track" },
  { href: "/login", key: "signIn" },
  { href: "/register", key: "createAccount" },
];

const citizenServices: MessageKey[] = [
  "svcRegister",
  "svcTrack",
  "svcAssign",
  "svcAi",
];

const contact: { Icon: LucideIcon; key?: MessageKey; text?: string }[] = [
  { Icon: MapPin, key: "contactLocation" },
  { Icon: Mail, text: "support@grievai.example" },
];

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-ink-100 bg-white">
      {/* Trust bar */}
      <div className="border-b border-ink-100 bg-ink-50/50">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
            <ShieldCheck size={14} className="text-primary-700" />
            {t("footerTrustRecords")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
            <MapPin size={14} className="text-primary-700" />
            {t("footerTrustLocal")}
          </span>
          <span className="text-[11px] font-semibold text-ink-600">
            {t("footerTrustPrototype")}
          </span>
        </div>
      </div>

      {/* Main footer columns */}
      <div className="grid gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        {/* Brand */}
        <div className="lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary-700 text-xs font-bold text-white">
              G
            </span>
            <p className="text-sm font-bold text-ink-900">
              GrievAI
            </p>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
            {t("footerAbout")}
          </p>
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            {t("footerQuickLinks")}
          </p>
          <ul className="mt-3 space-y-2 text-xs text-ink-500">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-primary-700 hover:underline"
                >
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Citizen services */}
        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            {t("footerServicesHeading")}
          </p>
          <ul className="mt-3 space-y-2 text-xs text-ink-500">
            {citizenServices.map((key) => (
              <li key={key} className="transition-colors hover:text-ink-800">
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            {t("footerContactHeading")}
          </p>
          <ul className="mt-3 space-y-2.5 text-xs text-ink-500">
            {contact.map(({ Icon, key, text }) => (
              <li key={key ?? text} className="flex items-start gap-2">
                <Icon size={13} className="mt-0.5 flex-shrink-0 text-primary-700" />
                <span className="leading-relaxed">
                  {key ? t(key) : text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Governance note */}
      <div className="border-t border-ink-100 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <p className="text-[11px] leading-relaxed text-ink-400">
          <span className="font-semibold uppercase tracking-wider text-ink-600">
            {t("accountabilityLabel")}
          </span>{" "}
          {t("accountabilityText")}
        </p>
      </div>

      {/* Copyright */}
      <div className="border-t border-ink-100 py-4 bg-white">
        <p className="px-4 text-xs text-ink-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {t("copyright")}
        </p>
      </div>
    </footer>
  );
}
