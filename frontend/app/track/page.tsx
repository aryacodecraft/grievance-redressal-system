"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import {
  AnalysisPanel,
  GrievanceCard,
  StatusTimeline,
} from "@/components/grievance/GrievanceCard";
import { MOCK_GRIEVANCES, findMockGrievance } from "@/lib/mock";
import type { Grievance } from "@/lib/types";

export default function TrackPage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState<Grievance | null>(null);
  const [busy, setBusy] = useState(false);

  function search() {
    setBusy(true);
    // Mock lookup with a short delay to mimic a backend round-trip.
    setTimeout(() => {
      setFound(findMockGrievance(query) ?? null);
      setSearched(true);
      setBusy(false);
    }, 400);
  }

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-950">
            Track Grievance Status
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Enter your unique reference tracking code to view progress timeline and AI triage details. Try{" "}
            <button
              type="button"
              onClick={() => setQuery("GRV-2026-0142")}
              className="font-mono text-xs font-semibold text-primary-600 underline hover:text-primary-700"
            >
              GRV-2026-0142
            </button>{" "}
            in this prototype.
          </p>
        </div>

        <Card className="border-ink-200/80 shadow-xs">
          <CardBody className="p-5">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <div className="flex-1">
                <Field label="Reference ID / Ticket Code">
                  <Input
                    placeholder="e.g. GRV-2026-0142"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Field>
              </div>
              <div>
                <Button type="submit" disabled={busy || !query.trim()} className="w-full sm:w-auto min-w-28">
                  {busy ? "Searching…" : "Track Ticket"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="mt-6">
          {busy && <Spinner label="Querying grievance database…" />}
          {!busy && searched && found && (
            <div className="space-y-4">
              <GrievanceCard grievance={found} />
              {found.hfEngine && <AnalysisPanel hfEngine={found.hfEngine} />}
              <Card className="border-ink-200/80 shadow-xs">
                <CardHeader title="Resolution Progress Timeline" subtitle="Updated synchronously as officers take actions" />
                <CardBody>
                  <StatusTimeline status={found.status} />
                </CardBody>
              </Card>
            </div>
          )}
          {!busy && searched && !found && (
            <EmptyState
              title="No grievance found for that reference ID"
              hint="Please verify the exact reference code from your submission acknowledgement receipt."
            />
          )}
        </div>

        <div className="mt-12 border-t border-ink-100 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-800">
              Recently Logged Grievances
            </h2>
            <span className="text-xs text-ink-400">Sample Registry</span>
          </div>
          <div className="space-y-3">
            {MOCK_GRIEVANCES.map((g) => (
              <GrievanceCard key={g.id} grievance={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
