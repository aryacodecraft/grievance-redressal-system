"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";
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
  searchLanguage,
}: {
  onChange: (coords: Coords | null) => void;
  /** Voice-derived search bias (DEC-038): populates the search box and shows
   *  the matching list for an explicit pick — it never auto-pins a result and
   *  never uses the device position as the incident location. */
  suggestedSearch?: { text: string; token: number } | null;
  /** Search labels should match the citizen's typed or spoken language. */
  searchLanguage?: string;
}) {
  const { t, language } = useI18n();
  const geocodeLanguage = searchLanguage || language;

  // Primary selected state passed to parent
  const [selectedCoords, setSelectedCoords] = useState<Coords | null>(null);
  const [resolvedPlace, setResolvedPlace] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "busy" | "done" | "denied">("idle");

  // Form-level search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Pop-out Map Modal Window state (DEC-050)
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [modalCoords, setModalCoords] = useState<Coords | null>(null);
  const [modalPlace, setModalPlace] = useState<string | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchBusy, setModalSearchBusy] = useState(false);
  const [modalSearchResults, setModalSearchResults] = useState<GeocodeSearchResult[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  const modalMapRef = useRef<HTMLDivElement>(null);
  const modalGeocodeRequestRef = useRef(0);
  const leafletRef = useRef<{
    map: import("leaflet").Map;
    marker?: import("leaflet").Marker;
    placePin?: (latitude: number, longitude: number, knownLabel?: string) => void;
  } | null>(null);

  // GPS capture helper
  function captureGps(inModal = false) {
    if (!navigator.geolocation) {
      if (inModal) setModalError("Geolocation is not supported by your browser.");
      else setGpsState("denied");
      return;
    }
    if (!inModal) setGpsState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        if (!inModal) {
          setGpsState("done");
          updateLocation(next);
        } else {
          setModalCoords(next);
          setModalError(null);
          leafletRef.current?.placePin?.(next.latitude, next.longitude);
          const map = leafletRef.current?.map;
          if (map) {
            map.setView([next.latitude, next.longitude], 16);
            if (leafletRef.current?.marker) {
              leafletRef.current.marker.setLatLng([next.latitude, next.longitude]);
            }
          }
        }
      },
      () => {
        if (!inModal) setGpsState("denied");
        else setModalError("Could not retrieve GPS location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Update selected location in parent form
  function updateLocation(coords: Coords, knownLabel?: string) {
    setSelectedCoords(coords);
    onChange(coords);
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
  }

  function clearLocation() {
    setSelectedCoords(null);
    setResolvedPlace(null);
    setGpsState("idle");
    setSearchError(null);
    setSearchResults([]);
    onChange(null);
  }

  // Address search runner
  async function runSearch(
    rawQuery: string,
    inModal = false,
    options?: { confirmSingle?: boolean }
  ) {
    const query = rawQuery.trim();
    if (!query) return;
    const confirmSingle = options?.confirmSingle ?? true;

    if (inModal) {
      setModalSearchBusy(true);
      setModalError(null);
      setModalSearchResults([]);
    } else {
      setSearchBusy(true);
      setSearchError(null);
      setSearchResults([]);
    }

    try {
      const results = await forwardGeocode(query, geocodeLanguage);
      if (results.length === 0) {
        const msg = "No matching location found. Please try a different area or landmark.";
        if (inModal) setModalError(msg);
        else setSearchError(msg);
      } else if (results.length === 1 && confirmSingle) {
        const top = results[0];
        const next = {
          latitude: top.latitude,
          longitude: top.longitude,
          address: top.displayName || top.name,
        };
        if (inModal) {
          leafletRef.current?.placePin?.(top.latitude, top.longitude, top.displayName || top.name);
          setModalCoords(next);
          setModalPlace(top.displayName || top.name);
          setModalSearchQuery("");
          const map = leafletRef.current?.map;
          if (map) {
            map.setView([top.latitude, top.longitude], 16);
            if (leafletRef.current?.marker) {
              leafletRef.current.marker.setLatLng([top.latitude, top.longitude]);
            }
          }
        } else {
          updateLocation(next, top.displayName || top.name);
          setSearchQuery("");
        }
      } else {
        if (inModal) setModalSearchResults(results);
        else setSearchResults(results);
      }
    } catch {
      const msg = "Location search failed. Please verify your internet connection.";
      if (inModal) setModalError(msg);
      else setSearchError(msg);
    } finally {
      if (inModal) setModalSearchBusy(false);
      else setSearchBusy(false);
    }
  }

  // Voice-suggested place handling
  useEffect(() => {
    if (!suggestedSearch || !suggestedSearch.text.trim()) return undefined;
    const text = suggestedSearch.text;
    const handle = window.setTimeout(() => {
      setSearchQuery(text);
      void runSearch(text, false, { confirmSingle: false });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [suggestedSearch?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open the pop-out map modal
  function openMapModal() {
    setModalCoords(selectedCoords);
    setModalPlace(resolvedPlace || selectedCoords?.address || null);
    setModalSearchQuery("");
    setModalSearchResults([]);
    setModalError(null);
    setMapModalOpen(true);
  }

  // Close map modal without saving unconfirmed changes
  function closeMapModal() {
    setMapModalOpen(false);
  }

  // Confirm and apply map selection
  function confirmModalLocation() {
    if (modalCoords) {
      updateLocation(modalCoords, modalPlace || undefined);
    }
    setMapModalOpen(false);
  }

  // Initialize Leaflet map whenever modal opens
  useEffect(() => {
    if (!mapModalOpen) return;
    let cancelled = false;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | null = null;
    let pointerCleanup: (() => void) | null = null;

    void import("leaflet")
      .then((leafletModule) => {
        if (cancelled || !modalMapRef.current) return;
        const L = leafletModule.default ?? leafletModule;
        if (!L || typeof L.map !== "function") {
          console.error("Leaflet failed to load properly", leafletModule);
          return;
        }

        // Clean up any stale leaflet state on the DOM node to prevent
        // "Map container is already initialized" errors
        const mapElement = modalMapRef.current as HTMLDivElement & { _leaflet_id?: number };
        if (mapElement._leaflet_id) {
          delete mapElement._leaflet_id;
        }
        if (leafletRef.current?.map) {
          try {
            leafletRef.current.map.remove();
          } catch {
            /* ignore */
          }
          leafletRef.current = null;
        }

        const validCoords =
          modalCoords &&
          !isNaN(modalCoords.latitude) &&
          !isNaN(modalCoords.longitude);
        const initialCenter: [number, number] = validCoords
          ? [modalCoords.latitude, modalCoords.longitude]
          : [22.0, 79.0]; // Center of India
        const initialZoom = validCoords ? 15 : 5;

        const map = L.map(modalMapRef.current, {
          zoomControl: true,
          attributionControl: true,
          maxBounds: INDIA_BOUNDS,
          maxBoundsViscosity: 1.0,
          minZoom: 4,
          maxZoom: 19,
        }).setView(initialCenter, initialZoom);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          minZoom: 4,
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: "",
          html: '<span style="display:block;width:24px;height:24px;border-radius:50% 50% 50% 0;background:#ff5500;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transform:rotate(-45deg)"></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 22],
        });

        let marker: import("leaflet").Marker | undefined;

        function placePin(lat: number, lng: number, knownLabel?: string) {
          if (lat < 6.0 || lat > 38.0 || lng < 68.0 || lng > 98.0) {
            setModalError("Please choose a location within India.");
            return;
          }
          setModalError(null);
          const requestId = ++modalGeocodeRequestRef.current;
          const next: Coords = { latitude: lat, longitude: lng };
          setModalCoords(next);
          if (knownLabel) {
            setModalPlace(knownLabel);
          } else {
            setModalPlace(null);
            void reverseGeocode(lat, lng).then((p) => {
              if (requestId === modalGeocodeRequestRef.current && p?.name) setModalPlace(p.name);
            });
          }

          if (marker) {
            marker.setLatLng([lat, lng]);
          } else {
            const m = L.marker([lat, lng], {
              icon: pinIcon,
              draggable: true,
            }).addTo(map);

            m.on("dragend", () => {
              const pt = m.getLatLng();
              placePin(pt.lat, pt.lng);
            });
            marker = m;
          }
          if (leafletRef.current?.map === map) {
            leafletRef.current = { map, marker, placePin };
          }
        }

        if (validCoords) {
          placePin(modalCoords.latitude, modalCoords.longitude, modalPlace || undefined);
        }

        // Use a short pointer gesture as the primary map selection path. This
        // works consistently for mouse clicks and touch taps; pans/drags do not
        // accidentally select a location. Marker dragging remains supported.
        const container = map.getContainer();
        let pointerStart: { x: number; y: number } | null = null;
        const onPointerDown = (event: PointerEvent) => {
          if ((event.target as HTMLElement).closest(".leaflet-control")) {
            pointerStart = null;
            return;
          }
          pointerStart = { x: event.clientX, y: event.clientY };
        };
        const onPointerUp = (event: PointerEvent) => {
          const start = pointerStart;
          pointerStart = null;
          if (!start || (event.target as HTMLElement).closest(".leaflet-control")) return;
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
          const rect = container.getBoundingClientRect();
          const point = L.point(event.clientX - rect.left, event.clientY - rect.top);
          const latlng = map.containerPointToLatLng(point);
          placePin(latlng.lat, latlng.lng);
        };
        const onPointerCancel = () => { pointerStart = null; };
        container.addEventListener("pointerdown", onPointerDown);
        container.addEventListener("pointerup", onPointerUp);
        container.addEventListener("pointercancel", onPointerCancel);
        pointerCleanup = () => {
          container.removeEventListener("pointerdown", onPointerDown);
          container.removeEventListener("pointerup", onPointerUp);
          container.removeEventListener("pointercancel", onPointerCancel);
        };

        leafletRef.current = { map, marker, placePin };

        // Guarantee tile rendering: multiple staggered invalidations + ResizeObserver
        requestAnimationFrame(() => {
          if (!cancelled && map) {
            try {
              map.invalidateSize();
            } catch {}
          }
        });
        t1 = setTimeout(() => {
          if (!cancelled && map) {
            try {
              map.invalidateSize();
            } catch {}
          }
        }, 100);
        t2 = setTimeout(() => {
          if (!cancelled && map) {
            try {
              map.invalidateSize();
            } catch {}
          }
        }, 300);
        t3 = setTimeout(() => {
          if (!cancelled && map) {
            try {
              map.invalidateSize();
            } catch {}
          }
        }, 600);

        if (typeof ResizeObserver !== "undefined" && modalMapRef.current) {
          resizeObserver = new ResizeObserver(() => {
            if (!cancelled && map) {
              try {
                map.invalidateSize();
              } catch {}
            }
          });
          resizeObserver.observe(modalMapRef.current);
        }
      })
      .catch((err) => {
        console.error("Failed to initialize Leaflet map in modal:", err);
      });

    return () => {
      cancelled = true;
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
      if (resizeObserver) resizeObserver.disconnect();
      pointerCleanup?.();
      if (leafletRef.current?.map) {
        try {
          leafletRef.current.map.remove();
        } catch {}
        leafletRef.current = null;
      }
    };
  }, [mapModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard Escape listener for modal
  useEffect(() => {
    if (!mapModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMapModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapModalOpen]);

  return (
    <Field label={t("incidentLocation")} required hint={t("locHint")}>
      <div className="space-y-3">
        {/* Selected location confirmation banner */}
        {selectedCoords ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 sm:p-3.5 text-xs shadow-2xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="font-bold text-emerald-950 text-sm break-words">
                  {resolvedPlace || selectedCoords.address || "Location Verified & Pinned"}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-emerald-800">
                  {selectedCoords.latitude.toFixed(5)}, {selectedCoords.longitude.toFixed(5)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openMapModal}
                className="h-8 px-2.5 text-xs text-ink-700 hover:text-ink-950"
              >
                Change on Map
              </Button>
              <button
                type="button"
                onClick={clearLocation}
                className="rounded p-1.5 text-ink-400 hover:bg-emerald-200/60 hover:text-ink-800 transition-colors"
                title="Clear and reset location"
                aria-label="Clear location"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Action Buttons: Responsive, equal size, no emojis */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Pick on Map Button - Opens Popout Modal */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openMapModal}
            className="w-full sm:flex-1 h-10 px-3 text-xs sm:text-sm font-medium justify-center items-center gap-2 text-ink-800"
          >
            <MapPin size={15} className="text-primary-700 shrink-0" />
            <span>{selectedCoords ? "Adjust pin on map" : "Pick on map"}</span>
          </Button>

          {/* GPS Quick Capture Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => captureGps(false)}
            disabled={gpsState === "busy"}
            className="w-full sm:flex-1 h-10 px-3 text-xs sm:text-sm font-medium justify-center items-center gap-2 text-ink-800"
          >
            {gpsState === "busy" ? (
              <>
                <Loader2 size={15} className="animate-spin text-primary-600 shrink-0" />
                <span>{t("locBusy")}</span>
              </>
            ) : (
              <>
                <Navigation size={15} className="text-primary-700 shrink-0" />
                <span>{gpsState === "done" ? t("locCaptured") : t("locPin")}</span>
              </>
            )}
          </Button>
        </div>

        {gpsState === "denied" && (
          <p className="text-[11px] font-medium text-rose-600">{t("locDenied")}</p>
        )}

        {/* Manual Address Search Option */}
        <div className="pt-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            Or type area or landmark name
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-3 text-ink-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (!searchBusy && searchQuery.trim()) void runSearch(searchQuery);
                }}
                placeholder="e.g. MG Road, Bengaluru or Sector 18, Noida"
                className="pl-9 text-base sm:text-xs h-11 sm:h-10"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={searchBusy || !searchQuery.trim()}
              onClick={() => void runSearch(searchQuery)}
              className="h-11 sm:h-10 px-4 text-xs font-semibold shrink-0"
            >
              {searchBusy ? <Loader2 size={14} className="animate-spin" /> : "Search"}
            </Button>
          </div>
          {searchError && (
            <p className="mt-1.5 text-[11px] font-medium text-rose-600">{searchError}</p>
          )}

          {/* Search Results Dropdown List */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ink-200 bg-white p-1.5 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Select matching location:
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
                  className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-primary-50 hover:text-primary-950"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-primary-600" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 break-words">{res.name}</p>
                    <p className="text-[11px] text-ink-500 break-words line-clamp-1">{res.displayName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pop-out Map Modal Window (DEC-050) ─────────────────────────── */}
      {mapModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Pick location on map"
          onClick={closeMapModal}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-ink-200 bg-white shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-ink-950 flex items-center gap-1.5">
                  <MapPin size={17} className="text-primary-600 shrink-0" />
                  <span>Pick Incident Location on Map</span>
                </h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  Tap anywhere on the map or drag the pin to set the exact spot.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMapModal}
                className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition-colors"
                aria-label="Close map"
              >
                <X size={20} />
              </button>
            </div>

            {/* In-Modal Search and GPS Bar */}
            <div className="p-3 sm:p-4 border-b border-ink-100 bg-white space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-3 top-3 text-ink-400" />
                  <Input
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      if (!modalSearchBusy && modalSearchQuery.trim()) {
                        void runSearch(modalSearchQuery, true);
                      }
                    }}
                    placeholder="Search area, landmark or street to jump to location…"
                    className="pl-8 text-sm h-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={modalSearchBusy || !modalSearchQuery.trim()}
                  onClick={() => void runSearch(modalSearchQuery, true)}
                  className="h-10 px-3.5 text-xs font-semibold shrink-0"
                >
                  {modalSearchBusy ? <Loader2 size={13} className="animate-spin" /> : "Search"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => captureGps(true)}
                  className="h-10 px-3 text-xs shrink-0 flex items-center gap-1"
                  title="Center on my GPS position"
                >
                  <Navigation size={13} className="text-primary-700" />
                  <span className="hidden sm:inline">My Location</span>
                </Button>
              </div>

              {/* Modal Search Error */}
              {modalError && (
                <p className="text-xs font-medium text-rose-600">{modalError}</p>
              )}

              {/* Modal Search Suggestions */}
              {modalSearchResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-md border border-ink-200 bg-white p-1 shadow-md">
                  {modalSearchResults.map((res, i) => (
                    <button
                      key={`modal-${res.latitude}-${res.longitude}-${i}`}
                      type="button"
                      onClick={() => {
                        const next: Coords = {
                          latitude: res.latitude,
                          longitude: res.longitude,
                          address: res.displayName || res.name,
                        };
                        leafletRef.current?.placePin?.(res.latitude, res.longitude, res.displayName || res.name);
                        setModalCoords(next);
                        setModalPlace(res.displayName || res.name);
                        setModalSearchResults([]);
                        setModalSearchQuery("");
                        const map = leafletRef.current?.map;
                        if (map) {
                          map.setView([res.latitude, res.longitude], 16);
                          if (leafletRef.current?.marker) {
                            leafletRef.current.marker.setLatLng([res.latitude, res.longitude]);
                          }
                        }
                      }}
                      className="flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-primary-50"
                    >
                      <MapPin size={12} className="mt-0.5 shrink-0 text-primary-600" />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900 truncate">{res.name}</p>
                        <p className="text-[10px] text-ink-500 truncate">{res.displayName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map Canvas (Spacious, Touch-Friendly, Direct Explicit Height) */}
            <div
              ref={modalMapRef}
              className="w-full h-[55vh] sm:h-[420px] min-h-[320px] cursor-crosshair relative z-0 overflow-hidden bg-ink-100"
              role="application"
              aria-label="Interactive map picker"
            />

            {/* Modal Footer with Selection Preview & Confirm Button */}
            <div className="border-t border-ink-100 bg-ink-50/70 p-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="min-w-0 flex items-start gap-2 text-xs">
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary-600" />
                <div className="min-w-0">
                  <p className="font-bold text-ink-950 truncate">
                    {modalPlace || (modalCoords ? `${modalCoords.latitude.toFixed(5)}, ${modalCoords.longitude.toFixed(5)}` : "No spot pinned yet")}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {modalCoords ? "Tap Confirm to pin this location for your complaint." : "Click or tap anywhere on the map to drop the pin."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeMapModal}
                  className="flex-1 sm:flex-none text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!modalCoords}
                  onClick={confirmModalLocation}
                  className="flex-1 sm:flex-none text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white"
                >
                  Confirm Pin Location
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Field>
  );
}
