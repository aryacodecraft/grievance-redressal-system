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

interface GeoCluster {
  id: string;
  lat: number;
  lon: number;
  items: Grievance[];
}

/**
 * Admin map (Leaflet + OpenStreetMap), client-only.
 * Visualizes complaint concentrations by coordinates and validated administrative areas.
 * Uses density-scaled markers when multiple complaints cluster at or near the same location.
 * Gracefully reports complaints missing geographic coordinates.
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
  const [viewMode, setViewMode] = useState<"density" | "pins">("density");

  const validItems = items.filter((g) => {
    if (g.latitude == null || g.longitude == null) return false;
    const lat = Number(g.latitude);
    const lon = Number(g.longitude);
    return !Number.isNaN(lat) && !Number.isNaN(lon) && lat >= 6.0 && lat <= 38.0 && lon >= 68.0 && lon <= 98.0;
  });
  const missingCount = items.length - validItems.length;

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

  // Re-render markers and density hotspots whenever items, ready state, or viewMode changes.
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

      // Group nearby complaints within ~0.02 deg (~2km) for density hotspot clustering
      const clusters: GeoCluster[] = [];
      const precision = viewMode === "density" ? 0.02 : 0.0001;

      validItems.forEach((g) => {
        const lat = Number(g.latitude);
        const lon = Number(g.longitude);

        let match = clusters.find(
          (c) => Math.abs(c.lat - lat) < precision && Math.abs(c.lon - lon) < precision
        );
        if (!match) {
          match = { id: `cluster-${clusters.length}`, lat, lon, items: [] };
          clusters.push(match);
        }
        match.items.push(g);
      });

      const pts: [number, number][] = [];

      clusters.forEach((cluster) => {
        const count = cluster.items.length;
        pts.push([cluster.lat, cluster.lon]);

        let iconHtml = "";
        let iconSize: [number, number] = [14, 14];
        let iconAnchor: [number, number] = [7, 7];

        if (viewMode === "density" && count > 1) {
          // Density-scaled circle marker with count badge
          const size = count >= 5 ? 32 : 24;
          iconSize = [size, size];
          iconAnchor = [size / 2, size / 2];
          const bg = count >= 5 ? "#dc2626" : "#ff5500";
          iconHtml = `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;font-weight:700;font-size:${count >= 5 ? 12 : 11}px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">${count}</div>`;

          // Add a subtle semi-transparent heat ring around hotspots
          if (count >= 3) {
            L.circle([cluster.lat, cluster.lon], {
              radius: Math.min(2500, 400 + count * 200),
              color: bg,
              weight: 1,
              fillColor: bg,
              fillOpacity: 0.12,
            }).addTo(layer);
          }
        } else {
          // Single complaint pin
          iconHtml = '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#ff5500;border:2px solid #fff;box-shadow:0 0 0 1px #ff5500;"></span>';
        }

        const icon = L.divIcon({
          className: "",
          html: iconHtml,
          iconSize,
          iconAnchor,
          popupAnchor: [0, -iconAnchor[1]],
        });

        const marker = L.marker([cluster.lat, cluster.lon], { icon }).addTo(layer);

        // Map cluster items to this marker
        cluster.items.forEach((g) => {
          markersRef.current[g.id] = marker;
        });

        // Popup content showing cluster details or single item
        let popupContent = "";
        if (cluster.items.length === 1) {
          const g = cluster.items[0];
          popupContent =
            `<strong>${escapeHtml(g.title || "Untitled")}</strong>` +
            (g.imageUrl
              ? `<br/><img src="${escapeHtml(g.imageUrl)}" style="max-width:180px;max-height:120px;display:block;margin-top:6px;border-radius:6px;">`
              : "") +
            `<br/><span style="display:inline-block;padding:2px 6px;margin-top:4px;border-radius:4px;background:#f4f4f5;font-size:10px;font-weight:600;color:#52525b;">${escapeHtml(g.status || "open")} · Priority: ${escapeHtml(g.priority || "low")}</span>` +
            `<br/><span data-location-label="${escapeHtml(cluster.id)}" style="color:#71717a;font-size:11px;">Resolving area…</span>`;
        } else {
          popupContent =
            `<div style="max-width:240px;">` +
            `<strong style="color:#ff5500;font-size:13px;">🔥 Hotspot: ${count} complaints</strong>` +
            `<br/><span data-location-label="${escapeHtml(cluster.id)}" style="color:#71717a;font-size:11px;">Resolving area…</span>` +
            `<div style="margin-top:6px;max-height:140px;overflow-y:auto;border-top:1px solid #e4e4e7;padding-top:4px;">` +
            cluster.items
              .map(
                (g) =>
                  `<div style="padding:3px 0;font-size:11px;border-bottom:1px solid #f4f4f5;">` +
                  `<strong>${escapeHtml(g.title || "Untitled")}</strong>` +
                  `<br/><span style="color:#71717a;font-size:10px;">${escapeHtml(g.status || "open")} · ${escapeHtml(g.priority || "low")}</span>` +
                  `</div>`
              )
              .join("") +
            `</div></div>`;
        }

        marker.bindPopup(popupContent);

        // Reverse geocode cluster location
        void reverseGeocode(cluster.lat, cluster.lon).then((place) => {
          if (!place || cancelled) return;
          const popupEl = (marker.getPopup()?.getElement() as HTMLElement | null)?.querySelector(
            `[data-location-label="${CSS.escape(cluster.id)}"]`
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
  }, [items, ready, viewMode, validItems]);

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
    <div className="relative">
      {/* Map display mode controls & coordinate metrics */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-md border border-ink-200/80 bg-white/90 p-1 shadow-xs backdrop-blur-xs">
        <button
          type="button"
          onClick={() => setViewMode("density")}
          className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
            viewMode === "density"
              ? "bg-primary-600 text-white"
              : "text-ink-600 hover:text-ink-950"
          }`}
        >
          Hotspot Density
        </button>
        <button
          type="button"
          onClick={() => setViewMode("pins")}
          className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
            viewMode === "pins"
              ? "bg-primary-600 text-white"
              : "text-ink-600 hover:text-ink-950"
          }`}
        >
          All Pins
        </button>
      </div>

      <div
        ref={containerRef}
        // `relative z-0` forms a stacking context so Leaflet's internal
        // panes (z-index 200–1000) can never paint above the sticky site
        // header (`z-40`) or the review modal (`z-50`) when scrolled.
        className={`${heightClassName} relative z-0 w-full overflow-hidden rounded-md border border-ink-200`}
        role="application"
        aria-label="Grievance locations map"
      />

      {/* Graceful missing coordinate banner */}
      <div className="mt-2 flex items-center justify-between text-xs text-ink-500 px-1">
        <span>
          📍 <strong>{validItems.length}</strong> mapped
          {missingCount > 0 ? (
            <span className="ml-1 text-amber-700">
              · {missingCount} complaint{missingCount === 1 ? "" : "s"} lack coordinates and are excluded from the map
            </span>
          ) : (
            <span className="ml-1 text-emerald-700">· All complaints mapped</span>
          )}
        </span>
        <span className="text-[11px] text-ink-400">Click markers to view details</span>
      </div>
    </div>
  );
}
