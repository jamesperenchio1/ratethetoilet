import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => {
    store.set(k, v);
  },
  del: async (k: string) => {
    store.delete(k);
  },
  keys: async () => Array.from(store.keys()),
}));

const createToilet = vi.fn();
const attachDraftPhotos = vi.fn();
const addReview = vi.fn();
const findOrCreateVenue = vi.fn();

vi.mock("./api", () => ({
  createToilet,
  attachDraftPhotos,
  addReview,
  findOrCreateVenue,
}));

const { enqueuePost, listQueued, flushQueue } = await import("./offlineQueue");

const AUTHOR_ID = "author-1";

function toiletPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    input: { lat: 1, lng: 2, venue_types: [] },
    storagePaths: ["draft/x/a.jpg"],
    venueName: null,
    lat: 1,
    lng: 2,
    review: "great spot",
    ...overrides,
  };
}

describe("offlineQueue flush", () => {
  beforeEach(() => {
    store.clear();
    createToilet.mockReset();
    attachDraftPhotos.mockReset();
    addReview.mockReset();
    findOrCreateVenue.mockReset();
  });

  it("persists createdToiletId after createToilet succeeds, so a later failure doesn't re-create the toilet", async () => {
    createToilet.mockResolvedValue({ id: "toilet-1" });
    // Photo attach fails this round (e.g. a flaky connection) — the toilet
    // itself must not be re-created on the next flush.
    attachDraftPhotos.mockRejectedValueOnce(new Error("network blip"));

    await enqueuePost("toilet", toiletPayload());

    const first = await flushQueue(AUTHOR_ID);
    expect(first).toEqual({ sent: 0, remaining: 1 });
    expect(createToilet).toHaveBeenCalledTimes(1);

    const queued = await listQueued();
    expect(queued).toHaveLength(1);
    expect((queued[0].payload as { createdToiletId?: string }).createdToiletId).toBe("toilet-1");

    // Second flush: attach + review succeed this time.
    attachDraftPhotos.mockResolvedValue(undefined);
    addReview.mockResolvedValue({ id: "review-1" });

    const second = await flushQueue(AUTHOR_ID);
    expect(second).toEqual({ sent: 1, remaining: 0 });
    // createToilet must still have been called exactly once across both flushes.
    expect(createToilet).toHaveBeenCalledTimes(1);
    expect(attachDraftPhotos).toHaveBeenCalledWith(AUTHOR_ID, "toilet-1", ["draft/x/a.jpg"]);

    expect(await listQueued()).toHaveLength(0);
  });

  it("shares a single in-flight flush across concurrent callers instead of double-posting", async () => {
    createToilet.mockResolvedValue({ id: "toilet-2" });
    attachDraftPhotos.mockResolvedValue(undefined);
    addReview.mockResolvedValue({ id: "review-2" });

    await enqueuePost("toilet", toiletPayload());

    const [a, b] = await Promise.all([flushQueue(AUTHOR_ID), flushQueue(AUTHOR_ID)]);
    expect(a).toEqual(b);
    expect(createToilet).toHaveBeenCalledTimes(1);
  });

  it("leaves a review-kind item queued on failure and retries it on the next flush", async () => {
    addReview.mockRejectedValueOnce(new Error("offline"));

    await enqueuePost("review", { toiletId: "toilet-3", body: "nice" });

    const first = await flushQueue(AUTHOR_ID);
    expect(first).toEqual({ sent: 0, remaining: 1 });

    addReview.mockResolvedValueOnce({ id: "review-3" });
    const second = await flushQueue(AUTHOR_ID);
    expect(second).toEqual({ sent: 1, remaining: 0 });
    expect(addReview).toHaveBeenCalledTimes(2);
  });
});
