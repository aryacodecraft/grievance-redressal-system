"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  User,
  Wrench,
  X,
} from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { AnalysisPanel } from "@/components/grievance/GrievanceCard";
import { reverseGeocode } from "@/lib/location";
import { getSlaInfo } from "@/lib/sla";
import type { Grievance } from "@/lib/types";
import { DEPARTMENTS } from "./departments";
import { SinglePinMap } from "./SinglePinMap";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function SlaBadge({ grievance }: { grievance: Grievance }) {
  const sla = getSlaInfo(grievance);
  const tone =
    sla.state === "overdue"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : sla.state === "closed"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <Clock size={11} />
      {sla.label}
    </span>
  );
}

/**
 * Centered grievance review dialog opened from the admin queue.
 * Presents full details, evidence, a single-pin location map, AI triage
 * diagnostics and the officer action controls (human-in-the-loop).
 */
export function GrievanceReviewModal({
  grievance,
  onClose,
  onStatusTransition,
  departmentManager = false,
  employees = [],
  onEmployeeAssign,
}: {
  grievance: Grievance | null;
  onClose: () => void;
  onStatusTransition: (status: string, assignedDept?: string) => Promise<void>;
  departmentManager?: boolean;
  employees?: Array<{ id: string; full_name?: string; email?: string; isActive?: boolean }>;
  onEmployeeAssign?: (employeeId: string) => Promise<void>;
}) {
  // The queue remounts this dialog (via `key`) per grievance, so the action
  // form state initialises fresh from the opened record without an effect.
  const [assignee, setAssignee] = useState(grievance?.departmentId || grievance?.category || DEPARTMENTS[0].key);
  const [employeeId, setEmployeeId] = useState(grievance?.ownerId || "");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resolve the pinned coordinates into a real place name for the officer.
  // The queue remounts this dialog per grievance (via `key`), so state starts
  // null and is only set asynchronously once geocoding resolves. Falls back
  // to a neutral unavailable label when offline or unresolved.
  const [placeName, setPlaceName] = useState<string | null>(null);
  useEffect(() => {
    if (!grievance || grievance.latitude == null || grievance.longitude == null) {
      return;
    }
    let cancelled = false;
    void reverseGeocode(Number(grievance.latitude), Number(grievance.longitude)).then(
      (place) => {
        if (!cancelled && place) setPlaceName(place.name);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [grievance]);

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!grievance) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [grievance, onClose]);

  if (!grievance) return null;

  const g = grievance;
  const hasLocation = g.latitude != null && g.longitude != null;

  async function transition(status: string, assignedDept?: string) {
    setSubmitting(true);
    setNotice(null);
    setError(null);
    try {
      await onStatusTransition(status, assignedDept);
      setNotice(`Ticket ${g.id} updated to status "${status.replace("_", " ")}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status transition failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function assignEmployee() {
    if (!employeeId || !onEmployeeAssign) return;
    setSubmitting(true);
    setNotice(null);
    setError(null);
    try {
      await onEmployeeAssign(employeeId);
      setNotice(`Ticket ${g.id} assigned to the selected employee.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Employee assignment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Review grievance ${g.id}`}
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-4xl rounded-md border border-ink-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-sm">
                {g.id}
              </span>
              <StatusBadge status={g.status} />
              <PriorityBadge priority={g.priority} />
              <SlaBadge grievance={g} />
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-ink-950 leading-snug">
              {g.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review dialog"
            className="shrink-0 rounded-sm p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
          {/* Left: details, location, evidence */}
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Description
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                {g.description || "No description provided."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border border-ink-100 bg-ink-50/50 p-3 text-[11px] text-ink-600">
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-ink-400" />
                <span className="font-semibold text-ink-700">Citizen:</span>
                <span className="truncate">{g.userId || "Anonymous"}</span>
              </div>
              <div>
                <span className="font-semibold text-ink-700">Registered:</span>{" "}
                {formatDateTime(g.createdAt)}
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-ink-700">Department:</span>{" "}
                {g.assignee || "Unassigned"}
              </div>
            </div>

            {/* Location */}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                <MapPin size={12} className="text-primary-700" />
                Location
              </p>
              {hasLocation ? (
                <>
                  <SinglePinMap
                    latitude={Number(g.latitude)}
                    longitude={Number(g.longitude)}
                    title={g.title}
                  />
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-ink-700">
                    <MapPin size={12} className="mt-0.5 shrink-0 text-primary-700" />
                    {placeName ?? "Area name unavailable"}
                  </p>
                </>
              ) : (
                <p className="rounded-md border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">
                  No location pinned for this grievance.
                </p>
              )}
            </div>

            {/* Evidence */}
            {g.imageUrl && (
              <div className="rounded-md border border-ink-200 bg-ink-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-700">
Attached Photo
                  </span>
                  <a
                    href={g.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline"
                  >
                    Full resolution <ExternalLink size={11} />
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.imageUrl}
                  alt="Evidence photo"
                  className="max-h-52 w-full rounded-sm object-cover border border-ink-200"
                />
              </div>
            )}
          </div>

          {/* Right: AI triage + actions */}
          <div className="space-y-5">
            {g.hfEngine && <AnalysisPanel hfEngine={g.hfEngine} />}

            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Officer Action
                </p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  AI recommends; the authorized officer decides and the action is recorded.
                </p>
              </div>

              {departmentManager ? (
                <Field label="Assign to employee" hint="Choose an active employee from your department.">
                  <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={submitting || employees.length === 0}>
                    <option value="">{employees.length ? "Select an employee" : "No active employees available"}</option>
                    {employees.filter((employee) => employee.isActive !== false).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email || employee.id}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field label="Assign to Department" hint="Pick the team that will fix this issue.">
                  <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={submitting}>
                    {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </Select>
                </Field>
              )}


              <Field
                label="Officer Notes (Optional)"
                hint="Saved with the complaint so citizens can see what was done."
              >
                <Input
                  placeholder="e.g. Dispatched repair van 4B; leak plugged and road cleared."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                />
              </Field>

              {notice && <Alert tone="info">{notice}</Alert>}
              {error && <Alert tone="error">{error}</Alert>}

              <div className="grid grid-cols-2 gap-2">
                {!departmentManager && <Button
                  type="button"
                  onClick={() => void transition("assigned", assignee)}
                  disabled={submitting}
                  className="flex items-center justify-center gap-1.5"
                >
                  <Building2 size={14} />
                  Review department assignment
                </Button>}

                {departmentManager && <Button type="button" onClick={() => void assignEmployee()} disabled={submitting || !employeeId || !onEmployeeAssign} className="flex items-center justify-center gap-1.5"><Building2 size={14} />Assign to employee</Button>}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void transition("in_progress")}
                  disabled={submitting || g.status === "in_progress"}
                  className="flex items-center justify-center gap-1.5"
                >
                  <Wrench size={14} />
                  In Progress
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void transition("resolved")}
                  disabled={submitting || g.status === "resolved"}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 size={14} />
                  Mark Resolved
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void transition("rejected")}
                  disabled={submitting || g.status === "rejected"}
                  className="flex items-center justify-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X size={14} />
                  Reject / Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
