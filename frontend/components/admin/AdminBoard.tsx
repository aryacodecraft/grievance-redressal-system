"use client";

import { useEffect, useMemo, useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { AnalysisPanel } from "@/components/grievance/GrievanceCard";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import { subscribeGrievances } from "@/lib/grievances";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";

const DEPARTMENTS = [
  "Roads Division — Zone 3",
  "Water Supply Board — Sector 12",
  "Power Utility — North Circle",
  "Sanitation Dept — Ward 7",
];

export function AdminBoard() {
  const { user, firebaseUser } = useDemoUser();
  const live = Boolean(user?.live && firebaseUser);

  const [items, setItems] = useState<Grievance[]>(MOCK_GRIEVANCES);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState(DEPARTMENTS[0]);
  const [decision, setDecision] = useState<string | null>(null);

  useEffect(() => {
    if (!live || !firebaseUser) {
      setItems(MOCK_GRIEVANCES);
      setLoadingLive(false);
      return;
    }
    setLoadingLive(true);
    setLiveError(null);
    const unsub = subscribeGrievances(
      firebaseUser.uid,
      firebaseUser.email,
      (data) => {
        setItems(data);
        setLoadingLive(false);
        setSelectedId((prev) =>
          prev && data.some((g) => g.id === prev)
            ? prev
            : (data[0]?.id ?? null)
        );
      },
      (message) => {
        setLiveError(message);
        setLoadingLive(false);
        setItems(MOCK_GRIEVANCES);
      }
    );
    return unsub;
  }, [live, firebaseUser]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? items
        : items.filter((g) => g.status === statusFilter),
    [items, statusFilter]
  );

  const selected: Grievance | undefined = items.find(
    (g) => g.id === (selectedId ?? items[0]?.id)
  );

  const open = items.filter((g) =>
    ["open", "submitted"].includes(g.status)
  ).length;
  const urgent = items.filter(
    (g) => g.priority === "high" && g.status !== "resolved"
  ).length;

  return (
    <div className="space-y-6">
      {!live && (
        <Alert>
          Demo data.{" "}
          <a href="/login" className="font-medium underline">
            Sign in with a live account
          </a>{" "}
          to see real grievances — admin access requires the allowlisted
          officer email.
        </Alert>
      )}
      {liveError && <Alert tone="error">Live data failed: {liveError}</Alert>}

      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Total registered", String(items.length)],
          ["Awaiting assignment", String(open)],
          ["Urgent & open", String(urgent)],
          ["Resolved", String(items.filter((g) => g.status === "resolved").length)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-2xl font-bold text-ink-900 dark:text-white">
                {value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-ink-500">
                {label}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {loadingLive && <Spinner label="Loading live grievances…" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Queue */}
        <Card>
          <CardHeader
            title="Assignment queue"
            subtitle={
              live
                ? "Live from Firestore — select a grievance to review."
                : "Select a grievance to review the AI recommendation."
            }
            action={
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-auto"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </Select>
            }
          />
          <CardBody className="max-h-[480px] space-y-2 overflow-y-auto">
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedId(g.id);
                  setDecision(null);
                }}
                className={
                  g.id === selected?.id
                    ? "w-full rounded-md border border-primary-600 bg-primary-50 p-3 text-left dark:bg-primary-950"
                    : "w-full rounded-md border border-ink-200 p-3 text-left hover:border-primary-400 dark:border-ink-800"
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900 dark:text-white">
                    {g.title}
                  </span>
                  <span className="font-mono text-xs text-ink-400">{g.id}</span>
                </span>
                <span className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={g.status} />
                  <PriorityBadge priority={g.priority} />
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-500">
                No grievances with this status.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Detail + decision */}
        <Card>
          <CardHeader
            title="Review & assignment"
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
                  <p className="text-base font-semibold text-ink-900 dark:text-white">
                    {selected.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                    {selected.description}
                  </p>
                  {selected.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.imageUrl}
                      alt="Grievance evidence"
                      className="mt-2 max-h-48 rounded-md border border-ink-200 object-contain"
                    />
                  )}
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
                {decision && <Alert>{decision}</Alert>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      setDecision(
                        `Approved: ${selected.id} assigned to ${assignee}. Recorded with officer identity and timestamp (demo).`
                      )
                    }
                  >
                    Approve assignment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDecision(
                        `Overridden: ${selected.id} reassigned to ${assignee} with officer note (demo).`
                      )
                    }
                  >
                    Override
                  </Button>
                </div>
                <p className="text-xs text-ink-400">
                  Final assignment stores both the AI recommendation and the
                  human decision in the audit trail.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
