import type { Toilet } from "./types";

export interface VenueGroup {
  key: string;
  name: string | null;
  lat: number;
  lng: number;
  toilets: Toilet[];
}

/**
 * Collapses toilets that belong to the same venue into one group, so a
 * multi-floor place ("Terminal 21" on floors 1/2/3) shows as a single pin and
 * a single list row instead of several overlapping ones.
 *
 * Grouping key precedence: an explicit `venue_id` (the real venues table) wins;
 * otherwise toilets with the same non-empty `venue_name` *and* a coarse
 * coordinate cell collapse together (legacy rows created before the venues
 * table existed — the coordinate cell prevents two same-named venues on
 * opposite sides of the city from merging). Anything else stands alone.
 */
export function groupToiletsByVenue(toilets: Toilet[]): VenueGroup[] {
  const map = new Map<string, VenueGroup>();
  const cell = (t: Toilet) => `${t.lat.toFixed(3)},${t.lng.toFixed(3)}`;
  for (const t of toilets) {
    const key = t.venue_id
      ? `v:${t.venue_id}`
      : t.venue_name?.trim()
        ? `n:${t.venue_name.trim().toLowerCase()}:${cell(t)}`
        : `t:${t.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.toilets.push(t);
    } else {
      map.set(key, {
        key,
        name: t.venue_name?.trim() || null,
        lat: t.lat,
        lng: t.lng,
        toilets: [t],
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => a.toilets[0].created_at.localeCompare(b.toilets[0].created_at)
  );
}

/** Average of a group's overall scores, for a representative pin color. */
export function groupScore(group: VenueGroup): number | null {
  const scores = group.toilets
    .map((t) => t.overall_score)
    .filter((s): s is number => s != null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
