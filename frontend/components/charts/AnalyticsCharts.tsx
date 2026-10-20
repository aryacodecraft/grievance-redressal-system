"use client";

/**
 * AnalyticsCharts — comprehensive, reliable executive analytics charts (DEC-054).
 *
 * All metrics derive dynamically from the active grievance feed (`items`),
 * ensuring instant responsiveness, zero network lag, and full resilience across
 * live, demo, and department-scoped modes.
 *
 * Charts included:
 * 1. ComplaintTrendsChart       — AreaChart: received vs resolved over time (daily/weekly/monthly, date filters)
 * 2. DepartmentPerformanceChart — Grouped BarChart: received, open, resolved, overdue per department
 * 3. ResolutionSlaPanel         — Executive KPI strip (median/mean days, SLA compliance %) + department table
 * 4. ComplaintAgingChart        — BarChart: unresolved complaints by age (0–2, 3–7, 8–14, 15+ days)
 * 5. PriorityDistributionChart  — BarChart: stored priority values by status (low, medium, high, urgent)
 */

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Clock } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { canonicalDepartmentId, getDepartmentLabel } from "@/lib/departments";
import { getSlaInfo } from "@/lib/sla";
import type { Grievance } from "@/lib/types";

// ── Colors ───────────────────────────────────────────────────────────────────
const C_RECEIVED = "#ff5500"; // SAMARTH primary orange
const C_RESOLVED = "#16a34a"; // emerald green
const C_OPEN     = "#f97316"; // amber-orange
const C_OVERDUE  = "#dc2626"; // red

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:   "#94a3b8",
  ASSIGNED:    "#3b82f6",
  IN_PROGRESS: "#f97316",
  RESOLVED:    "#16a34a",
  CLOSED:      "#052e16",
  ESCALATED:   "#7c3aed",
  REJECTED:    "#ef4444",
  WITHDRAWN:   "#6b7280",
};

type RangeKey = "7d" | "30d" | "90d" | "all";

function getCutoffTimestamp(range: RangeKey): number {
  if (range === "all") return 0;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * 86_400_000;
}

function filterByRange(items: Grievance[], range: RangeKey): Grievance[] {
  if (range === "all") return items;
  const cutoff = getCutoffTimestamp(range);
  return items.filter((g) => {
    const t = g.createdAt ? new Date(g.createdAt).getTime() : 0;
    return t >= cutoff;
  });
}

function getReferenceTimestamp(): number {
  return Date.now();
}

function truncateDate(dateStr: string, granularity: "daily" | "weekly" | "monthly"): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    if (granularity === "daily") return `${y}-${m}-${day}`;
    if (granularity === "monthly") return `${y}-${m}`;

    // ISO week
    const firstDayOfYear = new Date(y, 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  } catch {
    return dateStr.slice(0, 10);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  1. Complaint Trends (AreaChart)
// ══════════════════════════════════════════════════════════════════════════════

export function ComplaintTrendsChart({ items }: { items: Grievance[] }) {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [range, setRange] = useState<RangeKey>("30d");

  const chartData = useMemo(() => {
    const filtered = filterByRange(items, range);
    const receivedMap: Record<string, number> = {};
    const resolvedMap: Record<string, number> = {};

    filtered.forEach((g) => {
      if (g.createdAt) {
        const key = truncateDate(g.createdAt, granularity);
        receivedMap[key] = (receivedMap[key] ?? 0) + 1;
      }
      const st = (g.status || "").toLowerCase();
      if (st === "resolved" || st === "closed") {
        const resDate = g.resolvedAt || g.closedAt || g.createdAt;
        if (resDate) {
          const key = truncateDate(resDate, granularity);
          resolvedMap[key] = (resolvedMap[key] ?? 0) + 1;
        }
      }
    });

    const allKeys = Array.from(new Set([...Object.keys(receivedMap), ...Object.keys(resolvedMap)])).sort();
    return allKeys.map((k) => ({
      date: k,
      received: receivedMap[k] ?? 0,
      resolved: resolvedMap[k] ?? 0,
    }));
  }, [items, range, granularity]);

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Complaint Trends"
        subtitle="Complaints received and resolved over time"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="trends-range">Date range</label>
            <Select
              id="trends-range"
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </Select>
            <label className="sr-only" htmlFor="trends-gran">Granularity</label>
            <Select
              id="trends-gran"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as "daily" | "weekly" | "monthly")}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>
        }
      />
      <CardBody className="p-4 sm:p-5">
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-ink-400">
            No complaints recorded for this period.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="trendGradReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C_RECEIVED} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C_RECEIVED} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trendGradResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C_RESOLVED} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C_RESOLVED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                  formatter={(val, name) => [Number(val ?? 0), String(name) === "received" ? "Received" : "Resolved"]}
                />
                <Legend
                  formatter={(v) => (v === "received" ? "Received" : "Resolved")}
                  wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke={C_RECEIVED}
                  strokeWidth={2}
                  fill="url(#trendGradReceived)"
                  dot={{ r: 3, fill: C_RECEIVED }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke={C_RESOLVED}
                  strokeWidth={2}
                  fill="url(#trendGradResolved)"
                  dot={{ r: 3, fill: C_RESOLVED }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  2. Department Performance (Grouped BarChart)
// ══════════════════════════════════════════════════════════════════════════════

export function DepartmentPerformanceChart({ items }: { items: Grievance[] }) {
  const [range, setRange] = useState<RangeKey>("all");

  const chartData = useMemo(() => {
    const filtered = filterByRange(items, range);
    const stats: Record<string, { received: number; open: number; resolved: number; overdue: number }> = {};

    filtered.forEach((g) => {
      const dept = canonicalDepartmentId(g.departmentId ?? g.category);
      if (!stats[dept]) stats[dept] = { received: 0, open: 0, resolved: 0, overdue: 0 };
      stats[dept].received++;

      const st = (g.status || "").toLowerCase();
      if (st === "resolved" || st === "closed") {
        stats[dept].resolved++;
      } else {
        stats[dept].open++;
        if (getSlaInfo(g).state === "overdue") {
          stats[dept].overdue++;
        }
      }
    });

    return Object.entries(stats)
      .map(([dept, s]) => ({
        name: getDepartmentLabel(dept, true),
        Received: s.received,
        Open: s.open,
        Resolved: s.resolved,
        Overdue: s.overdue,
      }))
      .sort((a, b) => b.Received - a.Received);
  }, [items, range]);

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Department Performance"
        subtitle="Received, open, resolved, and overdue complaints per department"
        action={
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
        }
      />
      <CardBody className="p-4 sm:p-5">
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-ink-400">
            No department data available.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 36, left: -10 }}
                barCategoryGap="25%"
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                <Bar dataKey="Received" fill={C_RECEIVED} radius={[3, 3, 0, 0]} maxBarSize={16} />
                <Bar dataKey="Open"     fill={C_OPEN}     radius={[3, 3, 0, 0]} maxBarSize={16} />
                <Bar dataKey="Resolved" fill={C_RESOLVED} radius={[3, 3, 0, 0]} maxBarSize={16} />
                <Bar dataKey="Overdue"  fill={C_OVERDUE}  radius={[3, 3, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  3. Resolution Time & SLA Compliance
// ══════════════════════════════════════════════════════════════════════════════

export function ResolutionSlaPanel({ items }: { items: Grievance[] }) {
  const [range, setRange] = useState<RangeKey>("all");

  const metrics = useMemo(() => {
    const filtered = filterByRange(items, range);
    const resolvedItems = filtered.filter((g) => {
      const s = (g.status || "").toLowerCase();
      return s === "resolved" || s === "closed";
    });

    const resolutionDays: number[] = [];
    let withinSlaCount = 0;
    let dueCount = 0;

    const deptMap: Record<string, { count: number; days: number[]; withinSla: number; hasDue: number }> = {};

    resolvedItems.forEach((g) => {
      const dept = canonicalDepartmentId(g.departmentId ?? g.category);
      if (!deptMap[dept]) deptMap[dept] = { count: 0, days: [], withinSla: 0, hasDue: 0 };
      deptMap[dept].count++;

      // Compute resolution days if timestamps exist
      if (g.createdAt) {
        const refTime = getReferenceTimestamp();
        const end = g.resolvedAt ? new Date(g.resolvedAt).getTime() : refTime;
        const start = new Date(g.createdAt).getTime();
        const d = Math.max(0.1, (end - start) / 86400000);
        resolutionDays.push(d);
        deptMap[dept].days.push(d);
      }

      // Compute SLA compliance if dueDate was established
      if (g.dueDate) {
        dueCount++;
        deptMap[dept].hasDue++;
        const dueTime = new Date(g.dueDate).getTime();
        const refTime = getReferenceTimestamp();
        const resolvedTime = g.resolvedAt ? new Date(g.resolvedAt).getTime() : refTime;
        if (resolvedTime <= dueTime) {
          withinSlaCount++;
          deptMap[dept].withinSla++;
        }
      }
    });

    resolutionDays.sort((a, b) => a - b);
    const mean = resolutionDays.length ? resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length : null;
    const median = resolutionDays.length
      ? resolutionDays[Math.floor(resolutionDays.length / 2)]
      : null;

    const slaPct = dueCount > 0 ? (withinSlaCount / dueCount) * 100 : null;

    const byDept = Object.entries(deptMap)
      .map(([dept, data]) => {
        const dMean = data.days.length ? data.days.reduce((a, b) => a + b, 0) / data.days.length : null;
        return {
          dept,
          count: data.count,
          meanDays: dMean != null ? dMean.toFixed(1) : "—",
          slaPct: data.hasDue > 0 ? `${((data.withinSla / data.hasDue) * 100).toFixed(0)}%` : "—",
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalResolved: resolvedItems.length,
      meanDays: mean != null ? mean.toFixed(1) : "—",
      medianDays: median != null ? median.toFixed(1) : "—",
      slaPct: slaPct != null ? `${slaPct.toFixed(0)}%` : "—",
      byDept,
    };
  }, [items, range]);

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Resolution Time & SLA"
        subtitle="Resolution speed and SLA adherence for closed cases"
        action={
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
        }
      />
      <CardBody className="p-4 sm:p-5 space-y-4">
        {/* KPI stat chips */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <Clock size={13} className="text-primary-600" /> Median Resolution
            </span>
            <p className="mt-1 text-2xl font-bold text-ink-950">
              {metrics.medianDays} <span className="text-xs font-normal text-ink-500">days</span>
            </p>
          </div>

          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <Clock size={13} className="text-primary-600" /> Mean Resolution
            </span>
            <p className="mt-1 text-2xl font-bold text-ink-950">
              {metrics.meanDays} <span className="text-xs font-normal text-ink-500">days</span>
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              <CheckCircle2 size={13} className="text-emerald-600" /> SLA Compliance
            </span>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {metrics.slaPct}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-ink-400 italic">
          SLA compliance is evaluated on complaints assigned a target due date.
        </p>

        {metrics.byDept.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="pb-1.5 text-left font-semibold">Department</th>
                  <th className="pb-1.5 text-right font-semibold">Resolved</th>
                  <th className="pb-1.5 text-right font-semibold">Avg Days</th>
                  <th className="pb-1.5 text-right font-semibold">SLA Adherence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {metrics.byDept.map((row) => (
                  <tr key={row.dept}>
                    <td className="py-1.5 font-medium text-ink-800">{getDepartmentLabel(row.dept, true)}</td>
                    <td className="py-1.5 text-right text-ink-600">{row.count}</td>
                    <td className="py-1.5 text-right text-ink-600">{row.meanDays} d</td>
                    <td className="py-1.5 text-right font-semibold text-emerald-700">{row.slaPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  4. Complaint Aging (BarChart)
// ══════════════════════════════════════════════════════════════════════════════

export function ComplaintAgingChart({ items }: { items: Grievance[] }) {
  const agingData = useMemo(() => {
    const active = items.filter((g) => {
      const s = (g.status || "").toLowerCase();
      return s !== "resolved" && s !== "closed" && s !== "rejected" && s !== "withdrawn";
    });

    const counts = [0, 0, 0, 0]; // 0-2, 3-7, 8-14, 15+
    const refNow = getReferenceTimestamp();

    active.forEach((g) => {
      const created = g.createdAt ? new Date(g.createdAt).getTime() : refNow;
      const ageDays = Math.max(0, (refNow - created) / 86400000);
      if (ageDays <= 2) counts[0]++;
      else if (ageDays <= 7) counts[1]++;
      else if (ageDays <= 14) counts[2]++;
      else counts[3]++;
    });

    return [
      { label: "0–2 days", count: counts[0], color: C_RESOLVED },
      { label: "3–7 days", count: counts[1], color: "#f97316" },
      { label: "8–14 days", count: counts[2], color: "#dc2626" },
      { label: "15+ days", count: counts[3], color: "#7c3aed" },
    ];
  }, [items]);

  const totalOpen = agingData.reduce((s, b) => s + b.count, 0);

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Complaint Aging Backlog"
        subtitle="Unresolved complaints grouped by time elapsed since filing"
        action={
          <span className="flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
            <Clock size={12} /> {totalOpen} active
          </span>
        }
      />
      <CardBody className="p-4 sm:p-5">
        {totalOpen === 0 ? (
          <div className="flex h-44 items-center justify-center text-sm text-ink-400">
            No active open complaints in the backlog.
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={170}>
              <BarChart
                data={agingData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                  formatter={(val) => [Number(val ?? 0), "Complaints"]}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  label={{ position: "right", fontSize: 11, fill: "#52525b" }}
                >
                  {agingData.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  5. Priority Distribution (BarChart)
// ══════════════════════════════════════════════════════════════════════════════

export function PriorityDistributionChart({ items }: { items: Grievance[] }) {
  const chartData = useMemo(() => {
    type Pivot = { priority: string; [status: string]: string | number };
    const priorities = ["low", "medium", "high", "urgent"];
    const statusSet = new Set<string>();

    const counts: Record<string, Record<string, number>> = {
      low: {}, medium: {}, high: {}, urgent: {},
    };

    items.forEach((g) => {
      const p = (g.priority || "low").toLowerCase();
      const targetP = priorities.includes(p) ? p : "low";
      const st = (g.status || "open").toUpperCase();
      statusSet.add(st);
      counts[targetP][st] = (counts[targetP][st] ?? 0) + 1;
    });

    const allStatuses = Array.from(statusSet).sort();
    const rows: Pivot[] = priorities.map((p) => {
      const row: Pivot = { priority: p.charAt(0).toUpperCase() + p.slice(1) };
      allStatuses.forEach((st) => {
        row[st] = counts[p][st] ?? 0;
      });
      return row;
    });

    return { rows, allStatuses };
  }, [items]);

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Priority Distribution"
        subtitle="Stored complaint priority by current stage (distinct from AI suggestions)"
      />
      <CardBody className="p-4 sm:p-5">
        {items.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-ink-400">
            No complaints available to analyze.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
              <BarChart
                data={chartData.rows}
                margin={{ top: 8, right: 12, bottom: 4, left: -10 }}
                barCategoryGap="25%"
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="priority"
                  tick={{ fontSize: 12, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                {chartData.allStatuses.map((st) => (
                  <Bar
                    key={st}
                    dataKey={st}
                    name={st.replace("_", " ")}
                    fill={STATUS_COLORS[st] ?? "#94a3b8"}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
