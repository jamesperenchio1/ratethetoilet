// Free, keyless geocoding backed by Photon (photon.komoot.io) over OpenStreetMap
// data — no Google Places key required. Same open-data stack as the OpenFreeMap
// map tiles already used in MapView. Searches are hard-filtered to a Thailand
// bounding box so a query like "root bar" returns Bangkok venues instead of
// higher-traffic US ones. Photon's usage policy caps this at ~1 request/second,
// so callers are expected to debounce.
import { CONFIG } from "./config";

const PHOTON_BASE = CONFIG.api.geocodeBaseUrl;

/** Structured address returned by Photon's `properties`, kept so we can render
 * a Google-Maps-style multi-line address instead of just a name. */
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

/** Photon returns a GeoJSON FeatureCollection. Only the fields we use are typed. */
interface PhotonProperties {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  locality?: string;
  district?: string;
  city?: string;
  postcode?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
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

/** Photon has no single display_name, so assemble one from its component fields. */
function buildDisplayName(p: PhotonProperties): string {
  const parts = [
    p.street && p.housenumber ? `${p.housenumber} ${p.street}` : p.street,
    p.locality,
    p.district,
    p.city,
    p.state,
    p.postcode,
    p.country,
  ].filter(Boolean);
  return parts.join(", ");
}

/** Map Photon properties onto our normalized structured address. */
function toAddress(p: PhotonProperties): Address | undefined {
  if (!p || (!p.street && !p.housenumber && !p.locality && !p.district && !p.city && !p.postcode && !p.country)) {
    return undefined;
  }
  return {
    road: p.street,
    house_number: p.housenumber,
    suburb: p.locality || p.district,
    city: p.city,
    state: p.state,
    postcode: p.postcode,
    country: p.country,
  };
}

/** Shared mapping from a Photon feature to our normalized result. */
function toPhotonResult(feature: PhotonFeature): GeocodeResult | null {
  const p = feature.properties;
  if (!p || !feature.geometry?.coordinates) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    id: `${p.osm_type ?? "osm"}:${p.osm_id ?? ""}`,
    name: p.name || p.street || buildDisplayName(p),
    displayName: buildDisplayName(p),
    lat,
    lng,
    address: toAddress(p),
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
    const url = `${PHOTON_BASE}/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetchWithTimeout(url, signal);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const feature = data.features?.[0];
    if (!feature) return null;
    return toPhotonResult(feature);
  } catch {
    return null;
  }
}

/** Forward search for the "search a place" box, hard-filtered to Thailand and
 * biased toward `near` (the user's location) when given. */
export async function searchPlaces(
  query: string,
  opts: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {}
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [minLon, minLat, maxLon, maxLat] = CONFIG.api.geocodeCountryBbox;
  const params = new URLSearchParams({
    q,
    limit: String(CONFIG.api.geocodeSearchLimit),
    bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
  });
  if (opts.near) {
    const { lat, lng } = opts.near;
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  }
  try {
    const res = await fetchWithTimeout(`${PHOTON_BASE}/api/?${params.toString()}`, opts.signal);
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? []).map(toPhotonResult).filter((r): r is GeocodeResult => r !== null);
  } catch {
    return [];
  }
}

// Re-exported so UI code that only imports from geocode can use these keys for
// building flat address columns.
export { VALID_ADDRESS_KEYS };
