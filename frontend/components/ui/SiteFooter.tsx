import Link from "next/link";
import {
  MapPin,
  Mail,
  ShieldCheck,
} from "lucide-react";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/submit", label: "Register Complaint" },
  { href: "/track", label: "Track Status" },
  { href: "/login", label: "Sign In" },
  { href: "/register", label: "Create Account" },
];

const citizenServices = [
  "Register a public grievance",
  "Track grievance status & timeline",
  "Officer assignment & resolution",
  "AI-assisted categorization",
];

const contact = [
  { Icon: MapPin, text: "Location-aware civic issue reporting" },
  { Icon: Mail, text: "support@grievai.example" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      {/* Trust bar */}
      <div className="border-b border-ink-100 bg-ink-50/50">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
            <ShieldCheck size={14} className="text-primary-600" />
            Audited &amp; tamper-evident records
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
            <MapPin size={14} className="text-primary-600" />
            Built for local civic workflows
          </span>
          <span className="text-[11px] font-semibold text-ink-600">
            Academic research prototype
          </span>
        </div>
      </div>

      {/* Main footer columns */}
      <div className="grid gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        {/* Brand */}
        <div className="lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary-600 text-xs font-bold text-white">
              G
            </span>
            <p className="text-sm font-bold text-ink-900">
              GrievAI
            </p>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
            AI-assisted grievance redressal and decision-support prototype for transparent civic workflows.
          </p>
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Quick Links
          </p>
          <ul className="mt-3 space-y-2 text-xs text-ink-500">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-primary-700 hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Citizen services */}
        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Citizen Services
          </p>
          <ul className="mt-3 space-y-2 text-xs text-ink-500">
            {citizenServices.map((s) => (
              <li key={s} className="transition-colors hover:text-ink-800">
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Contact &amp; Support
          </p>
          <ul className="mt-3 space-y-2.5 text-xs text-ink-500">
            {contact.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-2">
                <Icon size={13} className="mt-0.5 flex-shrink-0 text-primary-600" />
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Governance note */}
      <div className="border-t border-ink-100 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <p className="text-[11px] leading-relaxed text-ink-400">
          <span className="font-semibold uppercase tracking-wider text-ink-600">
            Accountability:
          </span>{" "}
          Department actions and status transitions are recorded for accountable human review.
        </p>
      </div>

      {/* Copyright */}
      <div className="border-t border-ink-100 py-4 bg-white">
        <p className="px-4 text-xs text-ink-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} GrievAI — Civic grievance redressal prototype.
        </p>
      </div>
    </footer>
  );
}
