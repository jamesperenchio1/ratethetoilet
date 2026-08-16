export type VenueType =
  | "mall"
  | "gas"
  | "temple"
  | "transit"
  | "public"
  | "cafe"
  | "hotel"
  | "street"
  | "other";

export type AccessType = "free" | "paid" | "customers_only" | "ask_for_key";

export type TriState = "yes" | "no" | "unsure";

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
  venue_type: VenueType;
  access_type: AccessType;
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

export type ReportTargetType = "photo" | "review" | "toilet" | "hint";
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
  reviews?: (Review & { author?: Pick<Profile, "id" | "handle"> | null })[];
}

export interface QueuedPost {
  localId: string;
  kind: "toilet" | "review" | "photo";
  payload: unknown;
  createdAt: number;
}
