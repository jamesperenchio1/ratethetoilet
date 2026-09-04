import { supabase, SUPABASE_ANON_KEY, SUPABASE_STORAGE_URL } from "./supabase";
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

const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_MAX_RETRIES = 3;

/** True for browser-level network failures — and for transient server-side
 * ones (5xx, 429) — that usually mean "the body never made it across, or the
 * server was momentarily unable to accept it." The right response for these
 * is to retry, not to give up; a 4xx like 403 is deliberately excluded since
 * that's a real client/policy problem, not a flaky connection. */
function isNetworkError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err ?? "");
  const lower = msg.toLowerCase();
  return (
    lower.includes("load failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("offline") ||
    lower.includes("connection reset") ||
    lower.includes("networkerror when fetching") ||
    /upload failed with status (5\d\d|429)\b/.test(lower)
  );
}

/** Human-readable message for a failed photo upload. */
export function friendlyUploadError(err: unknown): string {
  if (isNetworkError(err)) {
    return "Couldn't upload — weak or interrupted connection. Tap ⟳ to retry.";
  }
  return err instanceof Error ? err.message : String(err);
}

/** POSTs a file to `/object/{bucket}/{path}` via raw XHR — the exact same
 * request the SDK's `.upload()` sends (same URL, method, and
 * `multipart/form-data` body with `cacheControl` as a field), just over XHR
 * instead of `fetch` so upload progress is observable
 * (`XMLHttpRequest.upload.onprogress`; `fetch` bodies have none). Deliberately
 * NOT going through `createSignedUploadUrl()` + a PUT to the signed URL: that
 * route was tried first and confirmed (via a live request against this app's
 * actual backend) to always fail with a 401 demanding HTTP Basic auth —
 * something in front of that specific self-hosted deployment (Kong or the
 * Cloudflare Tunnel) doesn't route that PUT correctly, while the plain POST
 * endpoint below works. Returns the live `xhr` alongside the promise so a
 * caller-side timeout can abort the in-flight request instead of just
 * abandoning it. */
function xhrUpload(
  bucket: string,
  path: string,
  file: File | Blob,
  authHeaders: { apikey: string; authorization: string },
  onProgress?: (fraction: number) => void
): { promise: Promise<void>; xhr: XMLHttpRequest } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "31536000");
    body.append("", file);
    xhr.open("POST", `${SUPABASE_STORAGE_URL}/object/${bucket}/${path}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", authHeaders.apikey);
    xhr.setRequestHeader("authorization", authHeaders.authorization);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`upload failed with status ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
      }
    };
    xhr.onerror = () => reject(new Error("Failed to fetch"));
    xhr.onabort = () => reject(new Error("upload aborted"));
    xhr.send(body);
  });
  return { promise, xhr };
}

/** One upload attempt, bounded by `timeoutMs`. */
async function attemptUpload(
  path: string,
  file: File | Blob,
  timeoutMs: number,
  onProgress?: (fraction: number) => void
): Promise<void> {
  let xhr: XMLHttpRequest | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const { data: session } = await supabase.auth.getSession();
        const accessToken = session.session?.access_token ?? SUPABASE_ANON_KEY;
        const result = xhrUpload(
          PHOTO_BUCKET,
          path,
          file,
          { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}` },
          onProgress
        );
        xhr = result.xhr;
        await result.promise;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          xhr?.abort();
          reject(new Error(`upload timed out after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Uploads one photo to storage with a per-attempt timeout and retries.
 * Each attempt uses a fresh random path — the upload is never an upsert, so a
 * timed-out attempt that actually landed server-side can't collide with the
 * retry. Unique paths mean `toilet_photos.storage_path` always maps 1:1 to a
 * file, and no UPDATE policy is needed on storage.objects.
 *
 * Uses `xhrUpload()` (a raw-XHR mirror of the SDK's own `.upload()` POST)
 * so real upload-progress events are available without changing the actual
 * request the server sees. */
async function storageUpload(
  makePath: () => string,
  file: File | Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) =>
        setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000))
      );
    }
    const path = makePath();
    onProgress?.(0);
    try {
      await attemptUpload(path, file, UPLOAD_TIMEOUT_MS * (attempt + 1), onProgress);
      onProgress?.(1);
      return path;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

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
  address_road?: string | null;
  address_house_number?: string | null;
  address_suburb?: string | null;
  address_city?: string | null;
  address_postcode?: string | null;
  address_country?: string | null;
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

/** Every non-hidden toilet in the database, capped at CONFIG.api.allToiletsLimit
 * (newest first). The client sorts by distance to the current view center.
 * Fine for a small app; once the table regularly hits the cap this needs to
 * become a real viewport-bounded query instead. */
export async function listAllToilets(): Promise<Toilet[]> {
  const { data, error } = await supabase
    .from("toilets")
    .select(`*, photos:toilet_photos(storage_path, position, hidden)`)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .order("position", { ascending: true, foreignTable: "toilet_photos" })
    .limit(CONFIG.api.allToiletsLimit);
  if (error) throw error;
  return mapToThumbnail(data as ToiletWithPhotos[]) ?? [];
}

export async function searchToilets(query: string): Promise<Toilet[]> {
  const { data, error } = await supabase
    .from("toilets")
    .select(`*, photos:toilet_photos(storage_path, position, hidden)`)
    .eq("hidden", false)
    .ilike("venue_name", `%${query}%`)
    .order("position", { ascending: true, foreignTable: "toilet_photos" })
    .limit(CONFIG.api.searchLimit);
  if (error) throw error;
  return mapToThumbnail(data as ToiletWithPhotos[]) ?? [];
}

interface ToiletWithPhotos extends Toilet {
  photos?: { storage_path: string; position: number; hidden: boolean }[];
}

/** Collapse each toilet's nested photo list into a single thumbnail path
 * (the first non-hidden photo by position), which the cards render. */
function mapToThumbnail(rows: ToiletWithPhotos[]): Toilet[] {
  return rows.map(({ photos, ...t }) => ({
    ...t,
    photo_storage_path: photos?.find((p) => !p.hidden)?.storage_path ?? null,
  }));
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
    .order("position", { ascending: true, foreignTable: "toilet_photos" })
    .order("created_at", { ascending: false, foreignTable: "reviews" })
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
  file: File | Blob,
  onProgress?: (fraction: number) => void
): Promise<ToiletPhoto> {
  const path = await storageUpload(
    () => `${toiletId}/${crypto.randomUUID()}.jpg`,
    file,
    onProgress
  );

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
  file: File | Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const path = await storageUpload(
    () => `draft/${draftId}/${localId}-${crypto.randomUUID()}.jpg`,
    file,
    onProgress
  );
  return path;
}

/** Deletes a photo row and its storage object (author only). */
export async function deleteToiletPhoto(photo: ToiletPhoto): Promise<void> {
  if (photo.storage_path) {
    const { error: rmErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([photo.storage_path]);
    // A storage-remove failure (including an already-missing object) is never
    // fatal — the row is the source of truth. Log and continue so the row
    // delete isn't blocked by an unrelated storage error.
    if (rmErr) console.warn("Failed to remove photo object from storage", rmErr);
  }
  const { error } = await supabase
    .from("toilet_photos")
    .delete()
    .eq("id", photo.id)
    .eq("author_id", photo.author_id);
  if (error) throw error;
}

/** Persists a new display order for a toilet's photos (author only). The
 * first id in the list becomes position 0 — the listing's hero image. */
export async function reorderToiletPhotos(
  toiletId: string,
  photoIds: string[]
): Promise<void> {
  if (photoIds.length === 0) return;
  const { error } = await supabase.rpc("reorder_toilet_photos", {
    p_toilet_id: toiletId,
    p_photo_ids: photoIds,
  });
  if (error) throw error;
}

/** Editable fields on a listing, keyed by the toilet column name. */
export interface ToiletEditInput {
  venue_name: string | null;
  venue_types: string[];
  access_types: string[];
  supplies: string[];
  wheelchair: Toilet["wheelchair"];
  hint_chips: string[];
  hint_note: string | null;
  cleanliness: number | null;
  smell: number | null;
  privacy: number | null;
  floor: string | null;
  lat: number;
  lng: number;
  location_source: Toilet["location_source"];
  venue_id: string | null;
  address_road: string | null;
  address_house_number: string | null;
  address_suburb: string | null;
  address_city: string | null;
  address_postcode: string | null;
  address_country: string | null;
}

export async function updateOwnToilet(
  id: string,
  patch: ToiletEditInput
): Promise<Toilet> {
  const { data, error } = await supabase.rpc("update_own_toilet", {
    p_id: id,
    p_patch: Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    ),
  });
  if (error) throw error;
  return data as Toilet;
}

export async function deleteOwnToilet(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_own_toilet", { p_id: id });
  if (error) throw error;
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
): Promise<Report | null> {
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
  if (error) {
    // Already reported this target from this account — treat as idempotent
    // rather than an error, since the reporter's intent is already satisfied.
    if (error.code === "23505") return null;
    throw error;
  }
  return data as Report;
}

export interface ReviewWithToilet extends Review {
  toilet: Pick<Toilet, "id" | "venue_name" | "venue_types"> | null;
}

export async function myContributions(authorId: string) {
  const [toiletsRes, reviewsRes] = await Promise.all([
    supabase.from("toilets").select("*").eq("author_id", authorId),
    supabase
      .from("reviews")
      .select("*, toilet:toilets(id, venue_name, venue_types)")
      .eq("author_id", authorId)
      .order("created_at", { ascending: false }),
  ]);
  if (toiletsRes.error) throw toiletsRes.error;
  if (reviewsRes.error) throw reviewsRes.error;
  return {
    toilets: (toiletsRes.data ?? []) as Toilet[],
    reviews: (reviewsRes.data ?? []) as unknown as ReviewWithToilet[],
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
