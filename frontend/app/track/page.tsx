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
import { CATEGORIES, type Grievance } from "@/lib/types";
import { departmentKey, useI18n } from "@/lib/i18n";

export default function TrackPage() {
  const { liveMode, user } = useDemoUser();
  const { t } = useI18n();
  const [recent, setRecent] = useState<Grievance[]>([]);
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);

  useEffect(() => {
    if (!liveMode) return;
    if (!user) return;
    void listGrievances({ userId: user.id }).then((rows) => setRecent(rows as Grievance[])).catch(() => setRecent([]));
  }, [liveMode, user]);
  const displayedRecent = liveMode ? recent : MOCK_GRIEVANCES;
  const departmentCounts = displayedRecent.reduce<Record<string, number>>((counts, grievance) => {
    const key = (grievance.category || "other").toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

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
        {!user ? <Card className="mx-auto max-w-lg border-primary-200 bg-primary-50/40 text-center"><CardBody className="space-y-4 p-8"><h2 className="text-xl font-bold text-ink-950">{t("signinTrackTitle")}</h2><p className="text-sm leading-6 text-ink-600">{t("signinTrackText")}</p><Link href="/login?next=/track"><Button className="w-full sm:w-auto">{t("signinTrackBtn")}</Button></Link></CardBody></Card> : <><div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink-950">{t("myGrievances")}</h2><p className="mt-1 text-sm text-ink-500">{t("myGrievancesText")}</p></div><span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">{displayedRecent.length} {t("totalLabel")}</span></div>
        {displayedRecent.length === 0 ? (
          <EmptyState title={t("noGrievancesTitle")} hint={t("noGrievancesHint")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {displayedRecent.map((g) => (
              <GrievanceCard
                key={g.id}
                grievance={g}
                onClick={() => setSelectedGrievance(g)}
              />
            ))}
          </div>
        )}
        </>}

        {selectedGrievance && (
          <GrievanceDetailModal
            grievance={selectedGrievance}
            onClose={() => setSelectedGrievance(null)}
          />
        )}

        <div className="mt-10 border-t border-ink-100 pt-8"><div className="mb-4"><h2 className="text-lg font-bold text-ink-950">{t("myByDeptTitle")}</h2><p className="mt-1 text-sm text-ink-500">{t("myByDeptText")}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{CATEGORIES.map((key) => <div key={key} className="rounded-lg border border-ink-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t(departmentKey(key))}</p><p className="mt-2 text-2xl font-bold text-ink-950">{departmentCounts[key] || 0}</p><p className="mt-1 text-xs text-ink-500">{departmentCounts[key] === 1 ? t("requestOne") : t("requestMany")}</p></div>)}</div></div>
      </div>

    </div>
  );
}
