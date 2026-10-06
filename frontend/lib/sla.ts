import type { Grievance } from "./types";

/**
 * Prototype SLA heuristic.
 *
 * The backend does not persist a `due_date` yet — SLA configuration is an
 * open PRD question (OQ-005) and the monitoring module is Phase 9 (PLANNED).
 * Until then this helper derives a deadline *deterministically* from the
 * grievance priority so the admin triage board can surface an
 * `Overdue` / `On Track` indicator.
 *
 * This is a display-only prototype default and must be replaced by the
 * server-provided SLA deadline once the configuration module ships.
 */
export const DEFAULT_SLA_DAYS: Record<string, number> = {
  high: 3,
  medium: 7,
  low: 14,
};

export type SlaState = "overdue" | "on_track" | "closed";

export interface SlaInfo {
  state: SlaState;
  dueAt: Date;
  /** Whole days until the deadline; negative when overdue. */
  daysRemaining: number;
  /** Human-readable indicator, e.g. "2d overdue" / "4d left". */
  label: string;
}

function isClosed(status: string): boolean {
  const s = (status || "").toLowerCase();
  return s === "resolved" || s === "closed" || s === "rejected";
}

/**
 * Derive the SLA state for a grievance. Deadline = createdAt + priority SLA,
 * where the priority SLA is the prototype default table above.
 */
export function getSlaInfo(g: Grievance): SlaInfo {
  const created = new Date(g.createdAt);
  const priority = (g.priority || "low").toLowerCase();
  const days = DEFAULT_SLA_DAYS[priority] ?? DEFAULT_SLA_DAYS.low;
  const dueAt = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);

  const msRemaining = dueAt.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  if (isClosed(g.status)) {
    return { state: "closed", dueAt, daysRemaining, label: "Closed" };
  }
  if (msRemaining < 0) {
    return {
      state: "overdue",
      dueAt,
      daysRemaining,
      label: `${Math.max(1, Math.abs(daysRemaining))}d overdue`,
    };
  }
  return {
    state: "on_track",
    dueAt,
    daysRemaining,
    label: daysRemaining <= 0 ? "Due today" : `${daysRemaining}d left`,
  };
}
