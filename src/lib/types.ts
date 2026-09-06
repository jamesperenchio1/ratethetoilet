export type AccessType = "free" | "paid" | "customers_only" | "ask_for_key";

export type TriState = "yes" | "no" | "unsure";

/** A venue-type catalog entry (base types seeded; custom ones user-added). */
export interface VenueTypeDef {
  key: string;
  label: string;
  is_custom: boolean;
}

export interface Profile {
  id: string;
  handle: string;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface Toilet {
  id: string;
  author_id: string;
  lat: number;
  lng: number;
  venue_types: string[];
  access_types: string[];
  supplies: string[];
  wheelchair: TriState | null;
  hint_chips: string[];
  hint_note: string | null;
  cleanliness: number | null;
  smell: number | null;
  privacy: number | null;
  overall_score: number | null;
  created_at: string;
  hidden: boolean;
  venue_name?: string | null;
  location_source?: "gps" | "search" | "manual" | null;
  floor?: string | null;
  venue_id?: string | null;
  /** Google-Maps-style structured address, flattened from geocoding. */
  address_road?: string | null;
  address_house_number?: string | null;
  address_suburb?: string | null;
  address_city?: string | null;
  address_postcode?: string | null;
  address_country?: string | null;
  /** Storage path of the first (position 0) non-hidden photo, when one exists.
   * Populated by the list queries so cards can show a thumbnail. */
  photo_storage_path?: string | null;
}

export interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  author_id: string | null;
  created_at: string;
}

export interface ToiletPhoto {
  id: string;
  toilet_id: string;
  author_id: string;
  storage_path: string;
  created_at: string;
  hidden: boolean;
}

export interface Review {
  id: string;
  toilet_id: string;
  author_id: string;
  body: string;
  created_at: string;
  hidden: boolean;
}

export interface ReviewReply {
  id: string;
  review_id: string;
  author_id: string;
  body: string;
  created_at: string;
  hidden: boolean;
}

export interface ReviewVote {
  id: string;
  review_id: string;
  voter_id: string;
  value: number;
  created_at: string;
}

export type ReportTargetType = "photo" | "review" | "toilet" | "hint" | "reply";
export type ReportStatus = "queued" | "resolved" | "dismissed";

export interface Report {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  note: string | null;
  reporter_id: string;
  status: ReportStatus;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface ToiletWithAuthor extends Toilet {
  author?: Pick<Profile, "id" | "handle"> | null;
  photos?: ToiletPhoto[];
  reviews?: (Review & {
    author?: Pick<Profile, "id" | "handle"> | null;
    replies?: (ReviewReply & { author?: Pick<Profile, "id" | "handle"> | null })[];
    votes?: ReviewVote[];
  })[];
}

export interface QueuedPost {
  localId: string;
  kind: "toilet" | "review" | "photo";
  payload: unknown;
  createdAt: number;
}
