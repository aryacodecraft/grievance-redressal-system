"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Single-location Leaflet map for the grievance review modal.
 * Client-only; renders exactly one pin and centres on it.
 */
export function SinglePinMap({
  latitude,
  longitude,
  title,
}: {
  latitude: number;
  longitude: number;
  title?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([latitude, longitude], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:#ff6b00;border:3px solid #fff;box-shadow:0 0 0 1px #ff6b00;"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8],
      });

      L.marker([latitude, longitude], { icon })
        .addTo(map)
        .bindPopup(escapeHtml(title || "Grievance location"));

      mapRef.current = map;
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
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, title]);

  return (
    <div
      ref={containerRef}
      // Same stacking-context containment as AdminMap: Leaflet's panes
      // must stay inside the modal, below its own overlay chrome.
      className="relative z-0 h-56 w-full overflow-hidden rounded-md border border-ink-200"
      role="application"
      aria-label="Grievance location map"
    />
  );
}
