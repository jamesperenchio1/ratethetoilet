// Free, keyless geocoding backed by OpenStreetMap Nominatim — no Google Places
// key required. Same open-data stack as the OpenFreeMap map tiles already used
// in MapView. Nominatim's usage policy caps this at ~1 request/second and asks
// for reasonable client-side debouncing, which callers are expected to do.
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export interface GeocodeResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface NominatimRow {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

const TIMEOUT_MS = 6000;

/** Fetch that gives up after TIMEOUT_MS so a dead network can't hang the UI forever. */
function fetchWithTimeout(url: string, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  externalSignal?.addEventListener("abort", () => controller.abort(), { once: true });
  return fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } }).finally(() =>
    clearTimeout(timer)
  );
}

function shortName(row: NominatimRow): string {
  if (row.name) return row.name;
  const a = row.address;
  return (
    a?.amenity ||
    a?.shop ||
    a?.building ||
    a?.road ||
    row.display_name.split(",")[0].trim()
  );
}

/** Best-effort place name for a dropped/dragged pin — falls back to null on any failure. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetchWithTimeout(url, signal);
    if (!res.ok) return null;
    const row = (await res.json()) as NominatimRow;
    if (!row || !row.display_name) return null;
    return {
      id: String(row.place_id),
      name: shortName(row),
      displayName: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    };
  } catch {
    return null;
  }
}

/** Forward search for the "search a place" box, biased toward `near` when given. */
export async function searchPlaces(
  query: string,
  opts: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {}
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    addressdetails: "1",
    limit: "6",
  });
  if (opts.near) {
    const { lat, lng } = opts.near;
    const d = 0.35; // ~35km soft bias box
    params.set("viewbox", `${lng - d},${lat + d},${lng + d},${lat - d}`);
    params.set("bounded", "0");
  }
  try {
    const res = await fetchWithTimeout(`${NOMINATIM_BASE}/search?${params.toString()}`, opts.signal);
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimRow[];
    return rows.map((row) => ({
      id: String(row.place_id),
      name: shortName(row),
      displayName: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }));
  } catch {
    return [];
  }
}
