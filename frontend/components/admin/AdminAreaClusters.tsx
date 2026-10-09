"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Grievance } from "@/lib/types";
import { reverseGeocode } from "@/lib/location";

export interface AreaCluster {
  key: string;
  latitude: number;
  longitude: number;
  items: Grievance[];
}

export function buildAreaClusters(items: Grievance[], precision = 2): AreaCluster[] {
  const groups = new Map<string, AreaCluster>();
  items.forEach((item) => {
    if (item.latitude == null || item.longitude == null) return;
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const key = `${latitude.toFixed(precision)},${longitude.toFixed(precision)}`;
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { key, latitude, longitude, items: [item] });
  });
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}

export function AdminAreaClusters({ clusters }: { clusters: AreaCluster[] }) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void Promise.all(clusters.slice(0, 9).map(async (cluster) => {
      const place = await reverseGeocode(cluster.latitude, cluster.longitude);
      return [cluster.key, place?.name ?? "Area name unavailable"] as const;
    })).then((entries) => { if (!cancelled) setNames(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [clusters]);
  return (
    <Card className="border-ink-200/80 shadow-2xs">
      <CardHeader title="Area concentration analysis" subtitle="Nearby pinned complaints grouped into local hotspots for faster field planning." />
      <CardBody>
        {clusters.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">No pinned locations are available for area analysis yet.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.slice(0, 9).map((cluster, index) => <div key={cluster.key} className="rounded-md border border-ink-200 bg-ink-50/40 p-3">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Hotspot {index + 1}</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-ink-900"><MapPin size={14} className="text-primary-700" />{names[cluster.key] ?? "Resolving area…"}</p></div><span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">{cluster.items.length}</span></div>
            <p className="mt-2 text-xs text-ink-500">{cluster.items.filter((item) => item.priority === "high").length} high-priority · {cluster.items.filter((item) => item.status !== "resolved" && item.status !== "closed").length} open</p>
            <p className="mt-1 truncate text-xs text-ink-600">{cluster.items[0]?.title ?? "Pinned grievance area"}</p>
          </div>)}
        </div>}
      </CardBody>
    </Card>
  );
}
