import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { uploadDraftPhoto, photoUrl } from "../../lib/api";
import type { PendingPhoto, ToiletDraft } from "./types";
import { PhotoEditor } from "./PhotoEditor";

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
        borderColor: photo.status === "error" ? "var(--red-3)" : "var(--border-strong)",
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
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            background: "rgba(255,255,255,.6)",
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
  draft,
  onChange,
  onNext,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onNext: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ localId: string; file: File } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = Math.max(0, 6 - draft.photos.length);
    const chosen = Array.from(files).slice(0, room);
    const withIds = chosen.map((file) => ({ localId: crypto.randomUUID(), file }));
    const pending: PendingPhoto[] = withIds.map(({ localId, file }) => ({
      localId,
      file,
      storagePath: null,
      status: "uploading",
    }));
    onChange((prev) => ({ ...prev, photos: [...prev.photos, ...pending] }));

    for (const { localId, file } of withIds) {
      await uploadOne(localId, file);
    }
  }

  async function uploadOne(localId: string, file: File) {
    updatePhoto(localId, { file, status: "uploading" });
    try {
      const path = await uploadDraftPhoto(draft.draftId, localId, file);
      updatePhoto(localId, { storagePath: path, status: "done" });
    } catch {
      updatePhoto(localId, { status: "error" });
    }
  }

  function updatePhoto(localId: string, patch: Partial<PendingPhoto>) {
    onChange((prev) => ({
      ...prev,
      photos: prev.photos.map((ph) => (ph.localId === localId ? { ...ph, ...patch } : ph)),
    }));
  }

  function removePhoto(localId: string) {
    onChange((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.localId !== localId) }));
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

  const doneCount = draft.photos.filter((p) => p.status === "done").length;
  const anyUploading = draft.photos.some((p) => p.status === "uploading");

  return (
    <div className="screen-body">
      <div className="stepper">
        <i className="done" />
        <i />
        <i />
        <i />
        <i />
      </div>

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

      {draft.photos.length === 0 ? (
        <div className="box dashed" style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          No photos yet
        </div>
      ) : (
        <div className="box" style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          {`${doneCount} of ${draft.photos.length} uploaded`} · tap a photo to crop or rotate
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

      {draft.photos.length > 0 && (
        <>
          <div className="lbl">Added · {draft.photos.length} of 6</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {draft.photos.map((p) => (
              <div key={p.localId} style={{ position: "relative" }}>
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
              </div>
            ))}
          </div>
        </>
      )}

      <div className="note" style={{ fontSize: 11 }}>
        No people or faces. Uploads keep the date, never your GPS.
      </div>

      <button className="btn" disabled={anyUploading} onClick={onNext}>
        {draft.photos.length > 0 ? `Use these ${draft.photos.length} photos` : "Continue without photos"}
      </button>
      {draft.photos.length > 0 && (
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
