import { supabase } from "./supabase";
import { CONFIG } from "./config";
import type {
  Report,
  ReportTargetType,
  Review,
  Toilet,
  ToiletPhoto,
  ToiletWithAuthor,
  Venue,
  VenueTypeDef,
} from "./types";

const PHOTO_BUCKET = CONFIG.api.photoBucket;

export interface NewToiletInput {
  lat: number;
  lng: number;
  venue_types: string[];
  access_types: string[];
  supplies: string[];
  wheelchair: Toilet["wheelchair"];
  hint_chips: string[];
  hint_note: string | null;
  cleanliness: number | null;
  smell: number | null;
  privacy: number | null;
  venue_name?: string | null;
  location_source?: Toilet["location_source"];
  floor?: string | null;
  venue_id?: string | null;
}

export async function canPost(): Promise<{ allowed: boolean; retryAt: string | null }> {
  const { data, error } = await supabase.rpc("can_post");
  if (error) throw error;
  return data as { allowed: boolean; retryAt: string | null };
}

export async function listToiletsNear(
  center: { lat: number; lng: number },
  radiusMeters = CONFIG.api.defaultRadiusM
): Promise<Toilet[]> {
  const { data, error } = await supabase.rpc("toilets_near", {
    p_lat: center.lat,
    p_lng: center.lng,
    p_radius_m: radiusMeters,
  });
  if (error) throw error;
  return (data as Toilet[]) ?? [];
}

export async function searchToilets(query: string): Promise<Toilet[]> {
  const { data, error } = await supabase
    .from("toilets")
    .select("*")
    .eq("hidden", false)
    .ilike("venue_name", `%${query}%`)
    .limit(CONFIG.api.searchLimit);
  if (error) throw error;
  return (data as Toilet[]) ?? [];
}

export async function getToilet(id: string): Promise<ToiletWithAuthor | null> {
  const { data, error } = await supabase
    .from("toilets")
    .select(
      `*, author:profiles!toilets_author_id_fkey(id, handle),
       photos:toilet_photos(*),
       reviews(*, author:profiles!reviews_author_id_fkey(id, handle))`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ToiletWithAuthor | null;
}

export async function createToilet(
  authorId: string,
  input: NewToiletInput
): Promise<Toilet> {
  const { data, error } = await supabase
    .from("toilets")
    .insert({ author_id: authorId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Toilet;
}

/** Nearby venues with names matching the query — the wizard's "attach to an
 * existing place" lookup. */
export async function searchVenues(
  name: string,
  near: { lat: number; lng: number }
): Promise<Venue[]> {
  const { data, error } = await supabase.rpc("venues_near", {
    p_lat: near.lat,
    p_lng: near.lng,
    p_radius_m: CONFIG.venue.lookupRadiusM,
  });
  if (error) throw error;
  const venues = (data as Venue[]) ?? [];
  const q = name.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => v.name.toLowerCase().includes(q));
}

/** Reuses a venue by name+proximity or creates it, returning the venue row. */
export async function findOrCreateVenue(
  name: string,
  lat: number,
  lng: number
): Promise<Venue> {
  const { data, error } = await supabase.rpc("find_or_create_venue", {
    p_name: name,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
  return data as Venue;
}

/** All venue-type catalog entries (base + user-added custom). */
export async function listVenueTypes(): Promise<VenueTypeDef[]> {
  const { data, error } = await supabase
    .from("venue_types")
    .select("key, label, is_custom")
    .order("is_custom")
    .order("label");
  if (error) throw error;
  return (data as VenueTypeDef[]) ?? [];
}

/** Normalizes + persists a custom venue type, returning its key. */
export async function findOrCreateVenueType(label: string): Promise<string> {
  const { data, error } = await supabase.rpc("find_or_create_venue_type", {
    p_label: label,
  });
  if (error) throw error;
  return data as string;
}

export async function uploadToiletPhoto(
  authorId: string,
  toiletId: string,
  file: File | Blob
): Promise<ToiletPhoto> {
  const ext = file instanceof File ? file.name.split(".").pop() : "jpg";
  const path = `${toiletId}/${crypto.randomUUID()}.${ext ?? "jpg"}`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("toilet_photos")
    .insert({ toilet_id: toiletId, author_id: authorId, storage_path: path })
    .select()
    .single();
  if (error) throw error;
  return data as ToiletPhoto;
}

export async function uploadDraftPhoto(
  draftId: string,
  localId: string,
  file: File | Blob
): Promise<string> {
  const ext = file instanceof File ? file.name.split(".").pop() : "jpg";
  const path = `draft/${draftId}/${localId}.${ext ?? "jpg"}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function attachDraftPhotos(
  authorId: string,
  toiletId: string,
  storagePaths: string[]
): Promise<void> {
  if (storagePaths.length === 0) return;
  const { error } = await supabase.from("toilet_photos").insert(
    storagePaths.map((storage_path) => ({
      toilet_id: toiletId,
      author_id: authorId,
      storage_path,
    }))
  );
  if (error) throw error;
}

export function photoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

export async function addReview(
  authorId: string,
  toiletId: string,
  body: string
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({ toilet_id: toiletId, author_id: authorId, body })
    .select()
    .single();
  if (error) throw error;
  return data as Review;
}

export async function fileReport(
  reporterId: string | null,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  note?: string
): Promise<Report> {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason,
      note: note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Report;
}

export interface ReviewWithToilet extends Review {
  toilet: Pick<Toilet, "id" | "venue_name" | "venue_types"> | null;
}

export async function myContributions(authorId: string) {
  const [{ data: toilets }, { data: reviews }] = await Promise.all([
    supabase.from("toilets").select("*").eq("author_id", authorId),
    supabase
      .from("reviews")
      .select("*, toilet:toilets(id, venue_name, venue_types)")
      .eq("author_id", authorId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    toilets: (toilets ?? []) as Toilet[],
    reviews: (reviews ?? []) as unknown as ReviewWithToilet[],
  };
}

// --- Admin ---

export async function listReports(status: Report["status"]): Promise<Report[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Report[]) ?? [];
}

export async function resolveReport(
  id: string,
  status: "resolved" | "dismissed"
) {
  const { error } = await supabase
    .from("reports")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function hideContent(
  targetType: ReportTargetType,
  targetId: string,
  hidden: boolean
) {
  // "hint" lives on the toilets row itself.
  const dbTargetType = targetType === "hint" ? "toilet" : targetType;
  const { error } = await supabase.rpc("admin_hide_content", {
    p_target_type: dbTargetType,
    p_target_id: targetId,
    p_hidden: hidden,
  });
  if (error) throw error;
}

export async function getReportTarget(
  report: Report
): Promise<{ preview: string; authorId: string | null; authorHandle?: string | null } | null> {
  if (report.target_type === "photo") {
    const { data } = await supabase
      .from("toilet_photos")
      .select("storage_path, author_id, author:profiles!toilet_photos_author_id_fkey(handle)")
      .eq("id", report.target_id)
      .maybeSingle();
    if (!data) return null;
    return {
      preview: photoUrl(data.storage_path as string),
      authorId: data.author_id as string,
      authorHandle: (data.author as unknown as { handle: string } | null)?.handle,
    };
  }
  if (report.target_type === "review") {
    const { data } = await supabase
      .from("reviews")
      .select("body, author_id, author:profiles!reviews_author_id_fkey(handle)")
      .eq("id", report.target_id)
      .maybeSingle();
    if (!data) return null;
    return {
      preview: data.body as string,
      authorId: data.author_id as string,
      authorHandle: (data.author as unknown as { handle: string } | null)?.handle,
    };
  }
  const { data } = await supabase
    .from("toilets")
    .select("venue_name, venue_types, author_id, hint_note, author:profiles!toilets_author_id_fkey(handle)")
    .eq("id", report.target_id)
    .maybeSingle();
  if (!data) return null;
  return {
    preview: (data.hint_note as string) || (data.venue_name as string) || ((data.venue_types as string[])?.join(", ") ?? ""),
    authorId: data.author_id as string,
    authorHandle: (data.author as unknown as { handle: string } | null)?.handle,
  };
}

export async function banHandle(profileId: string, banned: boolean) {
  const { error } = await supabase.rpc("admin_set_banned", {
    p_target_id: profileId,
    p_banned: banned,
  });
  if (error) throw error;
}
