import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { CheckCircle2, Clock, CircleDot, AlertCircle } from "lucide-react";
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
          <span className="font-mono text-[11px] font-medium text-ink-400 bg-ink-50 px-2 py-0.5 rounded-sm border border-ink-100">
            {grievance.id}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-600">
          {grievance.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
          <StatusBadge status={grievance.status} />
          <PriorityBadge priority={grievance.priority} />
          <span className="rounded-sm bg-ink-100/70 border border-ink-200/60 px-2.5 py-0.5 text-xs font-medium text-ink-700">
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
    <div className="rounded-md border border-primary-100 bg-primary-50/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary-800">
          AI Suggestion
        </p>
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-white px-2 py-0.5 rounded-sm border border-primary-200 shadow-2xs">
          Auto-generated
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PriorityBadge priority={hfEngine.priority} />
        <span className="rounded-sm bg-white border border-primary-200/80 px-2.5 py-0.5 text-xs font-medium text-ink-800 shadow-2xs">
          {hfEngine.category}
        </span>
        {hfEngine.categoryConfidence !== undefined && (
          <span className="rounded-sm bg-white border border-primary-200/80 px-2.5 py-0.5 text-xs font-medium text-primary-700 shadow-2xs">
            AI is {(hfEngine.categoryConfidence * 100).toFixed(0)}% sure
          </span>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-700 font-medium">
        {hfEngine.explanation}
      </p>
      {hfEngine.keywords.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-primary-200/60 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
          <span className="font-semibold text-ink-600 text-[11px]">Key words spotted:</span>
          {hfEngine.keywords.map((kw) => (
            <span key={kw} className="bg-white px-2 py-0.5 rounded-sm text-[11px] border border-primary-100 text-ink-600">
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


interface Milestone {
  key: string;
  title: string;
  desc: string;
}

const MILESTONES: Milestone[] = [
  {
    key: "submitted",
    title: "Complaint Registered",
    desc: "Acknowledged and logged into municipal registry.",
  },
  {
    key: "triaged",
    title: "AI Triage & Categorization",
    desc: "Department routing, priority, and sentiment evaluated.",
  },
  {
    key: "assigned",
    title: "Officer Assigned",
    desc: "Allocated to designated nodal officer or department team.",
  },
  {
    key: "in_progress",
    title: "Remediation In Progress",
    desc: "Field inspection, on-site repairs, or civic action underway.",
  },
  {
    key: "resolved",
    title: "Resolved & Verified",
    desc: "Remediation verified and ticket closed by authorized officer.",
  },
];

export function StatusTimeline({ status }: { status: string }) {
  const norm = (status || "").toLowerCase().trim();

  if (norm === "rejected") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50/60 p-4 text-xs text-red-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={16} className="text-red-600" />
          <span>Ticket Rejected / Closed without Action</span>
        </div>
        <p className="mt-1 text-[11px] text-red-600">
          This submission did not meet municipal verification criteria or was flagged as a duplicate.
        </p>
      </div>
    );
  }

  // Map backend status strings to milestone index:
  // "open" / "submitted" -> index 1 (AI triage is executed synchronously on submit)
  // "triaged" -> index 1
  // "assigned" -> index 2
  // "in_progress" -> index 3
  // "resolved" / "closed" -> index 4
  let activeIndex = 0;
  if (norm === "open" || norm === "submitted") {
    activeIndex = 1;
  } else if (norm === "triaged") {
    activeIndex = 1;
  } else if (norm === "assigned") {
    activeIndex = 2;
  } else if (norm === "in_progress") {
    activeIndex = 3;
  } else if (norm === "resolved" || norm === "closed") {
    activeIndex = 4;
  }

  return (
    <ol className="relative space-y-0" aria-label="Progress timeline">
      {MILESTONES.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isCurrent = i === activeIndex;
        const isPending = i > activeIndex;

        return (
          <li key={step.key} className="flex gap-3 pb-5 last:pb-0">
            {/* Left indicator column with line */}
            <div className="relative flex flex-col items-center">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${
                  isCompleted
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                    ? "bg-primary-600 text-white ring-4 ring-primary-100"
                    : "border border-ink-200 bg-white text-ink-300"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                ) : isCurrent ? (
                  <CircleDot size={13} strokeWidth={2.5} />
                ) : (
                  <Clock size={11} />
                )}
              </span>
              {i < MILESTONES.length - 1 && (
                <span
                  className={`mt-1 h-full w-0.5 flex-1 transition-colors ${
                    i < activeIndex ? "bg-emerald-500" : "bg-ink-200"
                  }`}
                />
              )}
            </div>

            {/* Right content */}
            <div className="-mt-0.5">
              <p
                className={`text-xs font-semibold leading-tight ${
                  isCurrent
                    ? "text-primary-800"
                    : isCompleted
                    ? "text-ink-900"
                    : "text-ink-400"
                }`}
              >
                {step.title}
              </p>
              <p
                className={`mt-0.5 text-[11px] leading-relaxed ${
                  isCurrent
                    ? "text-ink-600 font-medium"
                    : isCompleted
                    ? "text-ink-500"
                    : "text-ink-400"
                }`}
              >
                {step.desc}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
