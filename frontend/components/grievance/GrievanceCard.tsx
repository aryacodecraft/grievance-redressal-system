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
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {grievance.title}
          </p>
          <span className="font-mono text-xs text-ink-400">{grievance.id}</span>
        </div>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          {grievance.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={grievance.status} />
          <PriorityBadge priority={grievance.priority} />
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-300">
            {grievance.category}
          </span>
          <span className="ml-auto text-xs text-ink-400">
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
    <div className="rounded-md border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
        AI analysis (advisory only)
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <PriorityBadge priority={hfEngine.priority} />
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-300">
          {hfEngine.category}
        </span>
        {hfEngine.categoryConfidence !== undefined && (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            Confidence {(hfEngine.categoryConfidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-primary-900 dark:text-primary-200">
        {hfEngine.explanation}
      </p>
      {hfEngine.keywords.length > 0 && (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
          Keywords: {hfEngine.keywords.join(", ")}
        </p>
      )}
    </div>
  );
}

const TIMELINE = ["submitted", "assigned", "in_progress", "resolved", "closed"];

export function StatusTimeline({ status }: { status: string }) {
  const current = TIMELINE.indexOf(status.toLowerCase());
  const idx = current === -1 ? 0 : current;
  return (
    <ol className="mt-2 space-y-0">
      {TIMELINE.map((step, i) => (
        <li key={step} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span
              aria-hidden
              className={
                i <= idx
                  ? "mt-1 h-2.5 w-2.5 rounded-full bg-primary-600"
                  : "mt-1 h-2.5 w-2.5 rounded-full border border-ink-300 bg-white dark:border-ink-600"
              }
            />
            {i < TIMELINE.length - 1 && (
              <span
                aria-hidden
                className={
                  i < idx ? "w-px flex-1 bg-primary-600" : "w-px flex-1 bg-ink-200 dark:bg-ink-700"
                }
              />
            )}
          </span>
          <span
            className={
              i <= idx
                ? "pb-4 text-sm font-medium text-ink-900 dark:text-white"
                : "pb-4 text-sm text-ink-400"
            }
          >
            {step.replace("_", " ")}
          </span>
        </li>
      ))}
    </ol>
  );
}
