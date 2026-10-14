"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  User,
  X,
} from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { AnalysisPanel, StatusTimeline } from "./GrievanceCard";
import { SinglePinMap } from "@/components/admin/SinglePinMap";
import { getGrievanceHistory } from "@/lib/api";
import { departmentKey, useI18n } from "@/lib/i18n";
import type { Grievance } from "@/lib/types";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function GrievanceDetailModal({
  grievance,
  onClose,
  citizenView = false,
}: {
  grievance: Grievance | null;
  onClose: () => void;
  /** Citizen surfaces hide internal routing: priority + department. */
  citizenView?: boolean;
}) {
  const { t } = useI18n();
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!grievance) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await getGrievanceHistory(grievance.id);
        if (!cancelled) {
          setHistory((res as Record<string, unknown>[]) || []);
        }
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [grievance]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!grievance) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Grievance details: ${grievance.id}`}
      onClick={onClose}
    >
      <div
        className="my-2 sm:my-4 w-full max-w-3xl rounded-xl border border-ink-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 bg-ink-50/50 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-sm">
                {grievance.id}
              </span>
              <StatusBadge status={grievance.state ?? grievance.status} />
              {!citizenView && (
                <>
                  <PriorityBadge priority={grievance.priority} />
                  <span className="rounded-sm bg-white border border-ink-200/80 px-2 py-0.5 text-xs font-medium text-ink-700 shadow-2xs">
                    {t(departmentKey(grievance.category))}
                  </span>
                </>
              )}
            </div>
            <h2 className="mt-2 text-base sm:text-lg font-bold tracking-tight text-ink-950 leading-snug break-words">
              {grievance.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
              <Calendar size={13} className="shrink-0" />
              <span>Registered on {formatDate(grievance.createdAt)}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[calc(85vh-7rem)] sm:max-h-[calc(85vh-9rem)] overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6">
          {/* Progress Timeline */}
          <div className="rounded-lg border border-ink-200/90 bg-white p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-4">
              {t("timelineTitle")}
            </h3>
            <StatusTimeline status={grievance.state ?? grievance.status} />
          </div>

          {/* Description & Info Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600">
                Grievance Description
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-800 bg-ink-50/40 rounded-lg p-4 border border-ink-100">
                {grievance.description}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-ink-600">
              {!citizenView && (
              <div className="flex items-center gap-2 rounded-md border border-ink-100 bg-ink-50/50 p-3">
                <Building2 size={16} className="text-ink-400 shrink-0" />
                <div>
                  <span className="text-[11px] font-semibold text-ink-500 block uppercase tracking-wider">
                    Assigned Department
                  </span>
                  <span className="font-medium text-ink-900">
                    {grievance.departmentId || t(departmentKey(grievance.category))}
                  </span>
                </div>
              </div>
              )}

              {grievance.assignee && (
                <div className="flex items-center gap-2 rounded-md border border-ink-100 bg-ink-50/50 p-3">
                  <User size={16} className="text-ink-400 shrink-0" />
                  <div>
                    <span className="text-[11px] font-semibold text-ink-500 block uppercase tracking-wider">
                      Assigned Officer / Team
                    </span>
                    <span className="font-medium text-ink-900">
                      {grievance.assignee}
                    </span>
                  </div>
                </div>
              )}

              {grievance.dueDate && (
                <div className="flex items-center gap-2 rounded-md border border-ink-100 bg-ink-50/50 p-3">
                  <Clock size={16} className="text-ink-400 shrink-0" />
                  <div>
                    <span className="text-[11px] font-semibold text-ink-500 block uppercase tracking-wider">
                      Expected SLA Due Date
                    </span>
                    <span className="font-medium text-ink-900">
                      {formatDate(grievance.dueDate)}
                    </span>
                  </div>
                </div>
              )}

              {grievance.address && (
                <div className="flex items-center gap-2 rounded-md border border-ink-100 bg-ink-50/50 p-3 sm:col-span-2">
                  <MapPin size={16} className="text-primary-700 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-ink-500 block uppercase tracking-wider">
                      Recorded Address / Landmark
                    </span>
                    <span className="font-medium text-ink-900 truncate block">
                      {grievance.address}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location Pin & Map */}
          {grievance.latitude != null && grievance.longitude != null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
                  <MapPin size={14} className="text-primary-700" />
                  Pinned Incident Location
                </h3>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${grievance.latitude}&mlon=${grievance.longitude}#map=16/${grievance.latitude}/${grievance.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                >
                  <span>Open in OpenStreetMap</span>
                  <ExternalLink size={12} />
                </a>
              </div>
              <SinglePinMap
                latitude={grievance.latitude}
                longitude={grievance.longitude}
                title={grievance.title}
              />
            </div>
          )}

          {/* Attached Photo Evidence */}
          {grievance.imageUrl && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-2">
                Attached Photo Evidence
              </h3>
              <div className="overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={grievance.imageUrl}
                  alt="Citizen grievance evidence"
                  className="max-h-72 w-full object-contain bg-black/5"
                />
              </div>
            </div>
          )}

          {/* Activity / Field Updates History */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-2">
              Recent Officer & Field Updates
            </h3>
            {loadingHistory ? (
              <p className="text-xs text-ink-500 py-2">Loading updates…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-ink-500 italic py-2">
                No field updates posted yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {history.map((entry, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-ink-100 bg-ink-50/70 p-3 text-xs text-ink-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-900">
                        {String(entry.kind ?? "Update")}
                      </span>
                      <span className="text-[11px] text-ink-500">
                        {formatDate(String(entry.createdAt ?? entry.at ?? ""))}
                      </span>
                    </div>
                    <p className="mt-1 leading-relaxed text-ink-700">
                      {String(
                        entry.bodyCustomer ??
                          entry.workCompleted ??
                          entry.reason ??
                          "Status update recorded"
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Assessment / Triage Diagnostic */}
          {grievance.hfEngine && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-2">
                Automated Triage Diagnostic
              </h3>
              <AnalysisPanel hfEngine={grievance.hfEngine} citizenView={citizenView} />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-ink-100 bg-ink-50/50 px-4 py-3 sm:px-6 sm:py-3.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-md border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-ink-50 active:bg-ink-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
