import { get, set, del, keys } from "idb-keyval";
import type { QueuedPost } from "./types";
import { addReview, createToilet, type NewToiletInput } from "./api";

const PREFIX = "queue:";

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

/** Attempts to flush the queue against the live backend. Best-effort — a
 * failure on one item leaves it queued and moves on. */
export async function flushQueue(authorId: string): Promise<{ sent: number; remaining: number }> {
  const items = await listQueued();
  let sent = 0;
  for (const item of items) {
    try {
      if (item.kind === "toilet") {
        await createToilet(authorId, item.payload as NewToiletInput);
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
  const remaining = (await listQueued()).length;
  return { sent, remaining };
}
