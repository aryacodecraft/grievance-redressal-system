"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GrievanceCard } from "./GrievanceCard";
import { EmptyState } from "@/components/ui/Feedback";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import { subscribeGrievances } from "@/lib/grievances";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";

/**
 * "Your Grievances" — the citizen's own submissions.
 * Parity with the legacy `grievance-app.html` list under the submit form.
 */
export function MyGrievances() {
  const { user, liveMode } = useDemoUser();
  const [liveItems, setLiveItems] = useState<Grievance[] | null>(null);

  useEffect(() => {
    if (!user || !liveMode) return;
    const unsub = subscribeGrievances(
      user.id,
      user.email,
      (data) => setLiveItems(data),
      () => setLiveItems(null),
      { scopeToUser: true }
    );
    return unsub;
  }, [user, liveMode]);

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see your grievances"
        hint="Your submissions and their live status will appear here."
      />
    );
  }

  const items = liveMode ? liveItems ?? [] : MOCK_GRIEVANCES;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink-800">
          Your Grievances
        </h2>
        <Link
          href="/track"
          className="text-xs font-semibold text-primary-600 hover:underline"
        >
          Track by reference ID →
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No grievances yet"
          hint="Complaints you submit will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((g) => (
            <GrievanceCard key={g.id} grievance={g} />
          ))}
        </div>
      )}


    </div>
  );
}
