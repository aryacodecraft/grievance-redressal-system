"use client";

import { useEffect, useMemo, useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { AnalysisPanel } from "@/components/grievance/GrievanceCard";
import { AdminClusters } from "./AdminClusters";
import { AdminMap } from "./AdminMap";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import { subscribeGrievances } from "@/lib/grievances";
import { runTfidf } from "@/lib/tfidf";
import { updateGrievanceStatus } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import { CATEGORIES, type Grievance } from "@/lib/types";

const DEPARTMENTS = [
  "Roads Division — Zone 3",
  "Water Supply Board — Sector 12",
  "Power Utility — North Circle",
  "Sanitation Dept — Ward 7",
];

const PAGE_SIZES = [5, 10, 20, 50];
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

function asEpoch(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminBoard() {
  const { user, liveMode } = useDemoUser();
  const live = Boolean(user && liveMode);

  const [liveItems, setLiveItems] = useState<Grievance[] | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, Partial<Grievance>>
  >({});

  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [clusterIds, setClusterIds] = useState<Set<string> | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState(DEPARTMENTS[0]);
  const [decision, setDecision] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!live || !user) return;
    const unsub = subscribeGrievances(
      user.id,
      user.email,
      (data) => {
        setLiveItems(data);
        setLiveError(null);
      },
      (message) => {
        setLiveError(message);
        setLiveItems(null);
      }
    );
    return unsub;
  }, [live, user]);

  const base = live ? liveItems : MOCK_GRIEVANCES;
  const items = useMemo(
    () =>
      (base ?? []).map((g) =>
        overrides[g.id] ? { ...g, ...overrides[g.id] } : g
      ),
    [base, overrides]
  );

  const loading = live && liveItems === null && !liveError;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((g) => {
      const p = (g.priority || "low").toLowerCase();
      const c = (g.category || "other").toLowerCase();
      const s = (g.status || "open").toLowerCase();
      if (priorityFilter !== "all" && p !== priorityFilter) return false;
      if (categoryFilter !== "all" && c !== categoryFilter) return false;
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (q) {
        const blob = `${g.title || ""} ${g.description || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    if (clusterIds && clusterIds.size) {
      list = list.filter((g) => clusterIds.has(g.id));
    }

    return list.slice().sort((a, b) => {
      const ta = asEpoch(a.createdAt);
      const tb = asEpoch(b.createdAt);
      if (ta !== tb) return tb - ta;
      const pa = PRIORITY_WEIGHT[(a.priority || "low").toLowerCase()] ?? 1;
      const pb = PRIORITY_WEIGHT[(b.priority || "low").toLowerCase()] ?? 1;
      if (pa !== pb) return pb - pa;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [items, priorityFilter, categoryFilter, statusFilter, search, clusterIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const pageNumbers = useMemo(() => {
    const maxButtons = Math.min(7, totalPages);
    const start = Math.max(1, safePage - 3);
    const end = Math.min(totalPages, start + maxButtons - 1);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [safePage, totalPages]);

  const stats = useMemo(() => {
    let highOpen = 0;
    let medOpen = 0;
    let resolved = 0;
    items.forEach((g) => {
      const s = (g.status || "open").toLowerCase();
      const p = (g.priority || "low").toLowerCase();
      if (s === "resolved") resolved++;
      else {
        if (p === "high") highOpen++;
        if (p === "medium") medOpen++;
      }
    });
    return { total: items.length, highOpen, medOpen, resolved };
  }, [items]);

  const clusters = useMemo(() => runTfidf(items), [items]);

  const selected: Grievance | undefined =
    items.find((g) => g.id === selectedId) ?? filtered[0] ?? items[0];

  function applyCluster(clusterId: string) {
    const cluster = clusters.find((c) => c.clusterId === clusterId);
    if (!cluster) return;
    const ids = new Set(
      cluster.ids
        .map((i) => items[i]?.id)
        .filter((v): v is string => Boolean(v))
    );
    setClusterIds(ids);
    setActiveClusterId(clusterId);
    setPage(1);
  }

  function clearCluster() {
    setClusterIds(null);
    setActiveClusterId(null);
    setPage(1);
  }

  function patchLocal(id: string, patch: Partial<Grievance>) {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function markResolved(id: string) {
    if (live) {
      try {
        await updateGrievanceStatus(id, { status: "resolved" });
      } catch (err) {
        setLiveError(
          err instanceof Error ? err.message : "Failed to update status."
        );
        return;
      }
    }
    patchLocal(id, { status: "resolved" });
    setDecision(`Marked ${id} as resolved.`);
  }

  async function assign(kind: "approve" | "override") {
    if (!selected) return;
    const label = kind === "approve" ? "Approved" : "Overridden";
    const verb = kind === "approve" ? "assigned" : "reassigned";
    if (live) {
      try {
        await updateGrievanceStatus(selected.id, {
          status: "assigned",
          assignee,
        });
      } catch (err) {
        setLiveError(err instanceof Error ? err.message : "Assignment failed.");
        return;
      }
    }
    patchLocal(selected.id, { status: "assigned", assignee });
    setDecision(`${label}: ${selected.id} ${verb} to ${assignee}.`);
  }

  const statCards: [string, number][] = [
    ["Total grievances", stats.total],
    ["High priority open", stats.highOpen],
    ["Medium priority open", stats.medOpen],
    ["Resolved", stats.resolved],
  ];

  return (
    <div className="space-y-6">
      {!live && (
        <Alert>
          Showing demo data. Start the backend and set{" "}
          <span className="font-mono">NEXT_PUBLIC_USE_MOCKS=false</span> to
          review live grievances.
        </Alert>
      )}
      {liveError && <Alert tone="error">Live data failed: {liveError}</Alert>}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-2xl font-bold text-ink-900">{value}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-ink-500">
                {label}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Priority">
            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="high">High only</option>
              <option value="medium">Medium only</option>
              <option value="low">Low only</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </Select>
          </Field>
          <Field label="Search">
            <Input
              placeholder="Search title/description…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Map */}
      <Card>
        <CardHeader
          title="Map"
          subtitle="Markers reflect current filters"
        />
        <CardBody>
          <AdminMap
            items={filtered}
            focusId={focusId}
            onFocusHandled={() => setFocusId(null)}
          />
        </CardBody>
      </Card>

      {loading && <Spinner label="Loading live grievances…" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Queue */}
        <Card>
          <CardHeader
            title="Grievance queue"
            subtitle={live ? "Live from the API." : "Demo data."}
            action={
              <span className="whitespace-nowrap text-xs text-ink-500">
                {filtered.length} item{filtered.length === 1 ? "" : "s"} · page{" "}
                {safePage} of {totalPages}
              </span>
            }
          />
          <CardBody className="space-y-3">
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {pageItems.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedId(g.id);
                    setDecision(null);
                  }}
                  className={
                    g.id === selected?.id
                      ? "w-full rounded-md border border-primary-600 bg-primary-50 p-3 text-left"
                      : "w-full rounded-md border border-ink-200 p-3 text-left hover:border-primary-400"
                  }
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-900">
                      {g.title}
                    </span>
                    <span className="font-mono text-[11px] text-ink-400">
                      {g.id}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={g.status} />
                    <PriorityBadge priority={g.priority} />
                    {g.hfEngine?.isUrgent && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Urgent
                      </span>
                    )}
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
                      {g.category}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-400">
                    <span>Created: {formatDateTime(g.createdAt)}</span>
                    <span>User: {g.userId || "—"}</span>
                  </span>
                </button>
              ))}
              {pageItems.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-500">
                  No grievances match these filters.
                </p>
              )}
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-700">
                Page size
              </label>
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 10);
                  setPage(1);
                }}
                className="w-20"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Prev
                </Button>
                {pageNumbers.map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={n === safePage ? "primary" : "outline"}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
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
          </CardBody>
        </Card>

        {/* Detail + actions */}
        <Card>
          <CardHeader
            title="Review & action"
            subtitle="AI recommends — the officer decides."
          />
          <CardBody className="space-y-4">
            {!selected && (
              <p className="text-sm text-ink-500">
                Select a grievance from the queue.
              </p>
            )}
            {selected && (
              <>
                <div>
                  <p className="text-base font-semibold text-ink-900">
                    {selected.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">
                    {selected.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-ink-600">
                  <p>
                    <span className="font-semibold text-ink-700">Created:</span>{" "}
                    {formatDateTime(selected.createdAt)}
                  </p>
                  <p>
                    <span className="font-semibold text-ink-700">User:</span>{" "}
                    {selected.userId || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-ink-700">Lat/Lon:</span>{" "}
                    {selected.latitude != null && selected.longitude != null
                      ? `${Number(selected.latitude).toFixed(6)}, ${Number(
                          selected.longitude
                        ).toFixed(6)}`
                      : "Not provided"}
                  </p>
                  <p>
                    <span className="font-semibold text-ink-700">
                      Assignee:
                    </span>{" "}
                    {selected.assignee || "—"}
                  </p>
                </div>

                {selected.imageUrl && (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.imageUrl}
                      alt="Grievance evidence"
                      className="max-h-48 rounded-md border border-ink-200 object-contain"
                    />
                    <a
                      href={selected.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary-700 underline"
                    >
                      Open original
                    </a>
                  </div>
                )}

                {selected.hfEngine && (
                  <AnalysisPanel hfEngine={selected.hfEngine} />
                )}

                <Field label="Assign to department">
                  <Select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>

                {decision && <Alert>{decision}</Alert>}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void assign("approve")}>
                    Approve assignment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void assign("override")}
                  >
                    Override
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      selected.status.toLowerCase() === "resolved"
                    }
                    onClick={() => void markResolved(selected.id)}
                  >
                    Mark Resolved
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={
                      selected.latitude == null || selected.longitude == null
                    }
                    onClick={() => setFocusId(selected.id)}
                  >
                    Open on Map
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <AdminClusters
        clusters={clusters}
        activeClusterId={activeClusterId}
        onSelect={applyCluster}
        onClear={clearCluster}
      />
    </div>
  );
}
