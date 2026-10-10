import { getSlaInfo } from "./sla";
import { canonicalDepartmentId } from "./departments";
import type { Grievance } from "./types";

/**
 * CSV report builders for the admin analytics exports.
 *
 * Kept as pure functions (no React/DOM) so both export buttons share one
 * implementation and the output can be exercised without a browser.
 * `buildSummaryCsv` is the department-wise summary; `buildComplaintsCsv` is
 * the flat one-row-per-complaint export.
 */

/** Quote a CSV field when it contains a comma, quote, or newline. */
function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flat export: one row per registered complaint. */
export function buildComplaintsCsv(items: Grievance[]): string {
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
  ];
  const rows = items.map((g) => {
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

/** Readable name for a canonical department id. */
const DEPARTMENT_LABELS: Record<string, string> = {
  water: "Water supply",
  roads: "Roads & transport",
  electricity: "Electricity",
  sanitation: "Sanitation",
  health: "Health services",
  governance: "Governance",
  other: "Other",
};

function departmentLabel(key: string): string {
  return DEPARTMENT_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

const CLOSED_STATES = new Set(["resolved", "closed"]);

function isClosed(g: Grievance): boolean {
  return CLOSED_STATES.has((g.state ?? g.status ?? "").toLowerCase());
}

/** Registered complaints grouped by canonical department, biggest group first. */
function groupByDepartment(items: Grievance[]): Array<[string, Grievance[]]> {
  const groups = new Map<string, Grievance[]>();
  items.forEach((g) => {
    const key = canonicalDepartmentId(g.departmentId ?? g.category) || "other";
    const bucket = groups.get(key);
    if (bucket) bucket.push(g);
    else groups.set(key, [g]);
  });
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

/**
 * Department-wise summary report: a per-department count block, then a detail
 * block listing every registered complaint (description, AI summary, keywords,
 * location and timeline) grouped under its department.
 */
export function buildSummaryCsv(items: Grievance[]): string {
  const groups = groupByDepartment(items);

  const summaryHeader = [
    "Department",
    "Total complaints",
    "Open",
    "In progress",
    "Resolved or closed",
    "Urgent",
    "Past deadline",
    "% resolved",
  ];
  const summaryRows = groups.map(([key, rows]) => {
    const total = rows.length;
    const resolved = rows.filter(isClosed).length;
    const inProgress = rows.filter((g) => (g.status || "").toLowerCase() === "in_progress").length;
    const open = total - resolved - inProgress;
    const urgent = rows.filter((g) => g.hfEngine?.isUrgent || (g.priority || "").toLowerCase() === "high").length;
    const overdue = rows.filter((g) => !isClosed(g) && getSlaInfo(g).state === "overdue").length;
    const rate = total ? Math.round((resolved / total) * 100) : 0;
    return [departmentLabel(key), total, open, inProgress, resolved, urgent, overdue, `${rate}%`];
  });

  const detailHeader = [
    "Department",
    "Ticket ID",
    "Title",
    "Description",
    "AI summary",
    "Keywords",
    "Priority",
    "Status",
    "Assigned to",
    "Registered on",
    "Due by",
    "Resolved on",
    "Latitude",
    "Longitude",
    "Map link",
  ];
  const detailRows = groups.flatMap(([key, rows]) =>
    [...rows]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .map((g) => {
        const sla = getSlaInfo(g);
        const hasLocation = g.latitude != null && g.longitude != null;
        return [
          departmentLabel(key),
          g.id,
          g.title,
          g.description ?? "",
          g.hfEngine?.explanation ?? "",
          (g.hfEngine?.keywords ?? []).join("; "),
          g.priority ?? "",
          g.state ?? g.status ?? "",
          g.assignee ?? "",
          g.createdAt ?? "",
          g.dueDate ?? sla.dueAt.toISOString(),
          g.resolvedAt ?? g.closedAt ?? "",
          hasLocation ? String(g.latitude) : "",
          hasLocation ? String(g.longitude) : "",
          hasLocation ? `https://www.openstreetmap.org/?mlat=${g.latitude}&mlon=${g.longitude}` : "",
        ];
      })
  );

  return [
    "Department summary",
    summaryHeader.join(","),
    ...summaryRows.map((row) => row.map(csvEscape).join(",")),
    "",
    "Complaint details",
    detailHeader.join(","),
    ...detailRows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}
