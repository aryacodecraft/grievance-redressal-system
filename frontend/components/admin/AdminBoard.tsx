"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
import { assignGrievance, listUsers, reassignGrievance, transitionGrievanceState, updateGrievanceStatus } from "@/lib/api";
import { getSlaInfo } from "@/lib/sla";
import type { Grievance } from "@/lib/types";
import { GrievanceReviewModal } from "./GrievanceReviewModal";
import { useAdminGrievanceFeed } from "./useAdminGrievanceFeed";
import { useToast } from "@/components/ui/ToastProvider";
import { canonicalDepartmentId } from "@/lib/departments";

const DEPARTMENT_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All Departments" },
  { key: "water", label: "Water Supply" },
  { key: "roads", label: "Roads & Transport" },
  { key: "electricity", label: "Electricity" },
  { key: "sanitation", label: "Sanitation" },
  { key: "health", label: "Health Services" },
  { key: "governance", label: "Governance" },
  { key: "other", label: "Other" },
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
  const key = (category || "other").toLowerCase();
  const tab = DEPARTMENT_TABS.find((t) => t.key === key);
  if (tab) return tab.label;
  return key.charAt(0).toUpperCase() + key.slice(1);
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
      const cat = (g.category || "other").toLowerCase();
      if (counts[cat] !== undefined) counts[cat]++;
      else counts.other = (counts.other || 0) + 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((g) => {
      const p = (g.priority || "low").toLowerCase();
      const c = (g.category || "other").toLowerCase();
      const s = (g.status || "open").toLowerCase();

      if (selectedDeptTab !== "all" && c !== selectedDeptTab) return false;
      if (priorityFilter !== "all" && p !== priorityFilter) return false;
      if (statusFilter !== "all") {
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
  }, [items, selectedDeptTab, priorityFilter, statusFilter, search, sortBy]);

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

    items.forEach((g) => {
      const s = (g.status || "open").toLowerCase();
      if (s === "resolved" || s === "closed") {
        resolved++;
      } else {
        if (g.hfEngine?.isUrgent || (g.priority || "").toLowerCase() === "high") urgentCount++;
        if (!g.assignee || s === "open" || s === "submitted") unassigned++;
        if (s === "in_progress" || s === "assigned") inProgress++;
      }
    });

    const resolutionRate = items.length > 0 ? Math.round((resolved / items.length) * 100) : 0;
    return { total: items.length, urgentCount, unassigned, inProgress, resolved, resolutionRate };
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
      } else if (status === "in_progress") {
        await transitionGrievanceState(selected.id, { to_state: "IN_PROGRESS", reason: "Officer started work" });
      } else if (status === "resolved") {
        await transitionGrievanceState(selected.id, { to_state: "RESOLVED", reason: "Officer marked resolved" });
      } else {
        await updateGrievanceStatus(selected.id, patch);
      }
    }
    patchLocal(selected.id, patch);
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
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-ink-200/80 shadow-2xs">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Total Grievances
              </span>
              <Layers size={16} className="text-ink-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950">{stats.total}</p>
            <p className="mt-0.5 text-[11px] text-ink-400">Received in total</p>
          </CardBody>
        </Card>

        <Card className="border-rose-200/80 bg-rose-50/20 shadow-2xs">
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

        <Card className="border-amber-200/80 bg-amber-50/20 shadow-2xs">
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

        <Card className="border-primary-200/80 bg-primary-50/20 shadow-2xs">
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

        <Card className="border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
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
            <p className="mt-0.5 text-[11px] text-emerald-700">              Fixed and closed
            </p>
          </CardBody>
        </Card>
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
                <option value="all">All Statuses</option>
                <option value="open">Open / Unassigned</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
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

      {/* ── Full-width Grievance Queue Table ──────────────────────────── */}
      <Card className="border-ink-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink-900">Grievance Queue</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              {selectedDeptTab === "all"
                ? "All departments combined"
                : `${DEPARTMENT_TABS.find((t) => t.key === selectedDeptTab)?.label} complaints`}
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
                      <StatusBadge status={g.status} />
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
                    <p className="text-sm font-semibold text-ink-700">No grievances found</p>
                    <p className="mt-1 text-xs text-ink-400">
                      Try adjusting your filters or department selection.
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
