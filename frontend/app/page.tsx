import Link from "next/link";
import {
  Droplets,
  Construction,
  Zap,
  Trash2,
  HeartPulse,
  Landmark,
  FolderOpen,
  FileText,
  BrainCircuit,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { LucideIcon } from "lucide-react";

const steps: { n: string; title: string; text: string; Icon: LucideIcon }[] = [
  {
    n: "01",
    Icon: FileText,
    title: "Register your grievance",
    text: "Describe the issue, attach a photo, and pin the location. It takes less than two minutes.",
  },
  {
    n: "02",
    Icon: BrainCircuit,
    title: "AI-assisted triage",
    text: "The system suggests a category and priority so your report reaches the right desk faster.",
  },
  {
    n: "03",
    Icon: CheckCircle2,
    title: "Track to resolution",
    text: "Follow status changes on a public timeline. Every decision is made by an authorized officer.",
  },
];

const categories: { label: string; Icon: LucideIcon }[] = [
  { label: "Water Supply", Icon: Droplets },
  { label: "Roads & Transport", Icon: Construction },
  { label: "Electricity", Icon: Zap },
  { label: "Sanitation", Icon: Trash2 },
  { label: "Health Services", Icon: HeartPulse },
  { label: "Governance", Icon: Landmark },
  { label: "Other", Icon: FolderOpen },
];

const stats = [
  { value: "1,284", label: "Total registered", sub: "All time" },
  { value: "962", label: "Resolved", sub: "75% rate" },
  { value: "4.2d", label: "Avg. cycle time", sub: "Business days" },
  { value: "12", label: "Active departments", sub: "Participating" },
];

export default function Home() {
  return (
    <div className="bg-white">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-ink-100">
        <div className="grid min-h-[480px] lg:grid-cols-2">
          {/* Left copy */}
          <div className="flex flex-col justify-center px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
            <Badge tone="blue" className="w-fit px-3 py-1 font-semibold">
              Official citizen portal
            </Badge>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink-950 sm:text-5xl leading-[1.12]">
              National Grievance<br className="hidden sm:block" /> Redressal Portal
            </h1>
            <p className="mt-5 max-w-lg text-base text-ink-600 leading-relaxed">
              A transparent, accountable platform to register and resolve public
              grievances. AI-assisted categorization and routing with authorized
              officer verification.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/submit"
                className="inline-flex items-center justify-center rounded-md bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-all hover:bg-primary-700 hover:shadow-sm active:scale-[0.98]"
              >
                Register Complaint
              </Link>
              <Link
                href="/track"
                className="inline-flex items-center justify-center rounded-md border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-800 shadow-2xs transition-all hover:border-ink-300 hover:bg-ink-50 active:scale-[0.98]"
              >
                Track Status
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink-500 font-medium">
              Official public grievance portal serving municipal and state administrative divisions.
            </p>
          </div>

          {/* Right: stats panel */}
          <div className="border-l border-ink-100 bg-ink-50/40 flex flex-col justify-center px-6 py-12 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-6">
              System Live Statistics
            </p>
            <div className="grid grid-cols-2 gap-px bg-ink-200/50 border border-ink-200/50 rounded-md overflow-hidden">
              {stats.map(({ value, label, sub }) => (
                <div key={label} className="bg-white px-5 py-6">
                  <p className="text-3xl font-bold tracking-tight text-ink-950">{value}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-700">{label}</p>
                  <p className="text-xs text-ink-400">{sub}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-500 text-center">
              Aggregated live metrics across participating civic departments.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="border-b border-ink-100">
        <div className="px-4 py-14 sm:px-8 lg:px-12 xl:px-16">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <Badge tone="grey" className="mb-3">Standard Protocol</Badge>
              <h2 className="text-2xl font-bold tracking-tight text-ink-950">
                How Redressal Works
              </h2>
              <p className="mt-1.5 text-sm text-ink-500 max-w-lg">
                Fast, transparent 3-step lifecycle ensuring accountability from report to closure.
              </p>
            </div>
            <Link
              href="/submit"
              className="hidden sm:inline-flex items-center text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline whitespace-nowrap"
            >
              File a complaint →
            </Link>
          </div>

          <div className="grid gap-0 border border-ink-200/70 rounded-md overflow-hidden sm:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className={`flex gap-5 p-7 ${i < steps.length - 1 ? "border-b border-ink-100 sm:border-b-0 sm:border-r sm:border-ink-100" : ""}`}
              >
                <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-600 border border-primary-100">
                  <s.Icon size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{s.n}</p>
                  <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-ink-900">{s.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-500">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Departments ──────────────────────────────────────── */}
      <section className="px-4 py-14 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink-950">
              Participating Departments
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Municipal and administrative categories handled by the AI classifier.
            </p>
          </div>
          <Link
            href="/submit"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline whitespace-nowrap"
          >
            Submit in any department →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {categories.map(({ label, Icon }) => (
            <Link
              key={label}
              href="/submit"
              className="group flex flex-col items-center gap-3 rounded-md border border-ink-200 bg-white p-5 text-center transition-all hover:border-primary-300 hover:bg-primary-50/40 hover:shadow-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink-100/70 text-ink-600 transition-colors group-hover:bg-primary-100 group-hover:text-primary-700">
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <span className="text-xs font-semibold text-ink-700 group-hover:text-primary-700 leading-snug">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
