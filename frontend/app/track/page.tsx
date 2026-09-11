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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
        Track Status
      </h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        Enter your grievance reference ID (try{" "}
        <span className="font-mono">GRV-2026-0142</span> in this demo).
      </p>

      <Card className="mt-6">
        <CardBody>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <div className="flex-1">
              <Field label="Reference ID">
                <Input
                  placeholder="e.g. GRV-2026-0142"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:self-end">
              <Button type="submit" disabled={busy || !query.trim()}>
                {busy ? "Looking up…" : "Track"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="mt-6">
        {busy && <Spinner label="Looking up your grievance…" />}
        {!busy && searched && found && (
          <div className="space-y-4">
            <GrievanceCard grievance={found} />
            {found.hfEngine && <AnalysisPanel hfEngine={found.hfEngine} />}
            <Card>
              <CardHeader title="Progress timeline" />
              <CardBody>
                <StatusTimeline status={found.status} />
              </CardBody>
            </Card>
          </div>
        )}
        {!busy && searched && !found && (
          <EmptyState
            title="No grievance found for that ID"
            hint="Check the reference ID from your submission receipt."
          />
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white">
          Recently registered (demo)
        </h2>
        <div className="mt-4 space-y-3">
          {MOCK_GRIEVANCES.map((g) => (
            <GrievanceCard key={g.id} grievance={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
