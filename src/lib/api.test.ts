import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const getSession = vi.fn();
const createSignedUploadUrl = vi.fn();
const storageFrom = vi.fn(() => ({ createSignedUploadUrl }));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => getSession(...args) },
    storage: { from: (...args: unknown[]) => storageFrom(...args) },
  },
  SUPABASE_ANON_KEY: "test-anon-key",
}));

// Imported after the mock is registered so `api.ts` picks up the fake supabase client.
const { uploadDraftPhoto } = await import("./api");

/** Minimal fake standing in for the browser's XMLHttpRequest, capturing enough
 * to drive `xhr.upload.onprogress` / `onload` / `onerror` / `onabort` from
 * the test, since jsdom/node don't provide a real network stack here. */
class FakeXHR {
  static instances: FakeXHR[] = [];
  status = 0;
  responseText = "";
  aborted = false;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  headers: Record<string, string> = {};
  method = "";
  url = "";
  body: unknown;
  sent = false;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    FakeXHR.instances.push(this);
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send(body: unknown) {
    this.body = body;
    this.sent = true;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  /** Test helper: simulate the server responding successfully. */
  succeed() {
    this.status = 200;
    this.onload?.();
  }
  /** Test helper: simulate a browser-level network failure. */
  fail() {
    this.onerror?.();
  }
  /** Test helper: simulate a non-2xx server response. */
  respondWithStatus(status: number, responseText = "") {
    this.status = status;
    this.responseText = responseText;
    this.onload?.();
  }
}

function lastXhr(): FakeXHR {
  const xhr = FakeXHR.instances[FakeXHR.instances.length - 1];
  if (!xhr) throw new Error("no XHR was opened");
  return xhr;
}

/** Advances fake timers and flushes pending microtasks so an async retry loop
 * (setTimeout backoff, then awaited promises) can make forward progress. */
async function tick(ms = 0) {
  if (ms > 0) await vi.advanceTimersByTimeAsync(ms);
  else await Promise.resolve();
  await Promise.resolve();
}

describe("uploadDraftPhoto (storageUpload)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    getSession.mockReset();
    createSignedUploadUrl.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "user-token" } } });
    createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/object/upload/sign/foo?token=abc", token: "abc", path: "foo" },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const file = new File([new Uint8Array(1000)], "photo.jpg", { type: "image/jpeg" });

  it("resolves with the storage path and reports progress up to 1 on success", async () => {
    const progressValues: number[] = [];
    const resultPromise = uploadDraftPhoto("draft1", "local1", file, (f) => progressValues.push(f));

    await tick();
    const xhr = lastXhr();
    expect(xhr.method).toBe("PUT");
    expect(xhr.headers.authorization).toBe("Bearer user-token");
    expect(xhr.headers.apikey).toBe("test-anon-key");
    // Body must be multipart/form-data (matching the SDK's own signed-upload
    // request shape), not a raw file with hand-set content-type headers.
    expect(xhr.body).toBeInstanceOf(FormData);
    expect(xhr.headers["content-type"]).toBeUndefined();

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 500, total: 1000 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1000, total: 1000 });
    xhr.succeed();

    const path = await resultPromise;
    expect(path).toContain("draft/draft1/local1-");
    expect(progressValues).toContain(0.5);
    expect(progressValues[progressValues.length - 1]).toBe(1);
  });

  it("retries after a network error and succeeds on the second attempt", async () => {
    const resultPromise = uploadDraftPhoto("draft1", "local1", file);

    await tick();
    expect(FakeXHR.instances).toHaveLength(1);
    lastXhr().fail();

    // First retry backs off 1000ms (2^0 * 1000).
    await tick(1000);
    expect(FakeXHR.instances).toHaveLength(2);
    lastXhr().succeed();

    await expect(resultPromise).resolves.toContain("draft/draft1/local1-");
  });

  it("gives up and throws after exhausting all retries", async () => {
    const resultPromise = uploadDraftPhoto("draft1", "local1", file);
    // Reject the assertion promise now so an unhandled rejection isn't flagged
    // while we drive the fake timers/XHR below.
    const assertion = expect(resultPromise).rejects.toThrow();

    for (let attempt = 0; attempt < 4; attempt++) {
      await tick(attempt === 0 ? 0 : Math.min(1000 * 2 ** (attempt - 1), 8000));
      lastXhr().fail();
    }

    await assertion;
    // 1 initial attempt + 3 retries = 4 total.
    expect(FakeXHR.instances).toHaveLength(4);
  });

  it("aborts and retries a request that never resolves within the per-attempt timeout", async () => {
    const resultPromise = uploadDraftPhoto("draft1", "local1", file);

    await tick();
    const firstXhr = lastXhr();
    // First attempt's timeout is UPLOAD_TIMEOUT_MS * 1 = 45s; never call
    // succeed()/fail() on it — the outer timer should abort it instead.
    await tick(45_000);
    expect(firstXhr.aborted).toBe(true);

    // Backs off 1000ms before the second attempt.
    await tick(1000);
    expect(FakeXHR.instances).toHaveLength(2);
    lastXhr().succeed();

    await expect(resultPromise).resolves.toContain("draft/draft1/local1-");
  });

  it("surfaces a non-2xx response as a status-coded error, not a generic network message", async () => {
    const resultPromise = uploadDraftPhoto("draft1", "local1", file);
    const assertion = expect(resultPromise).rejects.toThrow(/status 403/);

    for (let attempt = 0; attempt < 4; attempt++) {
      await tick(attempt === 0 ? 0 : Math.min(1000 * 2 ** (attempt - 1), 8000));
      lastXhr().respondWithStatus(403, "Forbidden");
    }

    await assertion;
  });

  it("surfaces createSignedUploadUrl errors as retryable failures too", async () => {
    createSignedUploadUrl
      .mockResolvedValueOnce({ data: null, error: new Error("insert not permitted") })
      .mockResolvedValueOnce({
        data: { signedUrl: "https://storage.example/object/upload/sign/foo?token=abc", token: "abc", path: "foo" },
        error: null,
      });

    const resultPromise = uploadDraftPhoto("draft1", "local1", file);

    await tick(1000);
    lastXhr().succeed();

    await expect(resultPromise).resolves.toContain("draft/draft1/local1-");
    expect(createSignedUploadUrl).toHaveBeenCalledTimes(2);
  });
});
