import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import type { Grievance } from "@/lib/types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function GrievanceCard({ grievance }: { grievance: Grievance }) {
  return (
    <Card className="hover:border-ink-300 transition-all">
      <CardBody className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight text-ink-950">
            {grievance.title}
          </p>
          <span className="font-mono text-[11px] font-medium text-ink-400 bg-ink-50 px-2 py-0.5 rounded border border-ink-100">
            {grievance.id}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-600">
          {grievance.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
          <StatusBadge status={grievance.status} />
          <PriorityBadge priority={grievance.priority} />
          <span className="rounded-full bg-ink-100/70 border border-ink-200/60 px-2.5 py-0.5 text-xs font-medium text-ink-700">
            {grievance.category}
          </span>
          <span className="ml-auto text-[11px] font-medium text-ink-400">
            {formatDate(grievance.createdAt)}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

export function AnalysisPanel({
  hfEngine,
}: {
  hfEngine: NonNullable<Grievance["hfEngine"]>;
}) {
  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary-800">
          AI Decision Support Analysis
        </p>
        <span className="text-[10px] font-medium uppercase tracking-wide text-primary-600 bg-white/80 px-2 py-0.5 rounded border border-primary-200">
          Advisory Only
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PriorityBadge priority={hfEngine.priority} />
        <span className="rounded-full bg-white border border-primary-200/80 px-2.5 py-0.5 text-xs font-medium text-ink-800 shadow-2xs">
          {hfEngine.category}
        </span>
        {hfEngine.categoryConfidence !== undefined && (
          <span className="rounded-full bg-white border border-primary-200/80 px-2.5 py-0.5 text-xs font-medium text-primary-700 shadow-2xs">
            Confidence {(hfEngine.categoryConfidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-700 font-medium">
        {hfEngine.explanation}
      </p>
      {hfEngine.keywords.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-primary-200/60 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
          <span className="font-semibold text-ink-600 text-[11px]">Identified Keywords:</span>
          {hfEngine.keywords.map((kw) => (
            <span key={kw} className="bg-white px-2 py-0.5 rounded text-[11px] border border-primary-100 text-ink-600">
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const TIMELINE = ["submitted", "assigned", "in_progress", "resolved", "closed"];

export function StatusTimeline({ status }: { status: string }) {
  const current = TIMELINE.indexOf(status.toLowerCase());
  const idx = current === -1 ? 0 : current;
  return (
    <ol className="mt-3 space-y-0">
      {TIMELINE.map((step, i) => (
        <li key={step} className="flex gap-3.5">
          <span className="flex flex-col items-center">
            <span
              aria-hidden
              className={
                i <= idx
                  ? "mt-1 h-3 w-3 rounded-full bg-primary-600 ring-4 ring-primary-100"
                  : "mt-1 h-3 w-3 rounded-full border border-ink-300 bg-white"
              }
            />
            {i < TIMELINE.length - 1 && (
              <span
                aria-hidden
                className={
                  i < idx ? "w-0.5 flex-1 bg-primary-500" : "w-0.5 flex-1 bg-ink-200"
                }
              />
            )}
          </span>
          <span
            className={
              i <= idx
                ? "pb-5 text-xs font-semibold text-ink-950 capitalize"
                : "pb-5 text-xs font-normal text-ink-400 capitalize"
            }
          >
            {step.replace("_", " ")}
          </span>
        </li>
      ))}
    </ol>
  );
}
