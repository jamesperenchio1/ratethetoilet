import { CONFIG } from "./config";

export const VENUE_LABELS: Record<string, string> = CONFIG.labels.venue;
export const ACCESS_LABELS: Record<string, string> = CONFIG.labels.access;

export function titleCase(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Display label for a venue-type key; unknown (custom) keys are title-cased. */
export function venueTypeLabel(key: string): string {
  return VENUE_LABELS[key] ?? titleCase(key);
}

export function accessTypeLabel(key: string): string {
  return ACCESS_LABELS[key] ?? key;
}

/** "Mall · Café" from an array of keys. */
export function venueTypesLabel(keys: string[] | undefined | null): string {
  if (!keys || keys.length === 0) return "";
  return keys.map(venueTypeLabel).join(" · ");
}

export function accessTypesLabel(keys: string[] | undefined | null): string {
  if (!keys || keys.length === 0) return "";
  return keys.map(accessTypeLabel).join(" · ");
}

export function distanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
