"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, ClipboardCheck, Construction, Droplets, FileText, FolderOpen, HeartPulse, Landmark, MapPin, ShieldCheck, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { LucideIcon } from "lucide-react";
import { RequestLifecycle } from "@/components/home/RequestLifecycle";
import { useAdminGrievanceFeed } from "@/components/admin/useAdminGrievanceFeed";
import { useDemoUser } from "@/lib/session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";

const departments: { labelKey: MessageKey; descriptionKey: MessageKey; Icon: LucideIcon }[] = [
  { labelKey: "deptWaterLabel", descriptionKey: "deptWaterDesc", Icon: Droplets },
  { labelKey: "deptRoadsLabel", descriptionKey: "deptRoadsDesc", Icon: Construction },
  { labelKey: "deptElectricityLabel", descriptionKey: "deptElectricityDesc", Icon: Zap },
  { labelKey: "deptHealthLabel", descriptionKey: "deptHealthDesc", Icon: HeartPulse },
  { labelKey: "deptGovLabel", descriptionKey: "deptGovDesc", Icon: Landmark },
  { labelKey: "deptOtherLabel", descriptionKey: "deptOtherDesc", Icon: FolderOpen },
];

const principles: { titleKey: MessageKey; textKey: MessageKey; Icon: LucideIcon }[] = [
  { Icon: MapPin, titleKey: "principle1Title", textKey: "principle1Text" },
  { Icon: BrainCircuit, titleKey: "principle2Title", textKey: "principle2Text" },
  { Icon: ShieldCheck, titleKey: "principle3Title", textKey: "principle3Text" },
];

const pathSteps: { titleKey: MessageKey; textKey: MessageKey; Icon: LucideIcon }[] = [
  { Icon: FileText, titleKey: "homeStep1Title", textKey: "homeStep1Text" },
  { Icon: BrainCircuit, titleKey: "homeStep2Title", textKey: "homeStep2Text" },
  { Icon: ClipboardCheck, titleKey: "homeStep3Title", textKey: "homeStep3Text" },
];

function StaffHomeOverview({ role, user }: { role: string; user: AuthUser }) {
  const { items, loading } = useAdminGrievanceFeed(role === "RESOLVER");
  const scopedItems = items.filter((item) => role === "ADMIN" ? !user.departmentId || item.departmentId === user.departmentId : role === "RESOLVER" ? item.ownerId === user.id || item.assignee === user.id : true);
  const resolved = scopedItems.filter((item) => ["resolved", "closed"].includes((item.status ?? "").toLowerCase())).length;
  const urgent = scopedItems.filter((item) => item.priority?.toLowerCase() === "high" || item.hfEngine?.isUrgent).length;
  const open = scopedItems.length - resolved;
  const roleName = role === "SUPERADMIN" ? "System administrator" : role === "ADMIN" ? "Department administrator" : "Resolver";
  const actions = role === "SUPERADMIN" ? [{ href: "/superadmin", label: "System administration", detail: "Manage users, departments, and audit records." }, { href: "/admin", label: "Grievance queue", detail: "Review, assign, and progress incoming complaints." }, { href: "/admin/analytics", label: "Executive analytics", detail: "Inspect service performance and spatial hotspots." }] : role === "ADMIN" ? [{ href: "/admin", label: "Grievance queue", detail: "Review and assign complaints for your department." }, { href: "/admin/analytics", label: "Executive analytics", detail: "Review trends, deadlines, and area concentrations." }] : [{ href: "/resolver", label: "My work", detail: "Open assigned grievances and record progress." }];
  return <div className="min-h-[calc(100vh-4rem)] bg-ink-50/30 px-4 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl"><div className="border-b border-ink-200 pb-6"><p className="text-xs font-bold uppercase tracking-wider text-primary-600">Staff overview</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Operational dashboard</h1><p className="mt-2 text-sm text-ink-600">{roleName}. Use the workspace links below to manage today&apos;s grievance operations.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ value: loading ? "—" : scopedItems.length, label: "Visible complaints", sub: role === "SUPERADMIN" ? "Across the system" : role === "ADMIN" ? "In your department" : "Assigned to you" }, { value: loading ? "—" : open, label: "Open workload", sub: "Requires action" }, { value: loading ? "—" : resolved, label: "Resolved", sub: "Closed successfully" }, { value: loading ? "—" : urgent, label: "High priority", sub: "Needs attention" }].map(({ value, label, sub }) => <div key={label} className="rounded-md border border-ink-200 bg-white p-5 shadow-2xs"><p className="text-2xl font-bold tracking-tight text-ink-950">{value}</p><p className="mt-1 text-sm font-semibold text-ink-700">{label}</p><p className="mt-1 text-xs text-ink-500">{sub}</p></div>)}</div><section className="mt-8"><h2 className="text-sm font-bold uppercase tracking-wider text-ink-700">Workspaces</h2><div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{actions.map((action) => <Link key={action.href} href={action.href} className="rounded-md border border-ink-200 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50/30"><p className="text-sm font-bold text-ink-950">{action.label} <span className="text-primary-600">→</span></p><p className="mt-2 text-xs leading-5 text-ink-500">{action.detail}</p></Link>)}</div></section></div></div>;
}

export default function Home() {
  const { user } = useDemoUser();
  const { t } = useI18n();
  const role = user?.role?.toUpperCase();
  if (role === "ADMIN" || role === "RESOLVER" || role === "SUPERADMIN") return <StaffHomeOverview role={role} user={user!} />;
  return <div className="overflow-hidden bg-white text-ink-950">
    <section className="relative border-b border-ink-200 bg-primary-50"><div className="absolute inset-0 opacity-50" aria-hidden style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(2,107,199,0.10) 1px, transparent 0)", backgroundSize: "28px 28px" }} /><div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-12 lg:py-24"><div><Badge tone="blue" className="border-primary-200 bg-white px-3 py-1 font-semibold text-primary-700">{t("homeBadge")}</Badge><h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-ink-950 sm:text-6xl">{t("homeTitle")}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-ink-600 sm:text-lg">{t("homeSubtitle")}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/submit" className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700">{t("homeCtaRegister")} <ArrowRight size={16} /></Link><Link href="/track" className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-5 py-3 text-sm font-bold text-ink-800 transition hover:border-primary-300 hover:bg-primary-50">{t("homeCtaTrack")}</Link></div><div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-ink-500"><span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" />{t("homeFree")}</span><span className="flex items-center gap-2"><MapPin size={14} className="text-emerald-600" />{t("homeLocation")}</span><span className="flex items-center gap-2"><Users size={14} className="text-emerald-600" />{t("homeHuman")}</span></div></div><div className="rounded-lg border border-primary-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3 border-b border-ink-100 pb-5"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-700"><ClipboardCheck size={20} /></span><div><p className="text-sm font-bold text-ink-950">{t("homePathTitle")}</p><p className="mt-0.5 text-xs text-ink-500">{t("homePathSub")}</p></div></div><div className="space-y-5 pt-5">{pathSteps.map(({ Icon, titleKey, textKey }, index) => <div key={titleKey} className="flex gap-3"><span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700"><Icon size={15} />{index < 2 && <span className="absolute left-1/2 top-8 h-5 w-px bg-ink-200" />}</span><div><p className="text-sm font-semibold text-ink-900">{t(titleKey)}</p><p className="mt-1 text-xs leading-5 text-ink-500">{t(textKey)}</p></div></div>)}</div></div></div></section>
    <section className="border-b border-ink-100 bg-ink-50/45"><div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-8 lg:px-12">{principles.map(({ Icon, titleKey, textKey }) => <div key={titleKey} className="flex gap-3 rounded-md border border-ink-200/70 bg-white p-4"><Icon className="mt-0.5 shrink-0 text-primary-600" size={19} /><div><p className="text-sm font-bold">{t(titleKey)}</p><p className="mt-1 text-xs leading-5 text-ink-500">{t(textKey)}</p></div></div>)}</div></section>
    <RequestLifecycle />
    <section className="border-b border-ink-100"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-12"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Badge tone="grey" className="mb-3">{t("reportBadge")}</Badge><h2 className="text-3xl font-bold tracking-tight">{t("reportTitle")}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">{t("reportText")}</p></div><Link href="/submit" className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700">{t("reportLink")} <ArrowRight size={15} /></Link></div><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{departments.map(({ Icon, labelKey, descriptionKey }) => <Link href="/submit" key={labelKey} className="group flex items-center gap-4 rounded-md border border-ink-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600 transition group-hover:bg-primary-100"><Icon size={21} /></span><span><span className="block text-sm font-bold text-ink-900">{t(labelKey)}</span><span className="mt-1 block text-xs leading-5 text-ink-500">{t(descriptionKey)}</span></span><ArrowRight size={15} className="ml-auto shrink-0 text-ink-300 transition group-hover:text-primary-600" /></Link>)}</div></div></section>
    <section><div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-12"><div><p className="text-xs font-bold uppercase tracking-wider text-primary-600">{t("accBadge")}</p><h2 className="mt-3 text-3xl font-bold tracking-tight">{t("accTitle")}</h2><p className="mt-4 max-w-xl text-sm leading-6 text-ink-600">{t("accText")}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-ink-200 bg-ink-50/50 p-5"><p className="text-2xl font-bold text-ink-950">01</p><p className="mt-2 text-sm font-bold">{t("accStep1Title")}</p><p className="mt-1 text-xs leading-5 text-ink-500">{t("accStep1Text")}</p></div><div className="rounded-md border border-ink-200 bg-ink-50/50 p-5"><p className="text-2xl font-bold text-ink-950">02</p><p className="mt-2 text-sm font-bold">{t("accStep2Title")}</p><p className="mt-1 text-xs leading-5 text-ink-500">{t("accStep2Text")}</p></div></div></div></section>
  </div>;
}
