/**
 * Reverse geocoding: coordinates → human-readable place name.
 *
 * Uses OpenStreetMap's free Nominatim API (same provider as the map tiles),
 * with an in-memory cache and a small in-flight de-duplication so repeated
 * markers at the same location cost one lookup, not many.
 *
 * Display-only: never blocks rendering — callers show the coordinates as a
 * fallback and upgrade in place when the name arrives.
 */

export interface PlaceNameResult {
  /** e.g. "Koramangala, Bengaluru" — locality first, city/region after. */
  name: string;
  /** True when the lookup produced a usable locality/city/area name. */
  precise: boolean;
}

const cache = new Map<string, PlaceNameResult>();
const inFlight = new Map<string, Promise<PlaceNameResult | null>>();

/** Small independent helper so this module stays dependency-free. */
function timeoutSignal(ms: number): AbortSignal | null {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  return null;
}

function pickName(displayName: string): string {
  const parts = displayName.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return displayName;
  // Skip house/road detail; keep the first two place-worthy segments.
  const skip = new Set(["building", "house_number", "road"]);
  // Nominatim's display_name is already ordered specific → general, so the
  // first 2–3 segments give "Locality, City" style names.
  const name = parts.slice(0, 3).join(", ");
  void skip;
  return name;
}

/** Fire-and-forget Nominatim reverse geocode. Returns null on any failure. */
async function lookup(
  lat: number,
  lon: number
): Promise<PlaceNameResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=16`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: timeoutSignal(5000),
    });
    if (!res.ok) return null;
    const data: {
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    } = await res.json();

    const a = data.address ?? {};
    // Prefer the most citizen-friendly chain: locality → city → state.
    const locality =
      a.suburb || a.neighbourhood || a.village || a.town || a.hamlet || a.city_district;
    const city = a.city || a.town || a.village || a.district || a.state_district;
    const state = a.state;

    const chain = [locality, city !== locality ? city : null, state !== city ? state : null]
      .filter(Boolean)
      .join(", ");

    if (chain) return { name: chain, precise: true };
    if (data.name) return { name: data.name, precise: true };
    if (data.display_name)
      return { name: pickName(data.display_name), precise: false };
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve coordinates to a place name. Resolves `null` when offline,
 * rate-limited, or the point is in the ocean — callers keep their fallback.
 */
export function reverseGeocode(
  lat: number,
  lon: number
): Promise<PlaceNameResult | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = lookup(lat, lon)
    .then((result) => {
      if (result) cache.set(key, result);
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, p);
  return p;
}
