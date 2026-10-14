"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { GrievanceCard } from "@/components/grievance/GrievanceCard";
import { GrievanceDetailPanel } from "@/components/grievance/GrievanceDetailPanel";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import { listGrievances } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function TrackPage() {
  const { liveMode, user } = useDemoUser();
  const { t } = useI18n();
  const [recent, setRecent] = useState<Grievance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!liveMode) return;
    if (!user) return;
    void listGrievances({ userId: user.id }).then((rows) => setRecent(rows as Grievance[])).catch(() => setRecent([]));
  }, [liveMode, user]);
  const displayedRecent = liveMode ? recent : MOCK_GRIEVANCES;
  // Details read straight from the dashboard — auto-select the first
  // grievance so the panel is never empty, and follow list refreshes.
  const selected = displayedRecent.find((g) => g.id === selectedId)
    ?? displayedRecent[0]
    ?? null;

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          {t("trackTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">{t("trackSubtitle")}</p>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {!user ? <Card className="mx-auto max-w-lg border-primary-200 bg-primary-50/40 text-center"><CardBody className="space-y-4 p-8"><h2 className="text-xl font-bold text-ink-950">{t("signinTrackTitle")}</h2><p className="text-sm leading-6 text-ink-600">{t("signinTrackText")}</p><Link href="/login?next=/track"><Button className="w-full sm:w-auto">{t("signinTrackBtn")}</Button></Link></CardBody></Card> : <>
        <div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-950">{t("myGrievances")}</h2><p className="mt-1 text-sm text-ink-500">{t("myGrievancesText")}</p></div><span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">{displayedRecent.length} {t("totalLabel")}</span></div>
        {displayedRecent.length === 0 ? (
          <EmptyState title={t("noGrievancesTitle")} hint={t("noGrievancesHint")} />
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[380px_1fr]">
            {/* Grievance list */}
            <div className="space-y-3">
              {displayedRecent.map((g) => (
                <div
                  key={g.id}
                  className={`rounded-lg transition-shadow ${selected?.id === g.id ? "ring-2 ring-primary-600 ring-offset-1" : ""}`}
                >
                  <GrievanceCard
                    grievance={g}
                    onClick={() => setSelectedId(g.id)}
                  />
                </div>
              ))}
            </div>
            {/* Selected grievance details */}
            {selected && (
              <div className="rounded-xl border border-ink-200 bg-white shadow-xs lg:sticky lg:top-20">
                <GrievanceDetailPanel key={selected.id} grievance={selected} />
              </div>
            )}
          </div>
        )}
        </>}
      </div>

    </div>
  );
}
