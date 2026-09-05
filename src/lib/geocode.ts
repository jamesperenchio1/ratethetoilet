// Geocoding: Google Places API (New) Text Search when a key is configured,
// otherwise keyless Photon (photon.komoot.io) over OpenStreetMap data. Photon
// only indexes OSM, so venues that exist on Google Maps but aren't mapped in OSM
// (e.g. "Root Bar" at 1130 Phahonyothin) only show up when the Google key is set.
// Both paths are hard-filtered to a Thailand bounding box so a query like
// "root bar" returns Bangkok venues instead of higher-traffic US ones. Photon's
// usage policy caps it at ~1 request/second, so callers are expected to debounce.
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

/** The most specific available label for a place: name, then street+number, then street, then the assembled display name. */
function primaryName(p: PhotonProperties): string {
  if (p.name) return p.name;
  if (p.street && p.housenumber) return `${p.housenumber} ${p.street}`;
  if (p.street) return p.street;
  return buildDisplayName(p);
}

/**
 * Locality context (district, then city) to trail the primary name with — a
 * bare "Wat Pho" or "Soi 5" reads as plain and is ambiguous across a city the
 * size of Bangkok, so pair it with the neighborhood/district and city whenever
 * OSM has them and they're not already the primary name itself.
 */
function localityContext(p: PhotonProperties, primary: string): string[] {
  const district = p.locality || p.district;
  const city = p.city;
  const parts = [district, city].filter((v): v is string => !!v && v !== primary);
  return [...new Set(parts)];
}

/** A verbose, disambiguated place name: primary spot plus district/city context. */
function fullName(p: PhotonProperties): string {
  const primary = primaryName(p);
  const context = localityContext(p, primary);
  return context.length ? `${primary}, ${context.join(", ")}` : primary;
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
    name: fullName(p),
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

/**
 * Photon's reverse lookup returns whichever single feature is geometrically
 * nearest, and a long road way often wins over a named place's point geometry
 * (a station, shop, restaurant, landmark…) even a few meters off. Snap to the
 * nearest named place within this radius of the dropped pin instead of the road
 * — the same "closest named thing wins" behavior Google Maps' pin-drop uses.
 * This can occasionally pick a large venue (e.g. a mall) over a small unrelated
 * shop right next to it, but that's a fair trade: the pin's own coordinates are
 * never touched by this, and the guessed name is a plain editable text field on
 * the very next wizard step.
 */
const POI_SNAP_RADIUS_M = 50;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const latRad = (lat1 * Math.PI) / 180;
  const dLat = (lat2 - lat1) * 110_540;
  const dLng = (lng2 - lng1) * 111_320 * Math.cos(latRad);
  return Math.hypot(dLat, dLng);
}

async function fetchFeature(url: string, signal?: AbortSignal): Promise<PhotonFeature | null> {
  try {
    const res = await fetchWithTimeout(url, signal);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return data.features?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Best-effort place name for a dropped/dragged pin — falls back to null on any failure. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const base = `${PHOTON_BASE}/reverse?lon=${lng}&lat=${lat}`;
  const [addressFeature, poiFeature] = await Promise.all([
    fetchFeature(base, signal),
    fetchFeature(`${base}&layer=poi,railway,natural,manmade`, signal),
  ]);

  const poiCoords = poiFeature?.geometry?.coordinates;
  if (poiFeature?.properties?.name && poiCoords && distanceMeters(lat, lng, poiCoords[1], poiCoords[0]) <= POI_SNAP_RADIUS_M) {
    return toPhotonResult(poiFeature);
  }

  const feature = addressFeature ?? poiFeature;
  return feature ? toPhotonResult(feature) : null;
}

/** Forward search for the "search a place" box. Uses the Google Places API when
 * a key is configured (returns Google's POIs, e.g. venues missing from OSM),
 * otherwise falls back to Photon. Both are hard-filtered to Thailand and biased
 * toward `near` (the user's location) when given. */
export async function searchPlaces(
  query: string,
  opts: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {}
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (GOOGLE_KEY) {
    return searchPlacesGoogle(q, opts);
  }
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

/** The env var name holding the Google Places API (New) key. Kept in one place
 * so the key is only ever read from the environment. */
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

/** Minimal shape of a place from the Google Places API (New) `places:searchText`
 * response, limited to the fields we request via X-Goog-FieldMask. */
interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: GoogleAddressComponent[];
}

/** Map a Google address component (by its type) onto our normalized address. */
function componentByType(components: GoogleAddressComponent[], type: string): string | undefined {
  return components.find((c) => c.types?.includes(type))?.longText ?? undefined;
}

/** Build our structured Address from Google's addressComponents. */
function addressFromGoogle(place: GooglePlace): Address | undefined {
  const c = place.addressComponents;
  if (!c) return undefined;
  const addr: Address = {
    road: componentByType(c, "route"),
    house_number: componentByType(c, "street_number"),
    suburb: componentByType(c, "sublocality_level_2") ?? componentByType(c, "sublocality"),
    city_district: componentByType(c, "sublocality_level_1"),
    city: componentByType(c, "locality"),
    state: componentByType(c, "administrative_area_level_1"),
    postcode: componentByType(c, "postal_code"),
    country: componentByType(c, "country"),
  };
  return Object.values(addr).some(Boolean) ? addr : undefined;
}

/** Map a Google Place onto our normalized result, matching the Photon shape. */
function toGoogleResult(place: GooglePlace): GeocodeResult | null {
  const location = place.location;
  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") return null;
  const name = place.displayName?.text ?? "";
  const displayName = place.formattedAddress ?? name;
  return {
    id: place.id ?? "",
    name,
    displayName,
    lat: location.latitude,
    lng: location.longitude,
    address: addressFromGoogle(place),
  };
}

/** Forward search via the Google Places API (New) Text Search. Biased to the
 * Thailand rectangle and toward `near` when given. */
async function searchPlacesGoogle(
  query: string,
  opts: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {}
): Promise<GeocodeResult[]> {
  const [minLon, minLat, maxLon, maxLat] = CONFIG.api.geocodeCountryBbox;
  const body: Record<string, unknown> = {
    textQuery: query,
    // Hard-filter to Thailand (matches the Photon bbox) so US venues don't win.
    locationBias: {
      rectangle: {
        low: { latitude: minLat, longitude: minLon },
        high: { latitude: maxLat, longitude: maxLon },
      },
    },
    maxResultCount: CONFIG.api.geocodeSearchLimit,
  };
  if (opts.near) {
    // A nearby point centers the rectangle bias (Google uses it to rank closer places first).
    body.locationBias = {
      rectangle: {
        low: { latitude: Math.max(minLat, opts.near.lat - 0.1), longitude: Math.max(minLon, opts.near.lng - 0.1) },
        high: { latitude: Math.min(maxLat, opts.near.lat + 0.1), longitude: Math.min(maxLon, opts.near.lng + 0.1) },
      },
    };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    opts.signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const response = await fetch(CONFIG.api.geocodeGoogleBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY ?? "",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const data = (await response.json()) as { places?: GooglePlace[] };
    // Google's `locationBias`/`regionCode` are soft biases only: an ambiguous
    // query (e.g. "cgil") can still return results from another country. Hard-
    // drop any result whose country isn't Thailand so search never drifts abroad.
    const THAILAND = "Thailand";
    return (data.places ?? [])
      .map(toGoogleResult)
      .filter((r): r is GeocodeResult => r !== null)
      .filter((r) => r.address?.country === THAILAND);
  } catch {
    return [];
  }
}
