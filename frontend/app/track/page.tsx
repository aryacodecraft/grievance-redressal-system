"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { GrievanceCard } from "@/components/grievance/GrievanceCard";
import { GrievanceDetailModal } from "@/components/grievance/GrievanceDetailModal";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import { listGrievances } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function TrackPage() {
  const { liveMode, user, isLoading } = useDemoUser();
  const { t } = useI18n();
  const [recent, setRecent] = useState<Grievance[]>([]);
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);

  useEffect(() => {
    if (!liveMode) return;
    if (!user) return;
    void listGrievances({ userId: user.id }).then((rows) => setRecent(rows as Grievance[])).catch(() => setRecent([]));
  }, [liveMode, user]);
  const displayedRecent = liveMode ? recent : MOCK_GRIEVANCES;
  // Personal dashboard counts, grouped by lifecycle bucket. Rejected /
  // withdrawn grievances count toward the total only.
  const normStatus = (g: Grievance) => (g.state ?? g.status ?? "").toLowerCase();
  const OPEN_STATES = new Set(["submitted", "open", "triaged", "ai_processing", "pending_assignment"]);
  const ACTIVE_STATES = new Set(["assigned", "accepted", "in_progress", "blocked", "escalated", "under_review", "resolution_submitted", "reopened"]);
  const DONE_STATES = new Set(["resolved", "closed"]);
  const dashboardStats = [
    { label: t("totalLabel"), value: displayedRecent.length },
    { label: t("statusOpen"), value: displayedRecent.filter((g) => OPEN_STATES.has(normStatus(g))).length },
    { label: t("statusInProgress"), value: displayedRecent.filter((g) => ACTIVE_STATES.has(normStatus(g))).length },
    { label: t("statusResolved"), value: displayedRecent.filter((g) => DONE_STATES.has(normStatus(g))).length },
  ];

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          {t("trackTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">{t("trackSubtitle")}</p>
      </div>

      {/* My grievances */}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {isLoading && !user ? (
          <div className="mx-auto max-w-lg text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
            <p className="mt-3 text-xs text-ink-500 font-medium">Restoring your session…</p>
          </div>
        ) : !user ? (
          <Card className="mx-auto max-w-lg border-primary-200 bg-primary-50/40 text-center">
            <CardBody className="space-y-4 p-8">
              <h2 className="text-xl font-bold text-ink-950">{t("signinTrackTitle")}</h2>
              <p className="text-sm leading-6 text-ink-600">{t("signinTrackText")}</p>
              <Link href="/login?next=/track">
                <Button className="w-full sm:w-auto">{t("signinTrackBtn")}</Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-950">{t("myGrievances")}</h2>
                <p className="mt-1 text-sm text-ink-500">{t("myGrievancesText")}</p>
              </div>
            </div>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {dashboardStats.map((s) => (
                <div key={s.label} className="rounded-lg border border-ink-200 bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-ink-950">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-ink-500">{s.label}</p>
                </div>
              ))}
            </div>
            {displayedRecent.length === 0 ? (
              <EmptyState title={t("noGrievancesTitle")} hint={t("noGrievancesHint")} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {displayedRecent.map((g) => (
                  <GrievanceCard
                    key={g.id}
                    grievance={g}
                    citizenView
                    onClick={() => setSelectedGrievance(g)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {selectedGrievance && (
          <GrievanceDetailModal
            grievance={selectedGrievance}
            citizenView
            onClose={() => setSelectedGrievance(null)}
            onUpdated={(update) => {
              setRecent((items) => items.map((item) => item.id === selectedGrievance.id ? { ...item, ...update } : item));
              setSelectedGrievance((item) => item ? { ...item, ...update } : item);
            }}
          />
        )}
      </div>

    </div>
  );
}
