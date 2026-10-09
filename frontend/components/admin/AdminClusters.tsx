"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { TfidfCluster } from "@/lib/tfidf";

/**
 * Groups of similar complaints (found automatically by comparing wording).
 * "View" filters the queue to the grievances inside that group — useful to
 * spot a spike of the same problem reported by many people.
 */
export function AdminClusters({
  clusters,
  activeClusterId,
  onSelect,
  onClear,
  locations = {},
}: {
  clusters: TfidfCluster[];
  activeClusterId: string | null;
  onSelect: (clusterId: string) => void;
  onClear: () => void;
  /** Resolved "City, State" per group (see useClusterLocations). Absent until lookups settle. */
  locations?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader
        title="Similar complaint groups"
        subtitle="Complaints reported by many people in the same area — a sign of one shared problem"
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
            No repeated complaint patterns found yet — all reports look unique for now.
          </p>
        )}
        {clusters.map((c) => (
          <div
            key={c.clusterId}
            className={
              activeClusterId === c.clusterId
                ? "flex items-center justify-between gap-3 rounded-md border border-primary-600 bg-primary-50 p-3"
                : "flex items-center justify-between gap-3 rounded-md border border-ink-200 p-3"
            }
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">
                {c.area || "Unknown area"}
              </p>
              {locations[c.clusterId] && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-ink-600">
                  <MapPin size={12} className="shrink-0 text-ink-400" />
                  {locations[c.clusterId]}
                </p>
              )}
              <p className="mt-1 truncate text-xs text-ink-500">
                Common words: {c.keywords.join(", ")}
              </p>
              <p className="mt-1 truncate text-xs text-ink-400">
                Example: “{c.sample.slice(0, 120)}”
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-sm bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
                {c.size} report{c.size === 1 ? "" : "s"}
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
