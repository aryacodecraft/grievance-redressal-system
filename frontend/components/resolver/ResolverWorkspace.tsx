"use client";
import { useEffect, useMemo, useState } from "react";
import { acceptAssignment, addProgressUpdate, escalateGrievance, getGrievanceHistory, submitResolution, transitionGrievanceState } from "@/lib/api";
import type { Grievance } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import { useResolverTasks } from "./useResolverTasks";

const issueTypes = ["Request reassignment", "Invalid Grievance", "Duplicate Grievance", "Wrong Department", "Wrong Location", "Insufficient Information", "Citizen Clarification Required", "Requires Specialized Skill/Team", "Material/Equipment Required", "Manager Approval Required", "Safety Concern", "Outside Department Jurisdiction", "Unable to Resolve", "Access/Location Issue", "Other"];
const status = (g: Grievance) => (g.state ?? g.status ?? "").toUpperCase();
const date = (v?: string | null) => v ? new Date(v).toLocaleDateString() : "Not set";

export function ResolverWorkspace() {
  const { notify } = useToast();
  const { items, loading, error, refresh } = useResolverTasks();
  const [selectedId, setSelectedId] = useState<string | null>(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("grievance"));
  const selected = items.find((grievance) => grievance.id === selectedId) ?? items[0] ?? null;
  const [history, setHistory] = useState<unknown[]>([]); const [note, setNote] = useState(""); const [hold, setHold] = useState(""); const [resolution, setResolution] = useState(""); const [completionPhoto, setCompletionPhoto] = useState<string | null>(null); const [photoUploading, setPhotoUploading] = useState(false); const [photoError, setPhotoError] = useState<string | null>(null); const [issueType, setIssueType] = useState(issueTypes[0]); const [issue, setIssue] = useState(""); const [suggestion, setSuggestion] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (selected) void getGrievanceHistory(selected.id).then(setHistory).catch(() => setHistory([])); }, [selected]);
  // Clear the completed-work photo when a different grievance is selected.
  // Adjusted during render rather than in the effect above: a synchronous
  // setState there trips react-hooks/set-state-in-effect, and keying on the id
  // means a re-fetched grievance for the same task keeps its photo attached.
  const selectedGrievanceId = selected?.id ?? null;
  const latestReviewFeedback = [...history].reverse().find((row) => (row as Record<string, unknown>).kind === "review_feedback") as Record<string, unknown> | undefined;
  const [prevSelectedGrievanceId, setPrevSelectedGrievanceId] = useState(selectedGrievanceId);
  if (selectedGrievanceId !== prevSelectedGrievanceId) {
    setPrevSelectedGrievanceId(selectedGrievanceId);
    setCompletionPhoto(null);
    setPhotoError(null);
  }
  const metrics = useMemo(() => { const completed = items.filter((g) => ["RESOLUTION_SUBMITTED", "RESOLVED", "CLOSED"].includes(status(g))).length; const pending = items.filter((g) => ["ASSIGNED", "ACCEPTED", "PENDING_ASSIGNMENT"].includes(status(g))).length; const inProgress = items.filter((g) => status(g) === "IN_PROGRESS").length; const onHold = items.filter((g) => status(g) === "BLOCKED").length; const overdue = items.filter((g) => g.dueDate && new Date(g.dueDate) < new Date() && !["RESOLVED", "CLOSED"].includes(status(g))).length; return { total: items.length, completed, pending, inProgress, onHold, overdue, rate: items.length ? Math.round(completed / items.length * 100) : 0 }; }, [items]);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setMessage(""); try { await fn(); await refresh(); setMessage("Saved successfully."); notify("Update saved", "Your grievance task has been updated."); } catch (e) { const text = e instanceof Error ? e.message : "Action failed"; setMessage(text); notify("Action failed", text, "error"); } finally { setBusy(false); } }

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.type)) {
      setPhotoError("Please select a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Image size must be less than 10 MB.");
      return;
    }
    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } = await import("@/lib/api");
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error("Cloudinary upload preset is not configured.");
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) {
        throw new Error(data?.error?.message ?? "Failed to upload photo");
      }
      setCompletionPhoto(data.secure_url as string);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  }
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-ink-950">My work dashboard</h1><p className="mt-1 text-sm text-ink-600">Review your assigned grievances, record your progress, and report problems early so your manager can help.</p></div>
    {error && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Could not load your assigned tasks: {error}</div>}
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Total assigned", metrics.total], ["Pending", metrics.pending], ["In progress", metrics.inProgress], ["Completed", metrics.completed], ["On hold", metrics.onHold], ["Overdue", metrics.overdue]].map(([label, value]) => <Card key={String(label)}><CardBody><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-2 text-2xl font-bold text-ink-950">{loading ? "—" : value}</p></CardBody></Card>)}</div>
    <Card><CardBody><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Overall progress</p><p className="mt-1 text-xs text-ink-500">{metrics.completed} of {metrics.total} assignments submitted for review</p></div><strong className="text-xl text-primary-700">{metrics.rate}%</strong></div><div className="mt-3 h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-primary-600" style={{ width: `${metrics.rate}%` }} /></div></CardBody></Card>
    <div className="grid gap-6 lg:grid-cols-[350px_1fr]"><Card><CardHeader title="My tasks" subtitle={loading ? "Loading assignments…" : `${items.length} assigned grievance${items.length === 1 ? "" : "s"}`} /><CardBody className="space-y-2">{!loading && items.length === 0 && !error && <p className="text-sm text-ink-500">No tasks are assigned to you yet.</p>}{items.map((g) => <button key={g.id} type="button" aria-label={`Open task ${g.id}: ${g.title}`} onClick={() => setSelectedId(g.id)} className={`w-full rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${selected?.id === g.id ? "border-primary-600 bg-primary-50" : "border-ink-200 hover:bg-ink-50"}`}><div className="flex justify-between gap-2"><span className="font-mono text-xs">{g.id}</span><PriorityBadge priority={g.priority} /></div><p className="mt-1 text-sm font-semibold">{g.title}</p><div className="mt-2 flex justify-between gap-2"><StatusBadge status={g.state ?? g.status} /><span className="text-xs text-ink-500">Due {date(g.dueDate)}</span></div><span className="mt-2 block text-right text-xs font-semibold text-primary-700">View task details →</span></button>)}</CardBody></Card>
      <Card><CardBody className="space-y-6">{!selected ? <p className="text-sm text-ink-500">Select a task to view its details.</p> : <><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{selected.id}</span><StatusBadge status={selected.state ?? selected.status} /><PriorityBadge priority={selected.priority} /></div><h2 className="mt-3 text-xl font-bold text-ink-950">{selected.title}</h2><p className="mt-2 text-sm leading-6 text-ink-700">{selected.description}</p><p className="mt-3 text-xs text-ink-500">Department: <strong>{selected.departmentId ?? selected.category}</strong> · Submitted {date(selected.createdAt)} · Due {date(selected.dueDate)}</p>{selected.latitude != null && selected.longitude != null && <a className="mt-1 block text-xs text-primary-700 underline" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}`} target="_blank" rel="noreferrer">Open task location</a>}{selected.imageUrl && <img src={selected.imageUrl} alt="Citizen evidence" className="mt-4 max-h-56 rounded-lg object-cover" />}</div>
        {latestReviewFeedback && <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-950">Manager review feedback</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{String(latestReviewFeedback.reason || "The manager returned this resolution for further work.")}</p><p className="mt-1 text-[11px] text-amber-800">{date(String(latestReviewFeedback.createdAt ?? ""))}</p></div>}
        {selected.resolutionFeedback && <div className="rounded-md border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-bold text-blue-950">Citizen feedback · {selected.resolutionFeedback.rating}/5</p><p className="mt-1 whitespace-pre-wrap text-sm text-blue-900">{selected.resolutionFeedback.comment}</p><p className="mt-1 text-[11px] text-blue-800">{date(selected.resolutionFeedback.submittedAt)}</p></div>}
        <div className="flex flex-wrap gap-2">{status(selected) === "ASSIGNED" && <Button disabled={busy} onClick={() => void act(() => acceptAssignment(selected.id))}>Accept assignment</Button>}{["ASSIGNED", "ACCEPTED", "BLOCKED", "REOPENED"].includes(status(selected)) && <Button disabled={busy} onClick={() => void act(() => transitionGrievanceState(selected.id, { to_state: "IN_PROGRESS", reason: "Worker started work" }))}>Start work</Button>}</div>
        <Field label="Reason for hold" hint="Add a reason before pausing work."><Input value={hold} onChange={(e) => setHold(e.target.value)} placeholder="Awaiting materials, access, approval…" /></Field><Button variant="outline" disabled={busy || !hold.trim() || !["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(status(selected))} onClick={() => void act(() => transitionGrievanceState(selected.id, { to_state: "BLOCKED", reason: hold.trim() }))}>Place on hold</Button>
        <div className="border-t border-ink-100 pt-5"><h3 className="text-sm font-bold">Daily work update</h3><div className="mt-3 space-y-3"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you did, what is happening now, any materials needed, and the next step" rows={4} /><Button disabled={busy || !note.trim()} onClick={() => void act(async () => { await addProgressUpdate(selected.id, { bodyInternal: note.trim(), bodyCustomer: note.trim(), visibility: "customer", kind: "daily_update", workCompleted: note.trim() }); setNote(""); })}>Post update</Button></div></div>
        <div className="border-t border-ink-100 pt-5"><h3 className="text-sm font-bold">Report a problem to your manager</h3><div className="mt-3 space-y-3"><Select value={issueType} onChange={(e) => setIssueType(e.target.value)}>{issueTypes.map((type) => <option key={type}>{type}</option>)}</Select><Textarea value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What is stopping this work from being finished?" /><Input value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="What would help? (optional)" /><Button variant="outline" disabled={busy || !issue.trim()} onClick={() => void act(async () => { await escalateGrievance(selected.id, { issueType, reason: issue.trim(), description: issue.trim(), suggestedAction: suggestion.trim() || undefined }); setIssue(""); setSuggestion(""); })}>Send to manager</Button></div></div>
        <div className="border-t border-ink-100 pt-5"><h3 className="text-sm font-bold">Submit your work for review</h3><div className="mt-3 space-y-3"><Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="What you did to fix the issue" rows={4} /><Field label="Completed work photo (optional)" hint="Upload a photo proving the work has been completed for verification."><div className="space-y-2"><Input type="file" accept="image/*" disabled={busy || photoUploading} onChange={(e) => void handlePhotoFile(e.target.files?.[0])} className="h-auto py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink-800 hover:file:bg-ink-200 cursor-pointer" />{photoUploading && <p className="text-xs text-primary-700">Uploading photo…</p>}{photoError && <p className="text-xs text-rose-600">{photoError}</p>}{completionPhoto && (<div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-2"><img src={completionPhoto} alt="Completed work preview" className="h-16 w-16 rounded object-cover border border-emerald-300" /><div className="flex-1 min-w-0"><p className="text-xs font-semibold text-emerald-800">Photo attached successfully</p><a href={completionPhoto} target="_blank" rel="noreferrer" className="text-[11px] text-primary-700 underline truncate block">View full photo</a></div><Button size="sm" variant="outline" type="button" onClick={() => setCompletionPhoto(null)}>Remove</Button></div>)}</div></Field><Button disabled={busy || photoUploading || !resolution.trim()} onClick={() => void act(async () => { await submitResolution(selected.id, resolution.trim(), [], completionPhoto ?? undefined); setResolution(""); setCompletionPhoto(null); })}>Send for review</Button></div></div>{message && <p className="text-sm text-primary-700">{message}</p>}
        <div className="border-t border-ink-100 pt-5"><h3 className="text-sm font-bold">Activity timeline</h3><div className="mt-3 space-y-2">{history.length === 0 ? <p className="text-xs text-ink-500">No activity recorded yet.</p> : history.map((entry, i) => { const e = entry as Record<string, unknown>; const title = e.kind === "review_feedback" ? "Manager review feedback" : e.kind === "status" ? `${String(e.from ?? "")} → ${String(e.to ?? "")}` : String(e.kind ?? "State update"); return <div key={i} className={`rounded-lg p-3 text-xs ${e.kind === "review_feedback" ? "border border-amber-200 bg-amber-50" : "bg-ink-50"}`}><strong>{title}</strong><span className="ml-3 text-ink-500">{date(String(e.at ?? e.createdAt ?? ""))}</span><p className="mt-1 whitespace-pre-wrap text-ink-700">{String(e.bodyInternal ?? e.bodyCustomer ?? e.reason ?? e.to ?? "Activity recorded")}</p></div>; })}</div></div></>}</CardBody></Card></div></div>;
}
