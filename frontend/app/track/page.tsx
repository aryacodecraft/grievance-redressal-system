"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import {
  AnalysisPanel,
  GrievanceCard,
  StatusTimeline,
} from "@/components/grievance/GrievanceCard";
import { MOCK_GRIEVANCES, findMockGrievance } from "@/lib/mock";
import { fetchGrievanceById } from "@/lib/grievances";
import { getDepartmentCounts, getGrievanceHistory, listGrievances } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";

const departmentNames: Record<string, string> = {
  water: "Water",
  roads: "Roads",
  transport: "Transport",
  electricity: "Electricity",
  sanitation: "Sanitation",
  health: "Health",
  governance: "Governance",
  other: "Other",
};

export default function TrackPage() {
  const { liveMode, user } = useDemoUser();
  const [tab, setTab] = useState<"mine" | "search">("mine");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState<Grievance | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [recent, setRecent] = useState<Grievance[]>([]);
  const [registryCounts, setRegistryCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!liveMode) return;
    if (!user) return;
    void listGrievances({ userId: user.id }).then((rows) => setRecent(rows as Grievance[])).catch(() => setRecent([]));
  }, [liveMode, user]);
  useEffect(() => {
    if (!liveMode) return;
    void getDepartmentCounts().then((result) => setRegistryCounts(result.counts)).catch(() => setRegistryCounts(null));
  }, [liveMode]);
  const displayedRecent = liveMode ? recent : MOCK_GRIEVANCES;
  const departmentCounts = displayedRecent.reduce<Record<string, number>>((counts, grievance) => {
    const key = (grievance.category || "other").toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  async function search() {
    setBusy(true);
    setSearched(false);
    try {
      if (liveMode) {
        const result = await fetchGrievanceById(query);
        setFound(result);
        setHistory(result ? (await getGrievanceHistory(result.id)) as Record<string, unknown>[] : []);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setFound(findMockGrievance(query) ?? null);
      }
    } catch (err) {
      console.error("Track lookup error:", err);
      setFound(null);
    } finally {
      setSearched(true);
      setBusy(false);
    }
  }

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          Track Grievance Status
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">See your submitted grievances in one place, or use a reference ID to look up a request you are authorized to view.</p>
      </div>

      <div className="border-b border-ink-100 bg-white px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-xl gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1" role="tablist" aria-label="Tracking views">
          <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={`flex-1 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "mine" ? "bg-white text-primary-700 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>My grievances</button>
          <button type="button" role="tab" aria-selected={tab === "search"} onClick={() => setTab("search")} className={`flex-1 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "search" ? "bg-white text-primary-700 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>Search by ID</button>
        </div>
      </div>

      {/* Search tab */}
      {tab === "search" && <div className="border-b border-ink-100 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-lg font-bold text-ink-950">Find a grievance by reference ID</h2>
          <p className="mt-1 text-sm text-ink-500">Use the ID from your acknowledgement, for example <button type="button" onClick={() => setQuery("GRV-2026-0012")} className="font-mono font-semibold text-primary-600 underline">GRV-2026-0012</button>.</p>
          <form className="mx-auto mt-5 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <Input aria-label="Grievance reference ID" placeholder="GRV-2026-0142" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button type="submit" disabled={busy || !query.trim()} className="min-w-32">{busy ? "Searching…" : "Search"}</Button>
          </form>
        </div>
      </div>}

      {/* Result details */}
      {tab === "search" && <div className="px-4 py-6 sm:px-6 lg:px-8">
        {busy && <Spinner label="Querying grievance database…" />}
        {!busy && searched && found && <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5"><GrievanceCard grievance={found} />{found.hfEngine && <AnalysisPanel hfEngine={found.hfEngine} />}</div>
          <Card className="h-fit border-ink-200/80 shadow-xs"><CardHeader title="Resolution Timeline" subtitle="Updated as officers take actions" /><CardBody><StatusTimeline status={found.state ?? found.status} />{history.length > 0 && <div className="mt-5 space-y-2 border-t border-ink-100 pt-4">{history.map((entry, index) => <div key={index} className="rounded bg-ink-50 p-2 text-xs text-ink-700"><span className="font-semibold">{String(entry.kind ?? "Update")}</span> · {String(entry.bodyCustomer ?? entry.reason ?? "Status updated")}</div>)}</div>}</CardBody></Card>
        </div>}
        {!busy && searched && !found && <EmptyState title="No grievance found for that reference ID" hint="Check the exact reference code from your acknowledgement. You can only view requests your account is authorized to access." />}
        <div className="mx-auto mt-10 max-w-5xl border-t border-ink-100 pt-8"><div className="mb-4 text-center"><h2 className="text-lg font-bold text-ink-950">Requests by department</h2><p className="mt-1 text-sm text-ink-500">Total requests in the registry. Individual request details remain access-controlled.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(departmentNames).map(([key, label]) => { const count = registryCounts?.[key] ?? departmentCounts[key] ?? 0; return <div key={key} className="rounded-lg border border-ink-200 bg-ink-50/40 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-2 text-2xl font-bold text-ink-950">{count}</p><p className="mt-1 text-xs text-ink-500">request{count === 1 ? "" : "s"}</p></div>; })}</div></div>
      </div>}

      {/* My grievances tab */}
      {tab === "mine" && <div className="px-4 py-6 sm:px-6 lg:px-8">
        {!user ? <Card className="mx-auto max-w-lg border-primary-200 bg-primary-50/40 text-center"><CardBody className="space-y-4 p-8"><h2 className="text-xl font-bold text-ink-950">Sign in to check status</h2><p className="text-sm leading-6 text-ink-600">Your personal grievance history is available after you sign in. This keeps your requests and updates private.</p><Link href="/login?next=/track"><Button className="w-full sm:w-auto">Sign in to view my grievances</Button></Link></CardBody></Card> : <><div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-950">My grievances</h2><p className="mt-1 text-sm text-ink-500">Your submitted requests and their latest known status.</p></div><span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">{displayedRecent.length} total</span></div>
        {displayedRecent.length === 0 ? <EmptyState title="No grievances found" hint="Once you submit a complaint, it will appear here." /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{displayedRecent.map((g) => <GrievanceCard key={g.id} grievance={g} />)}</div>}</>}

        <div className="mt-10 border-t border-ink-100 pt-8"><div className="mb-4"><h2 className="text-lg font-bold text-ink-950">Grievances by department</h2><p className="mt-1 text-sm text-ink-500">A quick view of the requests currently available to your account.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(departmentNames).map(([key, label]) => <div key={key} className="rounded-lg border border-ink-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-2 text-2xl font-bold text-ink-950">{departmentCounts[key] || 0}</p><p className="mt-1 text-xs text-ink-500">request{departmentCounts[key] === 1 ? "" : "s"}</p></div>)}</div></div>
      </div>}

    </div>
  );
}
