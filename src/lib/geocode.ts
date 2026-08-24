// Free, keyless geocoding backed by OpenStreetMap Nominatim — no Google Places
// key required. Same open-data stack as the OpenFreeMap map tiles already used
// in MapView. Nominatim's usage policy caps this at ~1 request/second and asks
// for reasonable client-side debouncing, which callers are expected to do.
import { CONFIG } from "./config";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/** Structured address returned by Nominatim's `addressdetails=1`, kept so we
 * can render a Google-Maps-style multi-line address instead of just a name. */
export interface Address {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  amenity?: string;
  shop?: string;
  building?: string;
  village?: string;
}

export interface GeocodeResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  address?: Address;
}

interface NominatimRow {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

const TIMEOUT_MS = CONFIG.api.geocodeTimeoutMs;

/** Fetch that gives up after TIMEOUT_MS so a dead network can't hang the UI forever. */
function fetchWithTimeout(url: string, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  externalSignal?.addEventListener("abort", () => controller.abort(), { once: true });
  return fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } }).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * A named POI (row.name, or an amenity/shop/building tag) is already specific
 * to one building — use it as-is. Otherwise Nominatim falls back to the road
 * or village name, which is shared by every house on that street: without a
 * house number, two different houses a few doors apart end up with the exact
 * same suggested name. Prefix with the house number whenever OSM has one.
 */
function primaryName(row: NominatimRow): string {
  if (row.name) return row.name;
  const a = row.address;
  if (a?.amenity) return a.amenity;
  if (a?.shop) return a.shop;
  if (a?.building) return a.building;

  const street = a?.road || a?.pedestrian || a?.footway;
  const area = street || a?.village || a?.neighbourhood || a?.suburb;
  if (a?.house_number && area) return `${a.house_number} ${area}`;
  return area || row.display_name.split(",")[0].trim();
}

/**
 * Locality context (district, then city) to trail the primary name with —
 * a bare "Wat Pho" or "Soi 5" reads as plain and is ambiguous across a city
 * the size of Bangkok, so pair it with the neighborhood/district and city
 * whenever OSM has them and they're not already the primary name itself.
 */
function localityContext(row: NominatimRow, primary: string): string[] {
  const a = row.address;
  if (!a) return [];
  const district = a.suburb || a.neighbourhood || a.city_district;
  const city = a.city || a.town || a.village;
  const parts = [district, city].filter((p): p is string => !!p && p !== primary);
  return [...new Set(parts)];
}

/** A verbose, disambiguated place name: primary spot plus district/city context. */
function fullName(row: NominatimRow): string {
  const primary = primaryName(row);
  const context = localityContext(row, primary);
  return context.length ? `${primary}, ${context.join(", ")}` : primary;
}

/** Strip the noise keys we don't persist, keeping a clean structured address. */
function toAddress(raw?: Record<string, string>): Address | undefined {
  if (!raw) return undefined;
  return {
    road: raw.road,
    house_number: raw.house_number,
    neighbourhood: raw.neighbourhood,
    suburb: raw.suburb,
    city_district: raw.city_district,
    city: raw.city,
    state: raw.state,
    postcode: raw.postcode,
    country: raw.country,
    amenity: raw.amenity,
    shop: raw.shop,
    building: raw.building,
    village: raw.village,
  };
}

/** Shared mapping from a raw Nominatim row to our normalized result. */
function toGeocodeResult(row: NominatimRow): GeocodeResult {
  return {
    id: String(row.place_id),
    name: fullName(row),
    displayName: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
    address: toAddress(row.address),
  };
}

const VALID_ADDRESS_KEYS: (keyof Address)[] = [
  "building",
  "amenity",
  "shop",
  "house_number",
  "road",
  "village",
  "neighbourhood",
  "suburb",
  "city_district",
  "city",
  "postcode",
  "country",
];

/**
 * Render a structured address the way Google Maps does: most specific line
 * first (venue/building, then street + number), then area, city/district,
 * postcode, and finally country. Drops empty parts and dedupes consecutive
 * repeats. Pure so it's unit-testable.
 */
export function formatAddress(address: Address | undefined, opts: { includeCountry?: boolean } = {}): string {
  if (!address) return "";
  const parts: string[] = [];

  const venue = address.building || address.amenity || address.shop;
  if (venue && venue !== address.road) parts.push(venue);

  if (address.house_number || address.road) {
    parts.push([address.house_number, address.road].filter(Boolean).join(" "));
  }

  const area = address.village || address.neighbourhood || address.suburb;
  if (area && area !== address.road && area !== venue) parts.push(area);

  const city = address.city_district || address.city;
  if (city && city !== area && city !== address.road) parts.push(city);

  if (address.postcode && address.postcode !== city && address.postcode !== area) parts.push(address.postcode);

  if (opts.includeCountry && address.country && address.country !== city && address.country !== area) {
    parts.push(address.country);
  }

  return parts.join("\n");
}

/** Flatten a structured address into the toilet row's denormalized address_* columns. */
export function flattenAddress(address: Address | null | undefined): {
  address_road: string | null;
  address_house_number: string | null;
  address_suburb: string | null;
  address_city: string | null;
  address_postcode: string | null;
  address_country: string | null;
} {
  return {
    address_road: address?.road ?? null,
    address_house_number: address?.house_number ?? null,
    address_suburb: address?.suburb ?? null,
    address_city: address?.city ?? null,
    address_postcode: address?.postcode ?? null,
    address_country: address?.country ?? null,
  };
}

/** Rebuild a structured Address from a toilet row's flat address_* columns. */
export function addressFromFlat(flat: {
  address_road?: string | null;
  address_house_number?: string | null;
  address_suburb?: string | null;
  address_city?: string | null;
  address_postcode?: string | null;
  address_country?: string | null;
}): Address | undefined {
  const parts: [keyof Address, string | null | undefined][] = [
    ["road", flat.address_road],
    ["house_number", flat.address_house_number],
    ["suburb", flat.address_suburb],
    ["city", flat.address_city],
    ["postcode", flat.address_postcode],
    ["country", flat.address_country],
  ];
  const has = parts.some(([, v]) => v != null && v !== "");
  if (!has) return undefined;
  const addr: Address = {};
  for (const [key, v] of parts) {
    if (v != null && v !== "") addr[key] = v;
  }
  return addr;
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
    return toGeocodeResult(row);
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
    limit: String(CONFIG.api.geocodeSearchLimit),
  });
  if (opts.near) {
    const { lat, lng } = opts.near;
    const d = CONFIG.api.geocodeBiasBox; // ~35km soft bias box
    params.set("viewbox", `${lng - d},${lat + d},${lng + d},${lat - d}`);
    params.set("bounded", "0");
  }
  try {
    const res = await fetchWithTimeout(`${NOMINATIM_BASE}/search?${params.toString()}`, opts.signal);
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimRow[];
    return rows.map(toGeocodeResult);
  } catch {
    return [];
  }
}

// Re-exported so UI code that only imports from geocode can use these keys for
// building flat address columns.
export { VALID_ADDRESS_KEYS };