"use client";

import { useCallback, useEffect, useState } from "react";
import { addProgressUpdate, getGrievanceHistory, listGrievances, submitResolution, transitionGrievanceState } from "@/lib/api";
import type { Grievance } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";

export function ResolverWorkspace() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [selected, setSelected] = useState<Grievance | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const next = await listGrievances();
    setItems(next as Grievance[]);
    if (selected) setSelected((next as Grievance[]).find((g) => g.id === selected.id) ?? null);
  }, [selected]);
  // The loader synchronizes the queue with the authenticated backend.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setMessage(e instanceof Error ? e.message : "Could not load queue")); }, [load]);
  useEffect(() => { if (selected) void getGrievanceHistory(selected.id).then(setHistory).catch(() => setHistory([])); }, [selected]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setMessage("");
    try { await fn(); await load(); setMessage("Saved successfully."); } catch (e) { setMessage(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
    <Card><CardHeader title="My assigned queue" subtitle={`${items.length} ticket${items.length === 1 ? "" : "s"}`} /><CardBody className="space-y-2">
      {items.length === 0 && <p className="text-sm text-ink-500">No tickets are assigned to you.</p>}
      {items.map((g) => <button key={g.id} onClick={() => setSelected(g)} className={`w-full rounded border p-3 text-left ${selected?.id === g.id ? "border-primary-500 bg-primary-50" : "border-ink-200 hover:bg-ink-50"}`}><div className="flex justify-between gap-2"><span className="font-mono text-xs">{g.id}</span><PriorityBadge priority={g.priority} /></div><p className="mt-1 text-sm font-semibold">{g.title}</p><div className="mt-1"><StatusBadge status={g.state ?? g.status} /></div></button>)}
    </CardBody></Card>
    <Card><CardBody className="space-y-5">
      {!selected ? <p className="text-sm text-ink-500">Select a ticket to begin work.</p> : <>
        <div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{selected.id}</span><StatusBadge status={selected.state ?? selected.status} /><PriorityBadge priority={selected.priority} /></div><h1 className="mt-3 text-xl font-bold">{selected.title}</h1><p className="mt-2 text-sm leading-6 text-ink-700">{selected.description}</p></div>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || selected.state === "IN_PROGRESS"} onClick={() => void act(() => transitionGrievanceState(selected.id, { to_state: "IN_PROGRESS", reason: "Resolver started work" }))}>Start work</Button><Button variant="outline" disabled={busy} onClick={() => void act(() => transitionGrievanceState(selected.id, { to_state: "BLOCKED", reason: "Waiting on additional action" }))}>Mark blocked</Button></div>
        <div className="space-y-2"><h2 className="text-sm font-bold">Progress update</h2><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe work completed or the next action" /><Button disabled={busy || !note.trim()} onClick={() => void act(async () => { await addProgressUpdate(selected.id, { bodyInternal: note.trim(), bodyCustomer: note.trim(), visibility: "customer", kind: "update" }); setNote(""); })}>Post update</Button></div>
        <div className="space-y-2"><h2 className="text-sm font-bold">Submit resolution</h2><Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Explain the resolution and actions taken" /><Button disabled={busy || !resolution.trim()} onClick={() => void act(async () => { await submitResolution(selected.id, resolution.trim()); setResolution(""); })}>Submit for review</Button></div>
        {message && <p className="text-sm text-primary-700">{message}</p>}
        <div className="border-t border-ink-100 pt-4"><h2 className="text-sm font-bold">Activity</h2><div className="mt-2 space-y-2">{history.length === 0 ? <p className="text-xs text-ink-500">No progress entries yet.</p> : history.map((entry, i) => { const e = entry as Record<string, unknown>; return <div key={i} className="rounded bg-ink-50 p-2 text-xs"><span className="font-semibold">{String(e.kind ?? "update")}</span>: {String(e.bodyInternal ?? e.bodyCustomer ?? e.reason ?? "State change")}</div>; })}</div></div>
      </>}
    </CardBody></Card>
  </div>;
}
