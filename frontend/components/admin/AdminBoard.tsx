"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Feedback";
import { assignGrievance, listUsers, reassignGrievance, transitionGrievanceState } from "@/lib/api";
import { getSlaInfo } from "@/lib/sla";
import type { Grievance } from "@/lib/types";
import { GrievanceReviewModal } from "./GrievanceReviewModal";
import { useAdminGrievanceFeed } from "./useAdminGrievanceFeed";
import { useToast } from "@/components/ui/ToastProvider";
import { canonicalDepartmentId, DEPARTMENTS, getDepartmentLabel } from "@/lib/departments";

const DEPARTMENT_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All Departments" },
  ...DEPARTMENTS.map((d) => ({ key: d.key, label: d.label })),
];

const PAGE_SIZES = [5, 10, 20, 50];
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
type DepartmentEmployee = { id: string; full_name?: string; email?: string; role?: string; departmentId?: string; isActive?: boolean };

function asEpoch(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function timeAgo(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return "";
  }
}

function categoryLabel(category: string): string {
  return getDepartmentLabel(category);
}

function SlaCell({ grievance }: { grievance: Grievance }) {
  const sla = getSlaInfo(grievance);
  const tone =
    sla.state === "overdue"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : sla.state === "closed"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex w-fit items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
        <Clock size={11} />
        {sla.state === "overdue" ? "Overdue" : sla.state === "closed" ? "Closed" : "On Track"}
      </span>
      <span className="text-[10px] text-ink-400">{sla.label}</span>
    </div>
  );
}

export function AdminBoard() {
  const { items: feedItems, loading, error, live, user } = useAdminGrievanceFeed();
  const { notify } = useToast();
  const userRole = user?.role?.toUpperCase();
  const departmentId = user?.departmentId;
  const scopedDepartmentId = canonicalDepartmentId(departmentId);
  const isDepartmentManager = userRole === "ADMIN" && Boolean(scopedDepartmentId);
  const [overrides, setOverrides] = useState<Record<string, Partial<Grievance>>>({});
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
  // The API scopes this list to the authenticated manager's department.
  useEffect(() => { if (isDepartmentManager) void listUsers().then((rows) => setEmployees((rows as DepartmentEmployee[]).filter((row) => row.role === "RESOLVER" && row.isActive !== false))).catch(() => setEmployees([])); }, [isDepartmentManager]);

  // Filtering & Sorting
  const [queueTab, setQueueTab] = useState<"active" | "resolved">("active");
  const [selectedDeptTab, setSelectedDeptTab] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"urgency" | "newest" | "oldest">("urgency");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Review modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = useMemo(() => {
    const merged = feedItems.map((g) => (overrides[g.id] ? { ...g, ...overrides[g.id] } : g));
    if (!isDepartmentManager || !scopedDepartmentId) return merged;
    return merged.filter((g) => {
      const department = canonicalDepartmentId(g.departmentId ?? g.category);
      return department === scopedDepartmentId.toLowerCase();
    });
  }, [feedItems, overrides, isDepartmentManager, scopedDepartmentId]);

  const selected = useMemo(
    () => items.find((g) => g.id === selectedId) ?? null,
    [items, selectedId]
  );

  // Per-department ticket counts, surfaced as option labels in the queue filter
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const tab of DEPARTMENT_TABS) {
      if (tab.key !== "all") counts[tab.key] = 0;
    }
    items.forEach((g) => {
      const cat = canonicalDepartmentId(g.departmentId ?? g.category);
      if (counts[cat] !== undefined) counts[cat]++;
      else counts.other = (counts.other || 0) + 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((g) => {
      const p = (g.priority || "low").toLowerCase();
      const c = canonicalDepartmentId(g.departmentId ?? g.category);
      const s = (g.status || "open").toLowerCase();
      const isResolved = s === "resolved" || s === "closed";

      // Tab separation (DEC-051):
      // "active" queue hides resolved/closed; "resolved" archive shows only resolved/closed
      if (queueTab === "active" && isResolved) return false;
      if (queueTab === "resolved" && !isResolved) return false;

      if (selectedDeptTab !== "all" && c !== selectedDeptTab) return false;
      if (priorityFilter !== "all" && p !== priorityFilter) return false;
      if (statusFilter !== "all") {
        // "flagged" is a quality-gate filter, not a status value (DEC-049)
        if (statusFilter === "flagged") return g.qualityFlag === "suspicious";
        if (statusFilter === "open" && s !== "open" && s !== "submitted") return false;
        if (statusFilter !== "open" && s !== statusFilter) return false;
      }

      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q) ||
        (g.userId && g.userId.toLowerCase().includes(q))
      );
    });

    list = [...list].sort((a, b) => {
      if (queueTab === "resolved") {
        return asEpoch(b.resolvedAt || b.createdAt) - asEpoch(a.resolvedAt || a.createdAt);
      }
      if (sortBy === "urgency") {
        const uA = a.hfEngine?.isUrgent ? 1 : 0;
        const uB = b.hfEngine?.isUrgent ? 1 : 0;
        if (uA !== uB) return uB - uA;
        const pDiff = (PRIORITY_WEIGHT[b.priority] || 1) - (PRIORITY_WEIGHT[a.priority] || 1);
        if (pDiff !== 0) return pDiff;
        return asEpoch(b.createdAt) - asEpoch(a.createdAt);
      }
      if (sortBy === "newest") return asEpoch(b.createdAt) - asEpoch(a.createdAt);
      return asEpoch(a.createdAt) - asEpoch(b.createdAt);
    });

    return list;
  }, [items, queueTab, selectedDeptTab, priorityFilter, statusFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const stats = useMemo(() => {
    let urgentCount = 0;
    let unassigned = 0;
    let inProgress = 0;
    let resolved = 0;
    let flaggedCount = 0;

    items.forEach((g) => {
      const s = (g.status || "open").toLowerCase();
      if (g.qualityFlag === "suspicious") flaggedCount++;
      if (s === "resolved" || s === "closed") {
        resolved++;
      } else {
        if (g.hfEngine?.isUrgent || (g.priority || "").toLowerCase() === "high") urgentCount++;
        if (!g.assignee || s === "open" || s === "submitted") unassigned++;
        if (s === "in_progress" || s === "assigned") inProgress++;
      }
    });

    const activeCount = items.length - resolved;
    const resolutionRate = items.length > 0 ? Math.round((resolved / items.length) * 100) : 0;
    return { total: items.length, activeCount, urgentCount, unassigned, inProgress, resolved, resolutionRate, flaggedCount };
  }, [items]);

  function patchLocal(id: string, patch: Partial<Grievance>) {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleStatusTransition(status: string, assignedDept?: string) {
    if (!selected) return;
    const patch: { status: string; assignee?: string } = { status };
    if (assignedDept) patch.assignee = assignedDept;

    if (live) {
      if (status === "assigned" && assignedDept) {
        await assignGrievance(selected.id, { departmentId: assignedDept, reason: "Department assignment reviewed by admin" });
      } else {
        const reasons: Record<string, string> = {
          in_progress: "Officer started work",
          resolved: "Officer approved the submitted resolution",
          rejected: "Officer rejected the grievance",
        };
        await transitionGrievanceState(selected.id, {
          to_state: status.toUpperCase(),
          reason: reasons[status] || "Officer updated grievance state",
        });
      }
    }
    patchLocal(selected.id, {
      ...patch,
      state: status.toUpperCase(),
      status,
      ...(assignedDept ? { departmentId: assignedDept } : {}),
    });
    notify(status === "assigned" ? "Department assignment saved" : "Grievance updated", `${selected.id} status: ${status.replaceAll("_", " ")}.`);
  }

  async function handleEmployeeAssignment(employeeId: string) {
    if (!selected || !scopedDepartmentId) return;
    if (live) await reassignGrievance(selected.id, { ownerId: employeeId, departmentId: scopedDepartmentId, reason: "Department manager assigned task to employee" });
    const currentState = (selected.state ?? selected.status).toUpperCase();
    const newlyAssigned = currentState === "PENDING_ASSIGNMENT" || currentState === "SUBMITTED";
    patchLocal(selected.id, { ownerId: employeeId, state: newlyAssigned ? "ASSIGNED" : selected.state, status: newlyAssigned ? "ASSIGNED" : selected.status });
    notify("Task assigned", `${selected.id} was assigned to ${employees.find((employee) => employee.id === employeeId)?.full_name || "the selected employee"}.`);
  }

  return (
    <div className="space-y-6">
      {/* ── Executive Command Metrics Bar ─────────────────────────────── */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <button
          type="button"
          onClick={() => {
            setQueueTab("active");
            setPriorityFilter("all");
            setStatusFilter("all");
            setPage(1);
          }}
          className="text-left w-full transition focus:outline-none"
          title="View all active grievances"
        >
          <Card className={`border-ink-200/80 shadow-2xs transition hover:bg-ink-50/50 ${queueTab === "active" && priorityFilter === "all" && statusFilter === "all" ? "ring-2 ring-primary-500" : ""}`}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Total Grievances
                </span>
                <Layers size={16} className="text-ink-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950">{stats.total}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">{stats.activeCount} active · {stats.resolved} archived</p>
            </CardBody>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueTab("active");
            setPriorityFilter("high");
            setStatusFilter("all");
            setPage(1);
          }}
          className="text-left w-full transition focus:outline-none"
          title="Filter to high priority & urgent grievances"
        >
          <Card className={`border-rose-200/80 bg-rose-50/20 shadow-2xs transition hover:bg-rose-50/40 ${queueTab === "active" && priorityFilter === "high" ? "ring-2 ring-rose-500" : ""}`}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Urgent Attention
                </span>
                <AlertTriangle size={16} className="text-rose-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-rose-950">{stats.urgentCount}</p>
                {stats.urgentCount > 0 && (
                  <span className="rounded-sm bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold uppercase text-white animate-pulse">
                    Action Needed
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-rose-600">Needs a decision right away</p>
            </CardBody>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueTab("active");
            setPriorityFilter("all");
            setStatusFilter("open");
            setPage(1);
          }}
          className="text-left w-full transition focus:outline-none"
          title="Filter to unassigned complaints"
        >
          <Card className={`border-amber-200/80 bg-amber-50/20 shadow-2xs transition hover:bg-amber-50/40 ${queueTab === "active" && statusFilter === "open" ? "ring-2 ring-amber-500" : ""}`}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Unassigned
                </span>
                <Clock size={16} className="text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950">{stats.unassigned}</p>
              <p className="mt-0.5 text-[11px] text-amber-700">Waiting for a team to take charge</p>
            </CardBody>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueTab("active");
            setPriorityFilter("all");
            setStatusFilter("in_progress");
            setPage(1);
          }}
          className="text-left w-full transition focus:outline-none"
          title="Filter to work underway"
        >
          <Card className={`border-primary-200/80 bg-primary-50/20 shadow-2xs transition hover:bg-primary-50/40 ${queueTab === "active" && statusFilter === "in_progress" ? "ring-2 ring-primary-500" : ""}`}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-800">
                  Work Underway
                </span>
                <Wrench size={16} className="text-primary-700" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950">{stats.inProgress}</p>
              <p className="mt-0.5 text-[11px] text-primary-700">Repairs or checks happening now</p>
            </CardBody>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueTab("resolved");
            setPriorityFilter("all");
            setStatusFilter("all");
            setPage(1);
          }}
          className="text-left w-full transition focus:outline-none"
          title="Open the Resolved Archive tab"
        >
          <Card className={`border-emerald-200/80 bg-emerald-50/20 shadow-2xs transition hover:bg-emerald-50/40 ${queueTab === "resolved" ? "ring-2 ring-emerald-500" : ""}`}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                  Resolved
                </span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-emerald-950">{stats.resolved}</p>
                <span className="text-xs font-semibold text-emerald-700">({stats.resolutionRate}%)</span>
              </div>
              <p className="mt-0.5 text-[11px] text-emerald-700">Fixed &amp; archived (Click to view)</p>
            </CardBody>
          </Card>
        </button>

        {/* Flagged / suspicious (DEC-049) — clicking the card sets the filter */}
        <button
          type="button"
          onClick={() => {
            setQueueTab("active");
            setPriorityFilter("all");
            setStatusFilter(statusFilter === "flagged" ? "all" : "flagged");
            setPage(1);
          }}
          className="text-left w-full transition focus:outline-none"
          title="Click to filter by flagged complaints"
        >
          <Card className={`border-orange-300/80 bg-orange-50/30 shadow-2xs transition hover:bg-orange-50/60 ${queueTab === "active" && statusFilter === "flagged" ? "ring-2 ring-orange-500" : ""}`}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-800">
                  Flagged
                </span>
                <AlertTriangle size={16} className="text-orange-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-orange-950">{stats.flaggedCount}</p>
                {stats.flaggedCount > 0 && (
                  <span className="rounded-sm bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    Review
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-orange-700">Needs officer verification</p>
            </CardBody>
          </Card>
        </button>
      </div>

      {/* ── Search, Filters, and Sort Strip ───────────────────────────── */}
      <Card className="border-ink-200/80 shadow-2xs">
        <CardBody className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-600">
                Search complaints
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-ink-400" />
                <Input
                  placeholder="Search by ticket ID, keyword, or citizen"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 text-ink-400 hover:text-ink-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-600">
                Priority
              </label>
              <Select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-600">
                Status
              </label>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                {queueTab === "active" ? (
                  <>
                    <option value="all">All Active Statuses</option>
                    <option value="open">Open / Unassigned</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="flagged">Flagged for Review</option>
                  </>
                ) : (
                  <>
                    <option value="all">All in Archive</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </>
                )}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-600">
                Sort by
              </label>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "urgency" | "newest" | "oldest")}
              >
                <option value="urgency">Urgency &amp; Priority (Default)</option>
                <option value="newest">Newest Submissions First</option>
                <option value="oldest">Oldest Pending First</option>
              </Select>
            </div>
          </div>
        </CardBody>
      </Card>

      {loading && <Spinner label="Loading complaints…" />}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* ── Full-width Grievance Queue Table with Active & Archive Tabs ───────── */}
      <Card className="border-ink-200/80 shadow-2xs overflow-hidden">
        {/* Navigation Tabs (DEC-051) */}
        <div className="flex border-b border-ink-200 bg-ink-50/70 px-4 pt-2.5 sm:px-6 gap-2">
          <button
            type="button"
            onClick={() => {
              setQueueTab("active");
              setStatusFilter("all");
              setPage(1);
            }}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              queueTab === "active"
                ? "border-primary-600 text-primary-900 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-300"
            }`}
          >
            <Layers size={16} className={queueTab === "active" ? "text-primary-600" : "text-ink-500"} />
            <span>Active &amp; Priority Queue</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                queueTab === "active" ? "bg-primary-100 text-primary-800" : "bg-ink-200 text-ink-700"
              }`}
            >
              {stats.activeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setQueueTab("resolved");
              setStatusFilter("all");
              setPage(1);
            }}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              queueTab === "resolved"
                ? "border-emerald-600 text-emerald-900 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-300"
            }`}
          >
            <Archive size={16} className={queueTab === "resolved" ? "text-emerald-600" : "text-ink-500"} />
            <span>Resolved Archive</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                queueTab === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-ink-200 text-ink-700"
              }`}
            >
              {stats.resolved}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink-900">
              {queueTab === "active" ? "Active Grievance Queue" : "Resolved Grievance Archive"}
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              {selectedDeptTab === "all"
                ? (queueTab === "active" ? "All active departmental complaints · Urgent & high priority sorted first" : "All resolved and closed departmental records · Preserved for auditing")
                : `${DEPARTMENT_TABS.find((t) => t.key === selectedDeptTab)?.label} complaints (${queueTab === "active" ? "active" : "archived"})`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isDepartmentManager && (
              <div className="w-56">
                <label
                  htmlFor="queue-department-filter"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-600"
                >
                  Department
                </label>
                <Select
                  id="queue-department-filter"
                  value={selectedDeptTab}
                  onChange={(e) => {
                    setSelectedDeptTab(e.target.value);
                    setPage(1);
                  }}
                >
                  {DEPARTMENT_TABS.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label} ({deptCounts[key] ?? 0})
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <span className="self-end text-xs font-semibold text-ink-500">
              {filtered.length} ticket{filtered.length === 1 ? "" : "s"} · page {safePage} of {totalPages}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-6 py-3 font-semibold">Ticket</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Assigned to</th>
                <th className="px-4 py-3 font-semibold">Due by</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Waiting</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((g) => {
                const isUrgent =
                  g.hfEngine?.isUrgent || (g.priority || "").toLowerCase() === "high";
                return (
                  <tr
                    key={g.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(g.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(g.id);
                      }
                    }}
                    className="cursor-pointer border-b border-ink-100 transition-colors last:border-b-0 hover:bg-primary-50/40 focus:bg-primary-50/40 focus:outline-none"
                  >
                    <td className="max-w-xs px-6 py-3.5">
                      <div className="flex items-start gap-2">
                        {isUrgent && (
                          <span
                            title="Urgent ticket"
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-600 animate-pulse"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">{g.title}</p>
                          <p className="mt-0.5 font-mono text-[10px] font-medium text-ink-400">
                            {g.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-ink-600">
                      {categoryLabel(g.category)}
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={g.priority} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={g.status} />
                        {g.qualityFlag === "suspicious" && (
                          <span
                            title={g.qualityReason ? `AI Flag: ${g.qualityReason}` : "Flagged for review (potential non-civic complaint)"}
                            className="inline-flex w-fit items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                          >
                            <AlertTriangle size={10} className="text-amber-600" />
                            Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden max-w-[180px] truncate px-4 py-3.5 text-xs text-ink-600 lg:table-cell">
                      {g.assignee || <span className="text-ink-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <SlaCell grievance={g} />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3.5 text-xs text-ink-500 sm:table-cell">
                      {timeAgo(g.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-ink-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-ink-700">
                      {queueTab === "active" ? "No active grievances found" : "No resolved grievances in archive"}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {queueTab === "active"
                        ? "Try adjusting your filters or department selection."
                        : "Complaints marked resolved or closed will be safely archived here."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-6 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-ink-500">Rows per page:</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 10);
                setPage(1);
              }}
              className="w-18 py-1 text-xs"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </Button>
            <span className="px-2 font-medium text-ink-600">
              {safePage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <GrievanceReviewModal
        key={selected?.id ?? "none"}
        grievance={selected}
        onClose={() => setSelectedId(null)}
        onStatusTransition={handleStatusTransition}
        departmentManager={isDepartmentManager}
        employees={employees}
        onEmployeeAssign={isDepartmentManager ? handleEmployeeAssignment : undefined}
      />
    </div>
  );
}
