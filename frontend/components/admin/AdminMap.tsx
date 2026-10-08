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

/**
 * Admin map (Leaflet + OpenStreetMap), client-only.
 * Markers follow the currently filtered list; `focusId` recentres and opens
 * the popup for a single grievance ("Open on Map").
 */
export function AdminMap({
  items,
  focusId,
  onFocusHandled,
  heightClassName = "h-80",
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

  // Initialise the map once, on the client.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current || !containerRef.current) return;
      const map = L.map(containerRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
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
        html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#026bc7;border:2px solid #fff;box-shadow:0 0 0 1px #026bc7;"></span>',
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

        const marker = L.marker([lat, lon], { icon }).addTo(layer);
        marker.bindPopup(
          `<strong>${escapeHtml(g.title || "Untitled")}</strong>` +
            (g.imageUrl
              ? `<br/><img src="${escapeHtml(g.imageUrl)}" style="max-width:180px;max-height:120px;display:block;margin-top:6px;border-radius:6px;">`
              : "") +
            `<br/><span data-loc="${lat},${lon}" style="color:#64748b;font-size:11px;">${escapeHtml(g.userId || "-")}</span>`
        );
        markersRef.current[g.id] = marker;
        pts.push([lat, lon]);

        // Upgrade the popup's last line from the reporter id to a real place
        // name once reverse geocoding resolves (coordinates as fallback).
        void reverseGeocode(lat, lon).then((place) => {
          if (!place || cancelled) return;
          const popupEl = (marker.getPopup()?.getElement() as HTMLElement | null)?.querySelector(
            `[data-loc="${lat},${lon}"]`
          );
          if (popupEl) {
            popupEl.textContent = place.name;
          }
        });
      });

      if (pts.length) {
        try {
          map.fitBounds(pts, { padding: [40, 40] });
        } catch {
          /* ignore invalid bounds */
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
    if (!focusId || !ready || !focusId) return;
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
