import { useEffect, useRef, useState } from "react";
import { uploadDraftPhoto, photoUrl, friendlyUploadError } from "../../lib/api";
import { compressImage } from "../../lib/imageCompress";
import { CONFIG } from "../../lib/config";
import type { FloorEntry, PendingPhoto } from "./types";
import { PhotoEditor } from "./PhotoEditor";
import { StepDots } from "./StepDots";

function Thumb({ photo, onClick }: { photo: PendingPhoto; onClick: () => void }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo.file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.file]);

  const src = objectUrl ?? (photo.storagePath ? photoUrl(photo.storagePath) : null);

  return (
    <div
      className="img"
      style={{
        width: 64,
        height: 64,
        border: "1.5px solid var(--border-strong)",
        borderColor:
          photo.status === "error"
            ? "var(--red-3)"
            : photo.status === "done"
              ? "var(--green-3)"
              : "var(--border-strong)",
        borderRadius: 4,
        position: "relative",
        cursor: "pointer",
        overflow: "hidden",
        background: "var(--surface-note)",
      }}
      onClick={onClick}
      title={photo.status}
    >
      {src && (
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
      {photo.status === "uploading" && (
        <span
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "rgba(255,255,255,.9)",
            border: "1px solid var(--border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
          }}
        >
          …
        </span>
      )}
      {photo.status === "error" && (
        <span
          style={{
            position: "absolute",
            right: 2,
            top: 2,
            fontSize: 10,
            color: "var(--red-3)",
            fontWeight: 700,
          }}
        >
          !
        </span>
      )}
    </div>
  );
}

export function StepPhotos({
  entry,
  onChangeEntry,
  onNext,
  ensureSession,
  draftId,
  stepIndex = 1,
  stepTotal = 5,
  heading,
}: {
  entry: FloorEntry;
  onChangeEntry: (updater: (prev: FloorEntry) => FloorEntry) => void;
  onNext: () => void;
  ensureSession: () => Promise<unknown>;
  draftId: string;
  stepIndex?: number;
  stepTotal?: number;
  heading?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ localId: string; file: File } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  function updatePhoto(localId: string, patch: Partial<PendingPhoto>) {
    onChangeEntry((prev) => ({
      ...prev,
      photos: prev.photos.map((ph) => (ph.localId === localId ? { ...ph, ...patch } : ph)),
    }));
  }

  function removePhoto(localId: string) {
    onChangeEntry((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.localId !== localId) }));
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = Math.max(0, CONFIG.wizard.maxPhotos - entry.photos.length);
    const chosen = Array.from(files).slice(0, room);
    const withIds = chosen.map((file) => ({ localId: crypto.randomUUID(), file }));
    const pending: PendingPhoto[] = withIds.map(({ localId, file }) => ({
      localId,
      file,
      storagePath: null,
      status: "uploading",
    }));
    onChangeEntry((prev) => ({ ...prev, photos: [...prev.photos, ...pending] }));

    // A device session (anonymous, if needed) must exist before storage
    // accepts an insert — waiting here avoids a race with the wizard's silent
    // sign-in on mount, which could otherwise still be in flight.
    try {
      await ensureSession();
    } catch (err) {
      const msg = friendlyUploadError(err);
      pending.forEach((p) => updatePhoto(p.localId, { status: "error", errorMessage: msg }));
      return;
    }

    // Upload the batch in parallel with a small concurrency cap — a flaky link
    // is better served by a couple of small transfers than one long serial queue.
    const queue = [...pending];
    const workers = Array.from(
      { length: Math.min(CONFIG.wizard.photoUploadConcurrency, queue.length) },
      async () => {
        while (queue.length) {
          const p = queue.shift()!;
          await uploadOne(p.localId, p.file!);
        }
      }
    );
    await Promise.all(workers);
  }

  async function uploadOne(localId: string, file: File) {
    updatePhoto(localId, { file, status: "uploading", errorMessage: undefined, warning: undefined });
    // Full-resolution phone photos (3-8MB HEIC/JPEG) are large enough that a
    // slow or cellular connection can time out mid-transfer — downscale before
    // sending. photo.file (used for preview/re-edit) keeps the original.
    let upload: File;
    try {
      const result = await compressImage(file);
      upload = result.file;
      if (result.fellBackToOriginal && file.size > 3_000_000) {
        updatePhoto(localId, { warning: "Couldn't shrink this photo — uploading full size, may be slow." });
      }
    } catch (err) {
      updatePhoto(localId, { status: "error", errorMessage: friendlyUploadError(err) });
      return;
    }
    try {
      const path = await uploadDraftPhoto(draftId, localId, upload);
      updatePhoto(localId, { storagePath: path, status: "done" });
    } catch (err1) {
      // One retry — a single flaky mobile request shouldn't flip a fine photo to "failed".
      try {
        await new Promise((r) => setTimeout(r, CONFIG.wizard.photoRetryDelayMs));
        const path = await uploadDraftPhoto(draftId, localId, upload);
        updatePhoto(localId, { storagePath: path, status: "done" });
      } catch (err2) {
        updatePhoto(localId, { status: "error", errorMessage: friendlyUploadError(err2 ?? err1) });
      }
    }
  }

  async function retryPhoto(localId: string) {
    const p = entry.photos.find((ph) => ph.localId === localId);
    if (!p || !p.file) return;
    updatePhoto(localId, { status: "uploading", errorMessage: undefined });
    try {
      await ensureSession();
    } catch (err) {
      updatePhoto(localId, { status: "error", errorMessage: friendlyUploadError(err) });
      return;
    }
    await uploadOne(localId, p.file);
  }

  async function openEditor(photo: PendingPhoto) {
    if (photo.status === "uploading") return;
    if (photo.file) {
      setEditing({ localId: photo.localId, file: photo.file });
      return;
    }
    if (!photo.storagePath) return;
    setLoadingEdit(photo.localId);
    try {
      const res = await fetch(photoUrl(photo.storagePath));
      const blob = await res.blob();
      setEditing({ localId: photo.localId, file: new File([blob], "photo.jpg", { type: blob.type }) });
    } catch {
      // Original bytes aren't reachable (offline, storage hiccup) — nothing to edit yet.
    } finally {
      setLoadingEdit(null);
    }
  }

  const doneCount = entry.photos.filter((p) => p.status === "done").length;
  const anyUploading = entry.photos.some((p) => p.status === "uploading");

  return (
    <div className="screen-body">
      <StepDots total={stepTotal} done={stepIndex} />
      {heading && <b style={{ fontSize: 14 }}>{heading}</b>}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {entry.photos.length === 0 ? (
        <div className="box dashed" style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          No photos yet
        </div>
      ) : (
        <div className="box" style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          {`${doneCount} of ${entry.photos.length} uploaded`} · tap a photo to crop or rotate
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn2" style={{ flex: 1 }} onClick={() => cameraRef.current?.click()}>
          ◉ Take a photo
        </button>
        <button className="btn2" style={{ flex: 1 }} onClick={() => uploadRef.current?.click()}>
          ▣ Upload from phone
        </button>
      </div>

      {entry.photos.length > 0 && (
        <>
          <div className="lbl">Added · {entry.photos.length} of {CONFIG.wizard.maxPhotos}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {entry.photos.map((p) => (
              <div key={p.localId} style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 64 }}>
              <div style={{ position: "relative" }}>
                <Thumb photo={p} onClick={() => openEditor(p)} />
                {loadingEdit === p.localId && (
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                    …
                  </span>
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(p.localId);
                  }}
                  style={{
                    position: "absolute",
                    right: -5,
                    top: -5,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--ink-1)",
                    color: "#fff",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </span>
                {p.status === "error" && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      retryPhoto(p.localId);
                    }}
                    style={{
                      position: "absolute",
                      left: -5,
                      bottom: -5,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "var(--red-3)",
                      color: "#fff",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    ⟳
                  </span>
                )}
              </div>
              {p.status === "error" && p.errorMessage && (
                <span style={{ fontSize: 9, color: "var(--red-3)", wordBreak: "break-word" }}>
                  {p.errorMessage}
                </span>
              )}
              {p.status !== "error" && p.warning && (
                <span style={{ fontSize: 9, color: "var(--text-muted)", wordBreak: "break-word" }}>
                  {p.warning}
                </span>
              )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="note" style={{ fontSize: 11 }}>
        No people or faces. Uploads keep the date, never your GPS.
      </div>

      <button className="btn" disabled={anyUploading} onClick={onNext}>
        {entry.photos.length > 0 ? `Use these ${doneCount} photos` : "Continue without photos"}
      </button>
      {entry.photos.length > 0 && (
        <button className="ghost" onClick={onNext}>
          Skip photos for now
        </button>
      )}

      {editing && (
        <PhotoEditor
          file={editing.file}
          onCancel={() => setEditing(null)}
          onRemove={() => {
            removePhoto(editing.localId);
            setEditing(null);
          }}
          onSave={async (file) => {
            setEditing(null);
            await uploadOne(editing.localId, file);
          }}
        />
      )}
    </div>
  );
}
