"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureGroup, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Grievance } from "@/lib/types";
import { reverseGeocode } from "@/lib/location";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 68.0],
  [38.0, 98.0],
];

/**
 * Admin map (Leaflet + OpenStreetMap), client-only.
 * Markers follow the currently filtered list; `focusId` recentres and opens
 * the popup for a single grievance ("Open on Map").
 * Bound to the geographic boundaries of India.
 */
export function AdminMap({
  items,
  focusId,
  onFocusHandled,
  heightClassName = "h-[28rem] sm:h-[32rem]",
}: {
  items: Grievance[];
  focusId: string | null;
  onFocusHandled: () => void;
  /** Tailwind height classes for the map viewport (caller-owned sizing). */
  heightClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<FeatureGroup | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const [ready, setReady] = useState(false);

  // Initialise the map once, on the client, constrained to India.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        maxBounds: INDIA_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 4,
        maxZoom: 19,
      }).setView([22.0, 79.0], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        minZoom: 4,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.featureGroup().addTo(map);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = {};
      setReady(false);
    };
  }, []);

  // Re-render markers whenever the filtered set changes.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (cancelled || !map || !layer) return;

      layer.clearLayers();
      markersRef.current = {};

      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#ff6b00;border:2px solid #fff;box-shadow:0 0 0 1px #ff6b00;"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -7],
      });

      const pts: [number, number][] = [];
      items.forEach((g) => {
        if (g.latitude == null || g.longitude == null) return;
        const lat = Number(g.latitude);
        const lon = Number(g.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        // Restrict markers to the bounds of India.
        if (lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) return;

        const marker = L.marker([lat, lon], { icon }).addTo(layer);
        marker.bindPopup(
          `<strong>${escapeHtml(g.title || "Untitled")}</strong>` +
            (g.imageUrl
              ? `<br/><img src="${escapeHtml(g.imageUrl)}" style="max-width:180px;max-height:120px;display:block;margin-top:6px;border-radius:6px;">`
              : "") +
            `<br/><span data-location-label="${escapeHtml(g.id)}" style="color:#71717a;font-size:11px;">Resolving area…</span>`
        );
        markersRef.current[g.id] = marker;
        pts.push([lat, lon]);

        // Upgrade the popup with a human-readable area; coordinates are never
        // rendered as user-facing text.
        void reverseGeocode(lat, lon).then((place) => {
          if (!place || cancelled) return;
          const popupEl = (marker.getPopup()?.getElement() as HTMLElement | null)?.querySelector(
            `[data-location-label="${CSS.escape(g.id)}"]`
          );
          if (popupEl) {
            popupEl.textContent = place.name;
          }
        });
      });

      if (pts.length) {
        try {
          map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
        } catch {
          /* ignore invalid bounds */
        }
      } else {
        try {
          map.fitBounds(INDIA_BOUNDS, { padding: [20, 20] });
        } catch {
          /* ignore */
        }
      }
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          /* ignore */
        }
      }, 150);
    })();

    return () => {
      cancelled = true;
    };
  }, [items, ready]);

  // Recentre when asked from the detail panel.
  useEffect(() => {
    if (!focusId || !ready) return;
    const marker = markersRef.current[focusId];
    const map = mapRef.current;
    if (marker && map) {
      map.setView(marker.getLatLng(), 15);
      marker.openPopup();
    }
    onFocusHandled();
  }, [focusId, ready, onFocusHandled]);

  return (
    <div
      ref={containerRef}
      // `relative z-0` forms a stacking context so Leaflet's internal
      // panes (z-index 200–1000) can never paint above the sticky site
      // header (`z-40`) or the review modal (`z-50`) when scrolled.
      className={`${heightClassName} relative z-0 w-full overflow-hidden rounded-md border border-ink-200`}
      role="application"
      aria-label="Grievance locations map"
    />
  );
}
