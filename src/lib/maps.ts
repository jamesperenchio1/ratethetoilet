/**
 * A Google Maps link that drops a pin at the exact coordinates, labeled with
 * `label` when given. Geocoding a street address (e.g. "Sanam Bin") often
 * resolves to the wrong building or a generic sub-district centroid, so this
 * bypasses geocoding entirely and points straight at the toilet's real
 * coordinates instead.
 */
export function googleMapsUrl(lat: number, lng: number, label?: string): string {
  const coords = `${lat},${lng}`;
  const query = label ? `${coords} (${label})` : coords;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
}
