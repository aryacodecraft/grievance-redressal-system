"use client";

/**
 * AnalyticsCharts — five analytics panels that fetch live data from the
 * dedicated /admin/analytics/* endpoints (DEC-054).
 *
 * A. ComplaintTrendsChart   — AreaChart: received vs resolved over time
 * B. DepartmentChart        — grouped BarChart: received/open/resolved/overdue
 * C. ResolutionStatsPanel   — stat cards + per-dept table
 * D. AgingChart             — BarChart: unresolved complaints by age bucket
 * E. PriorityChart          — BarChart: priority × status distribution
 *
 * Each panel manages its own loading/error/empty state.
 * All values come from the API — nothing is hardcoded or fabricated.
 */

import { useEffect, useState } from "react";
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
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Feedback";
import { getDepartmentLabel } from "@/lib/departments";
import {
  fetchAnalyticsAging,
  fetchAnalyticsDepartments,
  fetchAnalyticsPriorities,
  fetchAnalyticsResolution,
  fetchAnalyticsTrends,
  type AnalyticsAgingBucket,
  type AnalyticsAgingResponse,
  type AnalyticsDepartmentsResponse,
  type AnalyticsPrioritiesResponse,
  type AnalyticsResolutionResponse,
  type AnalyticsTrendsResponse,
} from "@/lib/api";

// ── Brand colours ────────────────────────────────────────────────────────────
const C_RECEIVED = "#ff5500";   // SAMARTH primary orange
const C_RESOLVED = "#16a34a";   // emerald
const C_OPEN     = "#f97316";   // amber-orange
const C_OVERDUE  = "#dc2626";   // red

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

// ── Shared sub-components ────────────────────────────────────────────────────

function ChartLoading() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Spinner label="Loading data…" />
    </div>
  );
}

function ChartError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3">
      <AlertTriangle size={24} className="text-rose-500" />
      <p className="text-sm text-rose-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-ink-400">{label}</p>
    </div>
  );
}

// Date-range quick-picker option labels → ISO strings
type RangeKey = "7d" | "30d" | "90d" | "all";
function rangeDates(key: RangeKey): { date_from?: string; date_to?: string } {
  if (key === "all") return {};
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const from = new Date(Date.now() - days * 86_400_000);
  return { date_from: from.toISOString().slice(0, 10) };
}

// ══════════════════════════════════════════════════════════════════════════════
//  A. Complaint Trends
// ══════════════════════════════════════════════════════════════════════════════

export function ComplaintTrendsChart() {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<AnalyticsTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsTrends({ granularity, ...rangeDates(range) })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load trends");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [granularity, range, retryCount]);

  const chartData = data?.data ?? [];

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Complaint Trends"
        subtitle="Complaints received and resolved over time"
        action={
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="trends-range">Date range</label>
            <Select
              id="trends-range"
              value={range}
              onChange={(e) => {
                setLoading(true);
                setRange(e.target.value as RangeKey);
              }}
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
              onChange={(e) => {
                setLoading(true);
                setGranularity(e.target.value as "daily" | "weekly" | "monthly");
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>
        }
      />
      <CardBody className="p-5">
        {loading ? (
          <ChartLoading />
        ) : error ? (
          <ChartError message={error} onRetry={() => { setLoading(true); setRetryCount((c) => c + 1); }} />
        ) : chartData.length === 0 ? (
          <ChartEmpty label="No complaint data for the selected period." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C_RECEIVED} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C_RECEIVED} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C_RESOLVED} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C_RESOLVED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
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
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke={C_RECEIVED}
                  strokeWidth={2}
                  fill="url(#gradReceived)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke={C_RESOLVED}
                  strokeWidth={2}
                  fill="url(#gradResolved)"
                  dot={false}
                  activeDot={{ r: 4 }}
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
//  B. Department Performance
// ══════════════════════════════════════════════════════════════════════════════

export function DepartmentChart() {
  const [range, setRange] = useState<RangeKey>("all");
  const [data, setData] = useState<AnalyticsDepartmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsDepartments(rangeDates(range))
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load department data");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range, retryCount]);

  const chartData = (data?.data ?? []).map((d) => ({
    name: getDepartmentLabel(d.department, true),
    Received: d.received,
    Open: d.open,
    Resolved: d.resolved,
    Overdue: d.overdue,
  }));

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Department Performance"
        subtitle="Received, open, resolved, and overdue complaints by department"
        action={
          <Select
            value={range}
            onChange={(e) => {
              setLoading(true);
              setRange(e.target.value as RangeKey);
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
        }
      />
      <CardBody className="p-5">
        {loading ? (
          <ChartLoading />
        ) : error ? (
          <ChartError message={error} onRetry={() => { setLoading(true); setRetryCount((c) => c + 1); }} />
        ) : chartData.length === 0 ? (
          <ChartEmpty label="No department data for the selected period." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 12, bottom: 40, left: 0 }}
                barCategoryGap="25%"
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  angle={-35}
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
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Received" fill={C_RECEIVED} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Open"     fill={C_OPEN}     radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Resolved" fill={C_RESOLVED} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Overdue"  fill={C_OVERDUE}  radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  C. Resolution Time & SLA Compliance
// ══════════════════════════════════════════════════════════════════════════════

function StatBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

export function ResolutionStatsPanel() {
  const [range, setRange] = useState<RangeKey>("all");
  const [data, setData] = useState<AnalyticsResolutionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsResolution(rangeDates(range))
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load resolution data");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range, retryCount]);

  const fmt = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} d`);
  const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Resolution Time & SLA"
        subtitle="How quickly complaints are resolved and SLA compliance"
        action={
          <Select
            value={range}
            onChange={(e) => {
              setLoading(true);
              setRange(e.target.value as RangeKey);
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
        }
      />
      <CardBody className="p-5 space-y-4">
        {loading ? (
          <ChartLoading />
        ) : error ? (
          <ChartError message={error} onRetry={() => { setLoading(true); setRetryCount((c) => c + 1); }} />
        ) : !data ? (
          <ChartEmpty label="No resolution data available." />
        ) : (
          <>
            {/* Overall KPI strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatBadge
                label="Median resolution"
                value={fmt(data.overall_median_days)}
                sub="from submission to resolution"
              />
              <StatBadge
                label="Mean resolution"
                value={fmt(data.overall_mean_days)}
                sub="average across all resolved"
              />
              <StatBadge
                label="SLA compliance"
                value={fmtPct(data.overall_sla_compliance_pct)}
                sub={data.overall_sla_compliance_pct == null ? "No due-date data" : "resolved within due date"}
              />
            </div>

            {/* SLA caveat note */}
            <p className="text-[11px] text-ink-400 italic">{data.sla_note}</p>

            {/* Per-dept table */}
            {data.by_department.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ink-100">
                      <th className="pb-1.5 text-left font-semibold text-ink-600">Department</th>
                      <th className="pb-1.5 text-right font-semibold text-ink-600">Count</th>
                      <th className="pb-1.5 text-right font-semibold text-ink-600">Median (d)</th>
                      <th className="pb-1.5 text-right font-semibold text-ink-600">Mean (d)</th>
                      <th className="pb-1.5 text-right font-semibold text-ink-600">SLA %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_department.map((r) => (
                      <tr key={r.department} className="border-b border-ink-50">
                        <td className="py-1 pr-2 text-ink-700">{getDepartmentLabel(r.department, true)}</td>
                        <td className="py-1 text-right text-ink-600">{r.count}</td>
                        <td className="py-1 text-right text-ink-600">{r.median_days?.toFixed(1) ?? "—"}</td>
                        <td className="py-1 text-right text-ink-600">{r.mean_days?.toFixed(1) ?? "—"}</td>
                        <td className="py-1 text-right text-ink-600">
                          {r.total_with_due
                            ? `${((r.within_sla ?? 0) / r.total_with_due * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  D. Complaint Aging
// ══════════════════════════════════════════════════════════════════════════════

export function AgingChart() {
  const [data, setData] = useState<AnalyticsAgingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsAging()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load aging data");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const buckets: AnalyticsAgingBucket[] = data?.buckets ?? [];
  const total = buckets.reduce((s, b) => s + b.count, 0);

  const BUCKET_COLORS = [C_RESOLVED, "#f97316", "#dc2626", "#7c3aed"];

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Complaint Aging"
        subtitle="Unresolved complaints grouped by how long they have been open"
        action={
          data ? (
            <span className="flex items-center gap-1 text-[11px] text-ink-500">
              <Clock size={12} />
              {total} open
            </span>
          ) : null
        }
      />
      <CardBody className="p-5">
        {loading ? (
          <ChartLoading />
        ) : error ? (
          <ChartError message={error} onRetry={() => { setLoading(true); setRetryCount((c) => c + 1); }} />
        ) : total === 0 ? (
          <ChartEmpty label="No unresolved complaints — great work!" />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={buckets.map((b) => ({ name: b.label, count: b.count }))}
                margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                layout="vertical"
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
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                  formatter={(val) => [Number(val ?? 0), "Complaints"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28} label={{ position: "right", fontSize: 11, fill: "#52525b" }}>
                  {buckets.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
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
//  E. Priority Distribution
// ══════════════════════════════════════════════════════════════════════════════

export function PriorityChart() {
  const [range, setRange] = useState<RangeKey>("all");
  const [data, setData] = useState<AnalyticsPrioritiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsPriorities(rangeDates(range))
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load priority data");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range, retryCount]);

  // Pivot: priority → { [status]: count }
  type PivotRow = {
    priority: string;
    [status: string]: string | number;
  };
  const priorities = ["low", "medium", "high", "urgent"];
  const allStatuses = Array.from(new Set((data?.data ?? []).map((c) => c.status))).sort();

  const pivoted: PivotRow[] = priorities
    .map((p) => {
      const row: PivotRow = { priority: p };
      for (const s of allStatuses) {
        const match = (data?.data ?? []).find((c) => c.priority === p && c.status === s);
        row[s] = match?.count ?? 0;
      }
      return row;
    })
    .filter((row) => allStatuses.some((s) => (Number(row[s]) || 0) > 0));

  return (
    <Card className="border-ink-200/80 shadow-xs">
      <CardHeader
        title="Priority Distribution"
        subtitle="Stored priority values by complaint status (AI-suggested priorities not included)"
        action={
          <Select
            value={range}
            onChange={(e) => {
              setLoading(true);
              setRange(e.target.value as RangeKey);
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
        }
      />
      <CardBody className="p-5">
        {loading ? (
          <ChartLoading />
        ) : error ? (
          <ChartError message={error} onRetry={() => { setLoading(true); setRetryCount((c) => c + 1); }} />
        ) : pivoted.length === 0 ? (
          <ChartEmpty label="No priority data for the selected period." />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pivoted.map((r) => ({
                    ...r,
                    priority: r.priority.charAt(0).toUpperCase() + r.priority.slice(1),
                  }))}
                  margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                  barCategoryGap="30%"
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
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allStatuses.map((s) => (
                    <Bar
                      key={s}
                      dataKey={s}
                      name={s.replace("_", " ")}
                      fill={STATUS_COLORS[s] ?? "#94a3b8"}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={20}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {data?.note && (
              <p className="mt-2 text-[11px] text-ink-400 italic">{data.note}</p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
