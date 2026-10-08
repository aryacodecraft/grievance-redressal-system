"use client";

import { useEffect, useState } from "react";
import type { Grievance } from "@/lib/types";
import type { TfidfCluster } from "@/lib/tfidf";
import { formatCityState, reverseCityState } from "@/lib/location";

/**
 * Resolve a "City, State" label per similar-complaint group by majority vote
 * of its members' coordinates (via cached Nominatim reverse geocoding).
 *
 * Display-only and best-effort: groups with no pinned members, offline
 * lookups, or ocean points simply get no entry, and callers keep their
 * text-derived area label. Returns `{}` until the first lookup settles.
 */
export function useClusterLocations(
  items: Grievance[],
  clusters: TfidfCluster[]
): Record<string, string> {
  const [locations, setLocations] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    // Unique rounded coordinates first, so N members sharing one spot cost
    // a single lookup however many groups they appear in.
    const coords = new Map<string, { lat: number; lon: number }>();
    for (const c of clusters) {
      for (const i of c.ids) {
        const g = items[i];
        if (!g || g.latitude == null || g.longitude == null) continue;
        const lat = Number(g.latitude);
        const lon = Number(g.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
        coords.set(`${lat.toFixed(4)},${lon.toFixed(4)}`, { lat, lon });
      }
    }

    void (async () => {
      const labels = new Map<string, string | null>();
      await Promise.all(
        [...coords.entries()].map(async ([key, { lat, lon }]) => {
          try {
            const cs = await reverseCityState(lat, lon);
            labels.set(key, formatCityState(cs));
          } catch {
            labels.set(key, null);
          }
        })
      );
      if (cancelled) return;

      const out: Record<string, string> = {};
      for (const c of clusters) {
        const votes: Record<string, number> = {};
        for (const i of c.ids) {
          const g = items[i];
          if (!g || g.latitude == null || g.longitude == null) continue;
          const lat = Number(g.latitude);
          const lon = Number(g.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
          const label = labels.get(`${lat.toFixed(4)},${lon.toFixed(4)}`);
          if (label) votes[label] = (votes[label] ?? 0) + 1;
        }
        const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        if (best) out[c.clusterId] = best[0];
      }
      setLocations(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [items, clusters]);

  return locations;
}
