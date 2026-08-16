import type { AccessType, VenueType } from "./types";

export const VENUE_LABELS: Record<VenueType, string> = {
  mall: "Mall",
  gas: "Gas station",
  temple: "Temple",
  transit: "Transit",
  public: "Public",
  cafe: "Café",
  hotel: "Hotel",
  street: "Street",
  other: "Other",
};

export const ACCESS_LABELS: Record<AccessType, string> = {
  free: "Free",
  paid: "Paid",
  customers_only: "Customers only",
  ask_for_key: "Ask for key",
};

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
