import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { uploadDraftPhoto } from "../../lib/api";
import type { PendingPhoto, ToiletDraft } from "./types";

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

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = Math.max(0, 6 - draft.photos.length);
    const chosen = Array.from(files).slice(0, room);
    const pending: PendingPhoto[] = chosen.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      storagePath: null,
      status: "uploading",
    }));
    onChange((prev) => ({ ...prev, photos: [...prev.photos, ...pending] }));

    for (const p of pending) {
      try {
        const path = await uploadDraftPhoto(draft.draftId, p.localId, p.file);
        updatePhoto(p.localId, { storagePath: path, status: "done" });
      } catch {
        updatePhoto(p.localId, { status: "error" });
      }
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

      <div className="box dashed" style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 160 }}>
        {draft.photos.length === 0 ? "No photos yet" : `${doneCount} of ${draft.photos.length} uploaded`}
      </div>

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
          <div className="lbl">
            Added · {draft.photos.length} of 6
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {draft.photos.map((p, i) => (
              <div
                key={p.localId}
                className="img"
                style={{
                  width: 50,
                  height: 50,
                  border: "1.5px solid var(--border-strong)",
                  borderColor: p.status === "error" ? "var(--red-3)" : "var(--border-strong)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => removePhoto(p.localId)}
                title={p.status}
              >
                {i + 1} {p.status === "uploading" ? "…" : p.status === "error" ? "!" : "✕"}
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
    </div>
  );
}
