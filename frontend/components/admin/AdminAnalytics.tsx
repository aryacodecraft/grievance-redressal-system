"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Feedback";
import { AdminCharts } from "@/components/charts/AdminCharts";
import { groupSimilarComplaints } from "@/lib/tfidf";
import { getSlaInfo } from "@/lib/sla";
import type { Grievance } from "@/lib/types";
import { AdminClusters } from "./AdminClusters";
import { AdminAreaClusters, buildAreaClusters } from "./AdminAreaClusters";
import { AdminMap } from "./AdminMap";
import { useAdminGrievanceFeed } from "./useAdminGrievanceFeed";
import { useClusterLocations } from "./useClusterLocations";
import { canonicalDepartmentId } from "@/lib/departments";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(items: Grievance[]): string {
  const headers = [
    "Ticket ID",
    "Title",
    "Department",
    "Priority",
    "Status",
    "Assignee",
    "Created At",
    "Location",
    "Deadline State",
    "Deadline",
  ];    const rows = items.map((g) => {
      const sla = getSlaInfo(g);
      return [
        g.id,
        g.title,
        g.category,
        g.priority,
        g.status,
        g.assignee ?? "",
        g.createdAt,
        g.latitude != null && g.longitude != null ? "Pinned location (see map)" : "",
        sla.state,
        sla.dueAt.toISOString(),
      ]
        .map(csvEscape)
        .join(",");
    });
  return [headers.join(","), ...rows].join("\n");
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: string;
  Icon: typeof Layers;
}) {
  return (
    <Card className={`${tone} shadow-2xs`}>
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            {label}
          </span>
          <Icon size={16} className="text-ink-400" />
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950">{value}</p>
        <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>
      </CardBody>
    </Card>
  );
}

/**
 * Executive analytics & oversight dashboard (`/admin/analytics`).
 * Houses macro metrics, distribution charts, similar-complaint groups,
 * the spatial grievance map, and CSV report export.
 */
export function AdminAnalytics() {
  const { items: feedItems, loading, error, user } = useAdminGrievanceFeed();
  const userRole = user?.role?.toUpperCase();
  const departmentId = user?.departmentId;
  const scopedDepartmentId = canonicalDepartmentId(departmentId);
  const isDepartmentManager = userRole === "ADMIN" && Boolean(scopedDepartmentId);
  const items = useMemo(() => {
    if (!isDepartmentManager || !scopedDepartmentId) return feedItems;
    return feedItems.filter((g) => {
      const department = canonicalDepartmentId(g.departmentId ?? g.category);
      return department === scopedDepartmentId.toLowerCase();
    });
  }, [feedItems, isDepartmentManager, scopedDepartmentId]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);

  const clusters = useMemo(() => groupSimilarComplaints(items), [items]);
  const clusterLocations = useClusterLocations(items, clusters);
  const areaClusters = useMemo(() => buildAreaClusters(items), [items]);

  const macro = useMemo(() => {
    let resolved = 0;
    let urgent = 0;
    let overdue = 0;
    items.forEach((g) => {
      const s = (g.status || "open").toLowerCase();
      if (s === "resolved" || s === "closed") resolved++;
      else {
        if (g.hfEngine?.isUrgent || (g.priority || "").toLowerCase() === "high") urgent++;
        if (getSlaInfo(g).state === "overdue") overdue++;
      }
    });
    return { total: items.length, resolved, urgent, overdue };
  }, [items]);

  // Stable handler so AdminMap's focus effect never loops.
  const handleFocusHandled = useCallback(() => {}, []);

  function exportCsv() {
    const csv = buildCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `grievance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-700">
            Executive Analytics &amp; Oversight
          </h2>
          <p className="text-xs text-ink-500">
            {isDepartmentManager ? `Complaint patterns and workload for ${user?.departmentId ?? "your department"}.` : "Macro metrics, complaint patterns, and where problems are happening — across all areas."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={items.length === 0}
          className="flex items-center gap-1.5"
        >
          <Download size={14} />
          Export CSV Report
        </Button>
      </div>

      {loading && <Spinner label="Gathering complaint numbers…" />}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* Macro metrics */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Complaints"
          value={macro.total}
          hint="All complaints received"
          tone="border-ink-200/80"
          Icon={Layers}
        />
        <MetricCard
          label="Resolved"
          value={macro.resolved}
          hint="Verified and closed"
          tone="border-emerald-200/80 bg-emerald-50/20"
          Icon={CheckCircle2}
        />
        <MetricCard
          label="Urgent"
          value={macro.urgent}
          hint="Active high-priority cases"
          tone="border-rose-200/80 bg-rose-50/20"
          Icon={AlertTriangle}
        />
        <MetricCard
          label="Past Deadline"
          value={macro.overdue}
          hint="Still open, but past the fix-by date"
          tone="border-amber-200/80 bg-amber-50/20"
          Icon={Clock}
        />
      </div>

      {/* Distribution charts */}
      <AdminCharts items={items} />

      <div className="space-y-4 border-t border-ink-100 pt-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-700">Spatial analysis</h3>
          <p className="text-xs text-ink-500">Explore complaint locations and identify geographic hotspots.</p>
        </div>

      {/* Map of complaint locations */}
      <Card className="border-ink-200/80 shadow-2xs">
        <CardHeader
          title="Complaint Locations"
          subtitle={`${items.filter((g) => g.latitude != null && g.longitude != null).length} complaints with a pinned spot on the map`}
        />
        <CardBody className="p-3">
          <AdminMap
            items={items}
            focusId={null}
            onFocusHandled={handleFocusHandled}
            heightClassName="h-[24rem] sm:h-[30rem] lg:h-[34rem]"
          />
        </CardBody>
      </Card>

      <AdminAreaClusters clusters={areaClusters} />
      </div>

      {/* Similarity is a cross-queue analysis; department managers only need
          their operational metrics, map, and hotspot view. */}
      {!isDepartmentManager && <AdminClusters
        clusters={clusters}
        activeClusterId={activeClusterId}
        onSelect={(id) => setActiveClusterId(id)}
        onClear={() => setActiveClusterId(null)}
        locations={clusterLocations}
      />}
    </div>
  );
}
