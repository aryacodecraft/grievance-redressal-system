"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Construction,
  Droplets,
  FileCheck2,
  FileText,
  FolderOpen,
  HeartPulse,
  Landmark,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAdminGrievanceFeed } from "@/components/admin/useAdminGrievanceFeed";
import { useDemoUser } from "@/lib/session";
import type { AuthUser } from "@/lib/types";
import { useResolverTasks } from "@/components/resolver/useResolverTasks";
import { Reveal } from "@/components/ui/Reveal";
import { canonicalDepartmentId } from "@/lib/departments";
import { useI18n, type MessageKey } from "@/lib/i18n";

// Category items matching actual application categories & route preselection.
// Copy lives in the i18n packs (cat* keys); this file only holds the structure.
interface CategoryItem {
  id: string;
  nameKey: MessageKey;
  descKey: MessageKey;
  exampleKeys: MessageKey[];
  Icon: LucideIcon;
}

const CATEGORY_ITEMS: CategoryItem[] = [
  {
    id: "water",
    nameKey: "catWaterName",
    descKey: "catWaterDesc",
    exampleKeys: ["catWaterEx1", "catWaterEx2", "catWaterEx3"],
    Icon: Droplets,
  },
  {
    id: "roads",
    nameKey: "catRoadsName",
    descKey: "catRoadsDesc",
    exampleKeys: ["catRoadsEx1", "catRoadsEx2", "catRoadsEx3"],
    Icon: Construction,
  },
  {
    id: "electricity",
    nameKey: "catElectricityName",
    descKey: "catElectricityDesc",
    exampleKeys: ["catElectricityEx1", "catElectricityEx2", "catElectricityEx3"],
    Icon: Zap,
  },
  {
    id: "health",
    nameKey: "catHealthName",
    descKey: "catHealthDesc",
    exampleKeys: ["catHealthEx1", "catHealthEx2", "catHealthEx3"],
    Icon: HeartPulse,
  },
  {
    id: "governance",
    nameKey: "catGovName",
    descKey: "catGovDesc",
    exampleKeys: ["catGovEx1", "catGovEx2", "catGovEx3"],
    Icon: Landmark,
  },
  {
    id: "other",
    nameKey: "catOtherName",
    descKey: "catOtherDesc",
    exampleKeys: ["catOtherEx1", "catOtherEx2", "catOtherEx3"],
    Icon: FolderOpen,
  },
];

// Actual backend workflow stages
const WORKFLOW_STAGES: {
  step: string;
  titleKey: MessageKey;
  actorKey: MessageKey;
  textKey: MessageKey;
  slaKey: MessageKey;
}[] = [
  { step: "01", titleKey: "lc1Title", actorKey: "ovActorCitizen", textKey: "lc1Text", slaKey: "lc1Sla" },
  { step: "02", titleKey: "lc2Title", actorKey: "lcActorAi", textKey: "lc2Text", slaKey: "lc2Sla" },
  { step: "03", titleKey: "lc3Title", actorKey: "lcActorManager", textKey: "lc3Text", slaKey: "lc3Sla" },
  { step: "04", titleKey: "lc4Title", actorKey: "lcActorResolver", textKey: "lc4Text", slaKey: "lc4Sla" },
  { step: "05", titleKey: "lc5Title", actorKey: "lcActorManagerCitizen", textKey: "lc5Text", slaKey: "lc5Sla" },
];

const PREPARATION_CHECKLIST: {
  titleKey: MessageKey;
  required: boolean;
  textKey: MessageKey;
}[] = [
  { titleKey: "chk1Title", required: true, textKey: "chk1Text" },
  { titleKey: "chk2Title", required: true, textKey: "chk2Text" },
  { titleKey: "chk3Title", required: false, textKey: "chk3Text" },
  { titleKey: "chk4Title", required: false, textKey: "chk4Text" },
];

function StaffHomeOverview({ role, user }: { role: string; user: AuthUser }) {
  const feed = useAdminGrievanceFeed(false, role !== "RESOLVER");
  const workerTasks = useResolverTasks(role === "RESOLVER");
  const items = role === "RESOLVER" ? workerTasks.items : feed.items;
  const loading = role === "RESOLVER" ? workerTasks.loading : feed.loading;
  const scopedItems = items.filter((item) =>
    role === "ADMIN"
      ? !user.departmentId ||
        canonicalDepartmentId(item.departmentId ?? item.category) ===
          canonicalDepartmentId(user.departmentId)
      : true
  );
  const resolved = scopedItems.filter((item) =>
    ["resolved", "closed"].includes((item.status ?? "").toLowerCase())
  ).length;
  const urgent = scopedItems.filter(
    (item) => item.priority?.toLowerCase() === "high" || item.hfEngine?.isUrgent
  ).length;
  const open = scopedItems.length - resolved;
  const roleName =
    role === "SUPERADMIN"
      ? "System administrator"
      : role === "ADMIN"
      ? "Department administrator"
      : "Resolver";
  const actions =
    role === "SUPERADMIN"
      ? [
          {
            href: "/superadmin",
            label: "System administration",
            detail: "Manage users, departments, and audit records.",
          },
          {
            href: "/admin",
            label: "Grievance queue",
            detail: "Review, assign, and progress incoming complaints.",
          },
          {
            href: "/admin/analytics",
            label: "Executive analytics",
            detail: "Inspect service performance and spatial hotspots.",
          },
        ]
      : role === "ADMIN"
      ? [
          {
            href: "/admin",
            label: "Grievance queue",
            detail: "Review and assign complaints for your department.",
          },
          {
            href: "/admin/analytics",
            label: "Executive analytics",
            detail: "Review trends, deadlines, and area concentrations.",
          },
        ]
      : [
          {
            href: "/resolver",
            label: "My work",
            detail: "Open assigned grievances and record progress.",
          },
        ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-ink-50/30 px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="border-b border-ink-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
            Staff overview
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
            Operational dashboard
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {roleName}. Use the workspace links below to manage today&apos;s grievance operations.
          </p>
        </div>
        {role === "RESOLVER" && workerTasks.error && (
          <p
            role="alert"
            className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            Could not load your assigned tasks: {workerTasks.error}
          </p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              value: loading ? "—" : scopedItems.length,
              label: "Visible complaints",
              sub:
                role === "SUPERADMIN"
                  ? "Across the system"
                  : role === "ADMIN"
                  ? "In your department"
                  : "Assigned to you",
            },
            {
              value: loading ? "—" : open,
              label: "Open workload",
              sub: "Requires action",
            },
            {
              value: loading ? "—" : resolved,
              label: "Resolved",
              sub: "Closed successfully",
            },
            {
              value: loading ? "—" : urgent,
              label: "High priority",
              sub: "Needs attention",
            },
          ].map(({ value, label, sub }) => (
            <div
              key={label}
              className="rounded-md border border-ink-200 bg-white p-5 shadow-2xs"
            >
              <p className="text-2xl font-bold tracking-tight text-ink-950">{value}</p>
              <p className="mt-1 text-sm font-semibold text-ink-700">{label}</p>
              <p className="mt-1 text-xs text-ink-500">{sub}</p>
            </div>
          ))}
        </div>
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-700">
            Workspaces
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-md border border-ink-200 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
              >
                <p className="text-sm font-bold text-ink-950">
                  {action.label} <span className="text-primary-700">→</span>
                </p>
                <p className="mt-2 text-xs leading-5 text-ink-500">{action.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useDemoUser();
  const { t } = useI18n();
  const role = user?.role?.toUpperCase();

  // Keep staff operational home when logged in as resolver/admin/superadmin
  if (role === "ADMIN" || role === "RESOLVER" || role === "SUPERADMIN") {
    return <StaffHomeOverview role={role} user={user!} />;
  }

  return (
    <div className="overflow-hidden bg-white text-ink-950">
      {/* ── 1. Hero: Action-Oriented (Report + Track) ── */}
      <section className="relative border-b border-ink-200/90 bg-gradient-to-b from-primary-50/60 to-white">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,107,0,0.12) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          {/* Hero: Direct Public-Service Messaging & Actions */}
          <div className="mx-auto max-w-2xl">
            <h1 className="animate-fade-up text-3xl font-extrabold tracking-tight text-ink-950 sm:text-5xl sm:leading-[1.12]">
              {t("heroTitle")}
            </h1>

            <p className="animate-fade-up [animation-delay:80ms] mt-4 text-base leading-7 text-ink-600 sm:text-lg">
              {t("heroSubtitle")}
            </p>

            {/* Primary & Secondary Actions */}
            <div className="animate-fade-up [animation-delay:160ms] mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/submit"
                className="inline-flex items-center gap-2.5 rounded-md bg-ink-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-ink-800 active:bg-ink-950"
              >
                <span>{t("heroCtaReport")}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                  <ArrowRight size={13} />
                </span>
              </Link>
              <Link
                href="/track"
                className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-800 shadow-2xs transition hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100"
              >
                {t("heroCtaTrack")}
              </Link>
            </div>

            {/* Trust & Transparency statement */}
            <div className="animate-fade-up [animation-delay:320ms] mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-ink-100 pt-6 text-xs text-ink-500">
              <span className="flex items-center gap-1.5 font-medium text-ink-700">
                <ShieldCheck size={15} className="text-emerald-600" />
                {t("heroTrustHuman")}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-ink-700">
                <MapPin size={15} className="text-primary-600" />
                {t("heroTrustGps")}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-ink-700">
                <Clock size={15} className="text-ink-500" />
                {t("heroTrustAudit")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Compact Grievance Overview: 3 Clear Steps ── */}
      <section className="border-b border-ink-100 bg-ink-50/40 py-12 sm:py-16">
        <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
              {t("ovBadge")}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {t("ovTitle")}
            </h2>
            <p className="mt-2 text-sm text-ink-600">{t("ovText")}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {/* Stage 1 */}
            <div className="relative rounded-lg border border-ink-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">                <span className="font-mono text-xs font-bold text-primary-700">
                  {t("ovStageN", { n: "01" })}
                </span>

                <span className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600 uppercase">
                  {t("ovActorCitizen")}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-ink-950">{t("ov1Title")}</h3>
              <p className="mt-1.5 text-xs leading-5 text-ink-600">{t("ov1Text")}</p>
            </div>

            {/* Stage 2 */}
            <div className="relative rounded-lg border border-ink-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary-700">
                  {t("ovStageN", { n: "02" })}
                </span>
                <span className="rounded bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 uppercase">
                  {t("ovActorAiOfficer")}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-ink-950">{t("ov2Title")}</h3>
              <p className="mt-1.5 text-xs leading-5 text-ink-600">{t("ov2Text")}</p>
            </div>

            {/* Stage 3 */}
            <div className="relative rounded-lg border border-ink-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary-700">
                  {t("ovStageN", { n: "03" })}
                </span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase">
                  {t("ovActorResolverCitizen")}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-ink-950">{t("ov3Title")}</h3>
              <p className="mt-1.5 text-xs leading-5 text-ink-600">{t("ov3Text")}</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── 3. Category Explorer: Interactive with Preselection ── */}
      <section className="border-b border-ink-100 py-12 sm:py-16">
        <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
                {t("catBadge")}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                {t("catTitle")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">{t("catText")}</p>
            </div>
            <Link
              href="/submit"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 hover:text-primary-800 hover:underline"
            >
              {t("catOpenForm")} <ArrowRight size={13} />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ITEMS.map((cat) => (
              <Link
                key={cat.id}
                href={`/submit?category=${cat.id}`}
                className="group relative flex flex-col justify-between rounded-lg border border-ink-200 bg-white p-5 transition hover:border-primary-400 hover:bg-primary-50/20 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-primary-700"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink-50 text-primary-700 transition group-hover:bg-primary-100">
                      <cat.Icon size={20} />
                    </span>
                    <span className="text-[11px] font-semibold text-ink-400 transition group-hover:text-primary-700 flex items-center gap-1">
                      {t("catReport")} <ArrowRight size={12} />
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-ink-950 group-hover:text-primary-900">
                    {t(cat.nameKey)}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-ink-600">{t(cat.descKey)}</p>
                </div>

                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    {t("catCommon")}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-ink-500">
                    {cat.exampleKeys.map((exKey) => (
                      <li key={exKey} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-ink-300" />
                        <span>{t(exKey)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── 4. What Happens After You Submit: Lifecycle & Plain Explanations ── */}
      <section className="border-b border-ink-100 bg-ink-50/40 py-12 sm:py-16">
        <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
              {t("lcBadge")}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {t("lcTitle")}
            </h2>
            <p className="mt-2 text-sm text-ink-600">{t("lcText")}</p>
          </div>

          <div className="mt-8 space-y-3 sm:space-y-4">
            {WORKFLOW_STAGES.map((s) => (
              <div
                key={s.step}
                className="flex flex-col gap-3 rounded-lg border border-ink-200/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-100 font-mono text-xs font-bold text-ink-800">
                    {s.step}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink-950">{t(s.titleKey)}</h3>
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                        {t(s.actorKey)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-600 leading-normal">{t(s.textKey)}</p>
                  </div>
                </div>

                <div className="shrink-0 border-t border-ink-100 pt-2 sm:border-0 sm:pt-0 sm:text-right">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 block">
                    {t("lcTimeline")}
                  </span>
                  <span className="text-xs font-semibold text-primary-700">{t(s.slaKey)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-primary-200 bg-primary-50/40 p-4 text-xs text-ink-700">
            <p className="font-semibold text-ink-950 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-700" />
              {t("lcDelayedTitle")}
            </p>
            <p className="mt-1 leading-relaxed text-ink-600">
              {t("lcDelayedText1")}{" "}
              <Link href="/track" className="font-bold text-primary-700 underline">
                {t("lcTrackPortal")}
              </Link>
              {t("lcDelayedText2")}
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── 5. Prepare Before Reporting: Practical Checklist ── */}
      <section className="border-b border-ink-100 py-12 sm:py-16">
        <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
                {t("chkBadge")}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                {t("chkTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">{t("chkText")}</p>

              <div className="mt-6 space-y-3">
                {PREPARATION_CHECKLIST.map((item) => (
                  <div
                    key={item.titleKey}
                    className="flex items-start gap-3 rounded-md border border-ink-200/70 bg-white p-3.5 shadow-2xs"
                  >
                    <CheckCircle2
                      size={18}
                      className={
                        item.required
                          ? "text-primary-700 mt-0.5 shrink-0"
                          : "text-ink-400 mt-0.5 shrink-0"
                      }
                    />
                    <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-900">{t(item.titleKey)}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            item.required
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-ink-100 text-ink-600"
                          }`}
                        >
                          {item.required ? t("chkRequired") : t("chkOptional")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500 leading-normal">{t(item.textKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Call to Action Card */}
            <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-6 sm:p-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink-950 text-white">
                <FileCheck2 size={20} />
              </span>
              <h3 className="mt-4 text-xl font-bold text-ink-950">{t("ctaTitle")}</h3>
              <p className="mt-2 text-xs leading-5 text-ink-600">{t("ctaText")}</p>
              <div className="mt-6 space-y-2.5">
                <Link
                  href="/submit"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-ink-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-ink-800"
                >
                  {t("ctaPrimary")} <ArrowRight size={15} />
                </Link>
                <Link
                  href="/track"
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-ink-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink-800 hover:bg-ink-50"
                >
                  {t("ctaSecondary")}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── 6. Concrete Trust & AI Transparency ── */}
      <section className="bg-white py-12 sm:py-16">
        <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-700">
              {t("trustBadge")}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {t("trustTitle")}
            </h2>
            <p className="mt-2 text-sm text-ink-600">{t("trustText")}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-ink-200/80 bg-ink-50/30 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700">
                <Layers size={17} />
              </span>
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-900">
                {t("trust1Title")}
              </h3>
              <p className="mt-1.5 text-xs text-ink-600 leading-normal">{t("trust1Text")}</p>
            </div>

            <div className="rounded-lg border border-ink-200/80 bg-ink-50/30 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700">
                <Users size={17} />
              </span>
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-900">
                {t("trust2Title")}
              </h3>
              <p className="mt-1.5 text-xs text-ink-600 leading-normal">{t("trust2Text")}</p>
            </div>

            <div className="rounded-lg border border-ink-200/80 bg-ink-50/30 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700">
                <FileText size={17} />
              </span>
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-900">
                {t("trust3Title")}
              </h3>
              <p className="mt-1.5 text-xs text-ink-600 leading-normal">{t("trust3Text")}</p>
            </div>

            <div className="rounded-lg border border-ink-200/80 bg-ink-50/30 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700">
                <CheckCircle2 size={17} />
              </span>
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-900">
                {t("trust4Title")}
              </h3>
              <p className="mt-1.5 text-xs text-ink-600 leading-normal">{t("trust4Text")}</p>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
