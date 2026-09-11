"use client";

import { useMemo, useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { AnalysisPanel } from "@/components/grievance/GrievanceCard";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import type { Grievance } from "@/lib/types";

const DEPARTMENTS = [
  "Roads Division — Zone 3",
  "Water Supply Board — Sector 12",
  "Power Utility — North Circle",
  "Sanitation Dept — Ward 7",
];

export function AdminBoard() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    MOCK_GRIEVANCES[0]?.id ?? null
  );
  const [assignee, setAssignee] = useState(DEPARTMENTS[0]);
  const [decision, setDecision] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? MOCK_GRIEVANCES
        : MOCK_GRIEVANCES.filter((g) => g.status === statusFilter),
    [statusFilter]
  );

  const selected: Grievance | undefined = MOCK_GRIEVANCES.find(
    (g) => g.id === selectedId
  );

  const open = MOCK_GRIEVANCES.filter((g) =>
    ["open", "submitted"].includes(g.status)
  ).length;
  const urgent = MOCK_GRIEVANCES.filter(
    (g) => g.priority === "high" && g.status !== "resolved"
  ).length;

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Total Registered", String(MOCK_GRIEVANCES.length)],
          ["Awaiting Triage", String(open)],
          ["Urgent & Open", String(urgent)],
          ["Resolved", String(MOCK_GRIEVANCES.filter((g) => g.status === "resolved").length)],
        ].map(([label, value]) => (
          <Card key={label} className="border-ink-200/80 shadow-xs">
            <CardBody className="p-5">
              <p className="text-2xl font-bold tracking-tight text-ink-950">
                {value}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {label}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Queue */}
        <Card className="border-ink-200/80 shadow-xs">
          <CardHeader
            title="Assignment Queue"
            subtitle="Select a ticket to inspect grievance details and AI classification."
            action={
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-auto text-xs py-1.5"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </Select>
            }
          />
          <CardBody className="space-y-2.5 p-5">
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedId(g.id);
                  setDecision(null);
                }}
                className={
                  g.id === selectedId
                    ? "w-full rounded-xl border border-primary-500 bg-primary-50/50 p-4 text-left shadow-2xs transition-all ring-1 ring-primary-500/20"
                    : "w-full rounded-xl border border-ink-200/80 bg-white p-4 text-left hover:border-primary-300 hover:bg-ink-50/50 shadow-2xs transition-all"
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tracking-tight text-ink-950">
                    {g.title}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-ink-400 bg-white px-2 py-0.5 rounded border border-ink-100">
                    {g.id}
                  </span>
                </span>
                <span className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={g.status} />
                  <PriorityBadge priority={g.priority} />
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-xs text-ink-500">
                No grievances match this status filter.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Detail + decision */}
        <Card className="border-ink-200/80 shadow-xs">
          <CardHeader
            title="Review & Officer Action"
            subtitle="AI advises with rationale — authorized officer makes final decision."
          />
          <CardBody className="space-y-5 p-5">
            {!selected && (
              <p className="text-xs text-ink-500 py-8 text-center">
                Select a grievance from the queue to take action.
              </p>
            )}
            {selected && (
              <>
                <div className="border-b border-ink-100 pb-4">
                  <span className="font-mono text-[11px] text-ink-400 font-medium">{selected.id}</span>
                  <p className="text-base font-semibold tracking-tight text-ink-950 mt-1">
                    {selected.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-600">
                    {selected.description}
                  </p>
                </div>
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
                {decision && <Alert tone="info">{decision}</Alert>}
                <div className="flex flex-wrap gap-2.5 pt-2">
                  <Button
                    onClick={() =>
                      setDecision(
                        `Approved: ${selected.id} assigned to ${assignee}. Recorded with officer identity and timestamp (demo).`
                      )
                    }
                  >
                    Approve Assignment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDecision(
                        `Overridden: ${selected.id} reassigned to ${assignee} with officer justification note (demo).`
                      )
                    }
                  >
                    Manual Override
                  </Button>
                </div>
                <p className="text-[11px] text-ink-400 pt-1">
                  Final assignment action commits both the original AI recommendation and the authorized officer's verified decision into the permanent audit trail.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
