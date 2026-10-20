"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Crosshair, Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useI18n } from "@/lib/i18n";
import { forwardGeocode, reverseGeocode, type GeocodeSearchResult } from "@/lib/location";

export interface Coords {
  latitude: number;
  longitude: number;
  address?: string;
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 68.0],
  [38.0, 98.0],
];

export function LocationCapture({
  onChange,
  suggestedSearch,
}: {
  onChange: (coords: Coords | null) => void;
  /** Voice-derived search bias (DEC-038): populates the search box and shows
   *  the matching list for an explicit pick — it never auto-pins a result and
   *  never uses the device position as the incident location. */
  suggestedSearch?: { text: string; token: number } | null;
}) {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<{
    map: import("leaflet").Map;
    marker?: import("leaflet").Marker;
  } | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<Coords | null>(null);
  const [resolvedPlace, setResolvedPlace] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "busy" | "done" | "denied">("idle");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Manual typing / search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // GPS capture handler
  function captureGps() {
    if (!navigator.geolocation) {
      setGpsState("denied");
      return;
    }
    setGpsState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setGpsState("done");
        updateLocation(next);
      },
      () => {
        setGpsState("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Update selected location, reverse-geocode place name, and update Leaflet pin
  function updateLocation(coords: Coords, knownLabel?: string) {
    setSelectedCoords(coords);
    onChange(coords);
    setMapError(null);
    setSearchError(null);
    setSearchResults([]);

    if (knownLabel) {
      setResolvedPlace(knownLabel);
      onChange({ ...coords, address: knownLabel });
    } else {
      void reverseGeocode(coords.latitude, coords.longitude).then((place) => {
        if (place?.name) {
          setResolvedPlace(place.name);
          onChange({ ...coords, address: place.name });
        }
      });
    }

    // If map is currently loaded, pan and update marker
    const map = leafletRef.current?.map;
    if (map) {
      map.setView([coords.latitude, coords.longitude], 15);
      if (leafletRef.current?.marker) {
        leafletRef.current.marker.setLatLng([coords.latitude, coords.longitude]);
      }
    }
  }

  // Manual address search handler (confirmSingle=false keeps single-result
  // matches visible as a suggestion list instead of pinning them silently).
  async function runSearch(rawQuery: string, options?: { confirmSingle?: boolean }) {
    const query = rawQuery.trim();
    if (!query) return;
    const confirmSingle = options?.confirmSingle ?? true;

    setSearchBusy(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const results = await forwardGeocode(query);
      if (results.length === 0) {
        setSearchError("No location found. Please refine your search or pick directly on the map.");
      } else if (results.length === 1 && confirmSingle) {
        const top = results[0];
        updateLocation(
          { latitude: top.latitude, longitude: top.longitude, address: top.displayName || top.name },
          top.displayName || top.name
        );
        setSearchQuery("");
      } else {
        setSearchResults(results);
      }
    } catch {
      setSearchError("Search failed. Check your internet connection or pick directly on the map.");
    } finally {
      setSearchBusy(false);
    }
  }

  function handleSearch() {
    void runSearch(searchQuery);
  }

  // Voice-assisted intake may hand us a place the citizen described verbally.
  // Seed the search box and present matches; selecting one stays explicit.
  useEffect(() => {
    if (!suggestedSearch || !suggestedSearch.text.trim()) return undefined;
    const text = suggestedSearch.text;
    const handle = window.setTimeout(() => {
      setSearchQuery(text);
      void runSearch(text, { confirmSingle: false });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [suggestedSearch?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize or update Leaflet map when mapOpen is toggled
  useEffect(() => {
    if (!mapOpen || !mapRef.current) return;
    let cancelled = false;
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined;

    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !mapRef.current) return;
      if (leafletRef.current?.map) {
        leafletRef.current.map.invalidateSize();
        return;
      }

      const initialCenter: [number, number] = selectedCoords
        ? [selectedCoords.latitude, selectedCoords.longitude]
        : [22.0, 79.0];
      const initialZoom = selectedCoords ? 15 : 5;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        maxBounds: INDIA_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 4,
        maxZoom: 19,
      }).setView(initialCenter, initialZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        minZoom: 4,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#ff6b00;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);transform:rotate(-45deg)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 20],
      });

      let marker: import("leaflet").Marker | undefined;
      if (selectedCoords) {
        marker = L.marker([selectedCoords.latitude, selectedCoords.longitude], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", () => {
          const pt = marker!.getLatLng();
          updateLocation({ latitude: pt.lat, longitude: pt.lng });
        });
      }

      map.on("click", (event) => {
        const { lat, lng } = event.latlng;
        // Limit to India
        if (lat < 6.0 || lat > 38.0 || lng < 68.0 || lng > 98.0) {
          setMapError("Please pick a location within India.");
          return;
        }
        setMapError(null);

        if (leafletRef.current?.marker) {
          leafletRef.current.marker.setLatLng([lat, lng]);
        } else {
          const newMarker = L.marker([lat, lng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);
          newMarker.on("dragend", () => {
            const pt = newMarker.getLatLng();
            updateLocation({ latitude: pt.lat, longitude: pt.lng });
          });
          leafletRef.current = { map, marker: newMarker };
        }
        updateLocation({ latitude: lat, longitude: lng });
      });

      leafletRef.current = { map, marker };

      invalidateTimer = setTimeout(() => {
        if (!cancelled) {
          try {
            map.invalidateSize();
          } catch {
            /* map already unmounted */
          }
        }
      }, 100);
    });

    return () => {
      cancelled = true;
      if (invalidateTimer) clearTimeout(invalidateTimer);
      leafletRef.current?.map.remove();
      leafletRef.current = null;
    };
  }, [mapOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearLocation() {
    setSelectedCoords(null);
    setResolvedPlace(null);
    setGpsState("idle");
    setMapError(null);
    setSearchError(null);
    setSearchResults([]);
    onChange(null);
    if (leafletRef.current?.marker) {
      leafletRef.current.marker.remove();
      leafletRef.current.marker = undefined;
    }
  }

  return (
    <Field label={t("incidentLocation")} required hint={t("locHint")}>
      <div className="space-y-3">
        {/* Selected location confirmation banner */}
        {selectedCoords ? (
          <div className="flex items-start justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-950">
                  {resolvedPlace || selectedCoords.address || "Location pinned"}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-emerald-700">
                  {selectedCoords.latitude.toFixed(5)}, {selectedCoords.longitude.toFixed(5)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearLocation}
              className="rounded p-1 text-ink-400 hover:bg-emerald-100 hover:text-ink-700"
              title="Clear and change location"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {/* Manual Location Search Input */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            Type location or landmark manually
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  // Never let Enter bubble into the enclosing grievance form.
                  e.preventDefault();
                  if (!searchBusy && searchQuery.trim()) void handleSearch();
                }}
                placeholder="Type area, city, or landmark (e.g. Connaught Place, Delhi)"
                className="pl-8 text-base sm:text-xs h-10 sm:h-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={searchBusy || !searchQuery.trim()}
              onClick={() => void handleSearch()}
              className="h-10 sm:h-9 px-3.5 sm:px-3 text-xs shrink-0"
            >
              {searchBusy ? <Loader2 size={13} className="animate-spin" /> : "Search"}
            </Button>
          </div>
          {searchError && (
            <p className="mt-1 text-[11px] font-medium text-rose-600">{searchError}</p>
          )}

          {/* Multiple search results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-ink-200 bg-white p-1 shadow-md">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Select matching place:
              </p>
              {searchResults.map((res, i) => (
                <button
                  key={`${res.latitude}-${res.longitude}-${i}`}
                  type="button"
                  onClick={() => {
                    updateLocation(
                      { latitude: res.latitude, longitude: res.longitude, address: res.displayName || res.name },
                      res.displayName || res.name
                    );
                    setSearchQuery("");
                  }}
                  className="flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-primary-50 hover:text-primary-900"
                >
                  <MapPin size={12} className="mt-0.5 shrink-0 text-primary-600" />
                  <div className="min-w-0">
                    <p className="font-medium break-words sm:truncate">{res.name}</p>
                    <p className="text-[10px] text-ink-500 break-words sm:truncate">{res.displayName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick GPS & Map Toggle Actions */}
        <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={captureGps}
            disabled={gpsState === "busy"}
            className="flex-1 min-w-[130px] sm:min-w-[140px] text-xs h-10 sm:h-9 justify-center gap-1.5"
          >
            {gpsState === "busy" ? (
              <>
                <Loader2 size={13} className="animate-spin text-primary-600" />
                {t("locBusy")}
              </>
            ) : (
              <>
                <Navigation size={13} className="text-primary-700" />
                {gpsState === "done" ? t("locCaptured") : t("locPin")}
              </>
            )}
          </Button>

          <Button
            type="button"
            variant={mapOpen ? "primary" : "secondary"}
            size="sm"
            onClick={() => setMapOpen(!mapOpen)}
            className="flex-1 min-w-[130px] sm:min-w-[140px] text-xs h-10 sm:h-9 justify-center gap-1.5"
          >
            <Crosshair size={13} />
            {mapOpen ? t("locCloseMap") : "Pick place on map"}
          </Button>
        </div>

        {gpsState === "denied" && (
          <p className="text-[11px] text-rose-500">{t("locDenied")}</p>
        )}

        {/* Map View (ALWAYS ACCESSIBLE, NO RADIUS LIMITER) */}
        {mapOpen && (
          <div className="overflow-hidden rounded-md border border-ink-200">
            <div
              ref={mapRef}
              className="h-48 sm:h-64 w-full cursor-crosshair relative z-0"
              role="application"
              aria-label="Choose grievance location map"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 bg-ink-50 px-3 py-2 text-[11px] text-ink-600">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-primary-700" />
                Click anywhere on the map or drag the pin.
              </span>
              <span className="text-[10px] text-ink-400">Pan anywhere across India (no radius limit)</span>
            </div>
          </div>
        )}

        {mapError && <p className="text-[11px] font-medium text-rose-600">{mapError}</p>}
      </div>
    </Field>
  );
}
