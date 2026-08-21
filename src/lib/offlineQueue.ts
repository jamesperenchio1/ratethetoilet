import { get, set, del, keys } from "idb-keyval";
import type { QueuedPost } from "./types";
import { addReview, attachDraftPhotos, createToilet, findOrCreateVenue, type NewToiletInput } from "./api";
import { CONFIG } from "./config";

const PREFIX = CONFIG.storage.queuePrefix;

interface QueuedToilet {
  input: NewToiletInput;
  storagePaths: string[];
  venueName: string | null;
  lat: number;
  lng: number;
  review: string | null;
  /** Set once `createToilet` succeeds, so a re-flush after a later step failed
   * (photos/review) doesn't mint a second toilet. */
  createdToiletId?: string;
}

export async function enqueuePost(
  kind: QueuedPost["kind"],
  payload: unknown
): Promise<string> {
  const localId = crypto.randomUUID();
  const item: QueuedPost = { localId, kind, payload, createdAt: Date.now() };
  await set(PREFIX + localId, item);
  return localId;
}

export async function listQueued(): Promise<QueuedPost[]> {
  const allKeys = await keys();
  const items: QueuedPost[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const v = await get(k);
      if (v) items.push(v as QueuedPost);
    }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueued(localId: string) {
  await del(PREFIX + localId);
}

// Module-level in-flight guard: flushQueue can be triggered from both the
// online-transition effect and the "Try sending now" button. Without a lock,
// two concurrent flushes read the same queue and both create the same posts.
let flushing: Promise<{ sent: number; remaining: number }> | null = null;

/** Attempts to flush the queue against the live backend. Best-effort — a
 * failure on one item leaves it queued and moves on. Concurrent callers share
 * a single flush: if a flush is already in progress, the caller awaits the
 * same run instead of starting a second one that would duplicate posts. */
export function flushQueue(authorId: string): Promise<{ sent: number; remaining: number }> {
  if (flushing) return flushing;
  flushing = doFlush(authorId).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(authorId: string): Promise<{ sent: number; remaining: number }> {
  const items = await listQueued();
  let sent = 0;
  for (const item of items) {
    try {
      if (item.kind === "toilet") {
        const q = item.payload as QueuedToilet;
        let toiletId = q.createdToiletId;
        if (!toiletId) {
          let venueId = q.input.venue_id ?? null;
          if (q.venueName && !venueId) {
            const venue = await findOrCreateVenue(q.venueName, q.lat, q.lng);
            venueId = venue.id;
          }
          const t = await createToilet(authorId, { ...q.input, venue_id: venueId });
          toiletId = t.id;
          // Persist the created id immediately so a failure in the steps below
          // (photos/review) can't cause a duplicate toilet on the next flush.
          await set(PREFIX + item.localId, { ...item, payload: { ...q, createdToiletId: toiletId } });
        }
        if (q.storagePaths.length > 0) {
          await attachDraftPhotos(authorId, toiletId, q.storagePaths);
        }
        if (q.review) {
          await addReview(authorId, toiletId, q.review);
        }
      } else if (item.kind === "review") {
        const { toiletId, body } = item.payload as { toiletId: string; body: string };
        await addReview(authorId, toiletId, body);
      }
      await removeQueued(item.localId);
      sent++;
    } catch {
      // stays queued, try again next time we're online
    }
  }
  // Reuse the already-loaded count rather than re-reading the store.
  const remaining = items.length - sent;
  return { sent, remaining };
}
