"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { TfidfCluster } from "@/lib/tfidf";

/**
 * TF-IDF similarity clusters (parity with the legacy summary panel).
 * "View" filters the queue to the grievance ids inside that cluster.
 */
export function AdminClusters({
  clusters,
  activeClusterId,
  onSelect,
  onClear,
}: {
  clusters: TfidfCluster[];
  activeClusterId: string | null;
  onSelect: (clusterId: string) => void;
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="TF-IDF clusters"
        subtitle="Similar grievances grouped by title + description"
        action={
          activeClusterId ? (
            <Button size="sm" variant="outline" onClick={onClear}>
              Clear filter
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-2">
        {clusters.length === 0 && (
          <p className="py-4 text-center text-sm text-ink-500">
            No TF-IDF clusters.
          </p>
        )}
        {clusters.map((c) => (
          <div
            key={c.clusterId}
            className={
              activeClusterId === c.clusterId
                ? "flex items-center justify-between gap-3 rounded-lg border border-primary-600 bg-primary-50 p-3"
                : "flex items-center justify-between gap-3 rounded-lg border border-ink-200 p-3"
            }
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">
                {c.area || "Unknown"}
              </p>
              <p className="mt-1 truncate text-xs text-ink-500">
                {c.keywords.join(", ")}
              </p>
              <p className="mt-1 truncate text-xs text-ink-400">
                {c.sample.slice(0, 120)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
                {c.size}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelect(c.clusterId)}
              >
                View
              </Button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
