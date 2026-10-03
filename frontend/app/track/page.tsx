"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import {
  AnalysisPanel,
  GrievanceCard,
  StatusTimeline,
} from "@/components/grievance/GrievanceCard";
import { MOCK_GRIEVANCES, findMockGrievance } from "@/lib/mock";
import { fetchGrievanceById } from "@/lib/grievances";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";

export default function TrackPage() {
  const { liveMode } = useDemoUser();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState<Grievance | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    setSearched(false);
    try {
      if (liveMode) {
        setFound(await fetchGrievanceById(query));
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setFound(findMockGrievance(query) ?? null);
      }
    } catch (err) {
      console.error("Track lookup error:", err);
      setFound(null);
    } finally {
      setSearched(true);
      setBusy(false);
    }
  }

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          Track Grievance Status
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter your reference tracking code to view progress and AI triage details.{" "}
          <button
            type="button"
            onClick={() => setQuery("GRV-2026-0142")}
            className="font-mono text-xs font-semibold text-primary-600 underline hover:text-primary-700"
          >
            Try GRV-2026-0142
          </button>
          {" "}in this prototype.
          {liveMode && <> Signed in — look up your real submissions.</>}
        </p>
      </div>

      {/* Search bar — full width strip */}
      <div className="border-b border-ink-100 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <form
          className="flex items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Input
            placeholder="Reference ID e.g. GRV-2026-0142"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />
          <Button type="submit" disabled={busy || !query.trim()} className="min-w-32">
            {busy ? "Searching…" : "Track Ticket"}
          </Button>
        </form>
      </div>

      {/* Main content — two panel layout when result exists */}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {busy && <Spinner label="Querying grievance database…" />}

        {!busy && searched && found && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Left: main grievance details */}
            <div className="space-y-5">
              <GrievanceCard grievance={found} />
              {found.hfEngine && <AnalysisPanel hfEngine={found.hfEngine} />}
            </div>
            {/* Right: timeline panel */}
            <Card className="border-ink-200/80 shadow-xs h-fit">
              <CardHeader
                title="Resolution Timeline"
                subtitle="Updated as officers take actions"
              />
              <CardBody>
                <StatusTimeline status={found.status} />
              </CardBody>
            </Card>
          </div>
        )}

        {!busy && searched && !found && (
          <EmptyState
            title="No grievance found for that reference ID"
            hint="Please verify the exact reference code from your submission acknowledgement."
          />
        )}

        {/* Recent grievances listing */}
        <div className="mt-10 border-t border-ink-100 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-800">
              Recently Logged Grievances
            </h2>
            <span className="text-xs text-ink-400">Sample Registry</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MOCK_GRIEVANCES.map((g) => (
              <GrievanceCard key={g.id} grievance={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
