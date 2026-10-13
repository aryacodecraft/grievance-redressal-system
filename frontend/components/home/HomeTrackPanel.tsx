"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { fetchGrievanceById } from "@/lib/grievances";
import { findMockGrievance } from "@/lib/mock";
import { useDemoUser } from "@/lib/session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import type { Grievance } from "@/lib/types";

/** Errors are stored as message keys (not rendered strings) so a live language switch re-translates them. */
interface TrackError {
  key: MessageKey;
  id?: string;
}

export function HomeTrackPanel() {
  const router = useRouter();
  const { liveMode } = useDemoUser();
  const { t } = useI18n();
  const [referenceId, setReferenceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TrackError | null>(null);
  const [foundGrievance, setFoundGrievance] = useState<Grievance | null>(null);

  const trimmedId = referenceId.trim();

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFoundGrievance(null);

    if (!trimmedId) {
      setError({ key: "hpErrEmpty" });
      return;
    }

    // Reference ID sanity check: e.g. GRV-YYYY-XXXX or any non-empty identifier
    if (trimmedId.length < 4) {
      setError({ key: "hpErrShort" });
      return;
    }

    setBusy(true);
    try {
      if (liveMode) {
        const result = await fetchGrievanceById(trimmedId);
        if (result) {
          setFoundGrievance(result);
        } else {
          setError({ key: "hpErrNotFound", id: trimmedId });
        }
      } else {
        // Mock fallback for prototype testing
        await new Promise((r) => setTimeout(r, 300));
        const mock = findMockGrievance(trimmedId);
        if (mock) {
          setFoundGrievance(mock);
        } else {
          setError({ key: "hpErrMockNotFound", id: trimmedId });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/401|unauthorized|not authenticated/i.test(msg)) {
        setError({ key: "hpErrOwned" });
      } else if (/403|forbidden/i.test(msg)) {
        setError({ key: "hpErrForbidden" });
      } else {
        setError({ key: "hpErrUnavailable" });
      }
    } finally {
      setBusy(false);
    }
  }

  function handleViewFullDetails() {
    if (trimmedId) {
      router.push(`/track?id=${encodeURIComponent(trimmedId)}`);
    } else {
      router.push("/track");
    }
  }

  return (
    <div className="rounded-xl border border-ink-200/90 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2.5 border-b border-ink-100 pb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-primary-700">
          <Search size={16} />
        </span>
        <div>
          <h2 className="text-sm font-bold tracking-tight text-ink-950">{t("hpTitle")}</h2>
          <p className="text-xs text-ink-500">{t("hpSubtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleTrack} className="mt-4 space-y-3">
        <div>
          <label htmlFor="home-reference-id" className="block text-xs font-semibold text-ink-700">
            {t("hpLabel")}
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              id="home-reference-id"
              type="text"
              placeholder={t("hpPlaceholder")}
              value={referenceId}
              onChange={(e) => {
                setReferenceId(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy}
              className="font-mono text-xs uppercase placeholder:normal-case placeholder:font-sans"
              aria-describedby="track-hint"
            />
            <Button
              type="submit"
              disabled={busy || !trimmedId}
              className="w-full sm:w-auto sm:shrink-0"
              size="md"
            >
              {busy ? t("hpBtnBusy") : t("hpBtn")}
            </Button>
          </div>
          <p id="track-hint" className="mt-1 text-[11px] text-ink-500">
            {t("hpHint")}{" "}
            <button
              type="button"
              onClick={() => {
                setReferenceId("GRV-2026-0142");
                if (error) setError(null);
              }}
              className="font-mono text-primary-700 underline hover:text-primary-800"
            >
              {t("hpTrySample")}
            </button>
          </p>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-600" />
            <div className="flex-1 leading-snug">{t(error.key, { id: error.id ?? "" })}</div>
          </div>
        )}

        {foundGrievance && (
          <div className="space-y-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-ink-950">
                {foundGrievance.id}
              </span>
              <StatusBadge status={foundGrievance.state ?? foundGrievance.status} />
            </div>
            <p className="line-clamp-2 font-medium text-ink-800">
              {foundGrievance.title}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-1 border-t border-emerald-100 pt-2 text-[11px] text-ink-500">
              <span>{t("hpDept")} <strong className="text-ink-700 capitalize">{foundGrievance.departmentId ?? foundGrievance.category}</strong></span>
              <PriorityBadge priority={foundGrievance.priority} />
            </div>
            <button
              type="button"
              onClick={handleViewFullDetails}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-primary-200 bg-white py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-50"
            >
              {t("hpViewTimeline")} <ArrowRight size={12} />
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-[11px] text-ink-500">
          <span>{t("hpNoFileYet")}</span>
          <a href="/submit" className="font-semibold text-primary-700 hover:underline">
            {t("hpRegisterNow")}
          </a>
        </div>
      </form>
    </div>
  );
}
