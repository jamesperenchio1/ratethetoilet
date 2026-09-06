import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uploadDraftPhoto, photoUrl, friendlyUploadError } from "../../lib/api";
import { compressImage } from "../../lib/imageCompress";
import { CONFIG } from "../../lib/config";
import type { FloorEntry, PendingPhoto } from "./types";
import { PhotoEditor } from "./PhotoEditor";
import { StepDots } from "./StepDots";
import { ProgressFill, UploadProgressOverlay } from "../../components/UploadProgress";
import { throttledProgress } from "../../lib/throttledProgress";

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
      {photo.status === "uploading" && <UploadProgressOverlay progress={photo.progress ?? 0} />}
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

function SortablePhoto({
  photo,
  index,
  loadingEdit,
  onTap,
  onRemove,
  onRetry,
}: {
  photo: PendingPhoto;
  index: number;
  loadingEdit: boolean;
  onTap: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.localId,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, display: "flex", flexDirection: "column", gap: 2, maxWidth: 64 }}
      {...attributes}
      {...listeners}
    >
      <div style={{ position: "relative", touchAction: "none" }}>
        <Thumb photo={photo} onClick={onTap} />
        {loadingEdit && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
            }}
          >
            …
          </span>
        )}
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
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
        {photo.status === "error" && (
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
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
      <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>{index + 1}</span>
      {photo.status === "error" && photo.errorMessage && (
        <span style={{ fontSize: 9, color: "var(--red-3)", wordBreak: "break-word" }}>{photo.errorMessage}</span>
      )}
      {photo.status !== "error" && photo.warning && (
        <span style={{ fontSize: 9, color: "var(--text-muted)", wordBreak: "break-word" }}>{photo.warning}</span>
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
  const [dragOver, setDragOver] = useState(false);
  const justDragged = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDropZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDropZoneDragLeave() {
    setDragOver(false);
  }

  function onDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  // PC-native QoL: allow pasting an image (Ctrl/Cmd+V) straight from the clipboard.
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) addFilesRef.current(files as unknown as FileList);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onDragStart() {
    justDragged.current = true;
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    justDragged.current = true;
    if (!over || active.id === over.id) return;
    onChangeEntry((prev) => {
      const from = prev.photos.findIndex((p) => p.localId === active.id);
      const to = prev.photos.findIndex((p) => p.localId === over.id);
      if (from === -1 || to === -1) return prev;
      return { ...prev, photos: arrayMove(prev.photos, from, to) };
    });
  }

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
    updatePhoto(localId, { file, status: "uploading", errorMessage: undefined, warning: undefined, progress: 0 });
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
    // storageUpload() already retries internally (with backoff) on failure —
    // no separate retry here, so the progress bar doesn't repeatedly snap
    // back to 0% for what the user perceives as one upload.
    const onProgress = throttledProgress((fraction) => updatePhoto(localId, { progress: fraction }));
    try {
      const path = await uploadDraftPhoto(draftId, localId, upload, onProgress);
      updatePhoto(localId, { storagePath: path, status: "done" });
    } catch (err) {
      updatePhoto(localId, { status: "error", errorMessage: friendlyUploadError(err) });
    }
  }

  async function retryPhoto(localId: string) {
    const p = entry.photos.find((ph) => ph.localId === localId);
    if (!p || !p.file) return;
    updatePhoto(localId, { status: "uploading", errorMessage: undefined, progress: 0 });
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
  // Averaged by count, not bytes — a photo restored from a prior session
  // (its File object doesn't survive persistence) has no size to weight by,
  // and compression already normalizes uploads to a similar size anyway.
  const uploadingPhotos = entry.photos.filter((p) => p.status === "uploading" || p.status === "done");
  const batchProgress =
    uploadingPhotos.length > 0
      ? uploadingPhotos.reduce((sum, p) => sum + (p.status === "done" ? 1 : (p.progress ?? 0)), 0) /
        uploadingPhotos.length
      : 0;

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
        <div
          className="box dashed"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 160,
            gap: 4,
            borderColor: dragOver ? "var(--surface-accent)" : undefined,
          }}
          onDragOver={onDropZoneDragOver}
          onDragLeave={onDropZoneDragLeave}
          onDrop={onDropZoneDrop}
        >
          {dragOver ? "Drop to add" : "No photos yet — drop or tap to add"}
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
          ▣ Upload
        </button>
      </div>

      {anyUploading && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(batchProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ borderRadius: 3, overflow: "hidden" }}
        >
          <ProgressFill progress={batchProgress} height={6} track="var(--surface-note)" />
        </div>
      )}
      {typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Drag &amp; drop, or paste (Ctrl/Cmd+V) images from your computer
        </div>
      )}

      {entry.photos.length > 0 && (
        <>
          <div className="lbl">Added · {entry.photos.length} of {CONFIG.wizard.maxPhotos}</div>
          {entry.photos.length > 1 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Drag to reorder — the first photo shows first.
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <SortableContext items={entry.photos.map((p) => p.localId)} strategy={rectSortingStrategy}>
              <div
                style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                onDragOver={onDropZoneDragOver}
                onDragLeave={onDropZoneDragLeave}
                onDrop={onDropZoneDrop}
              >
                {entry.photos.map((p, i) => (
                  <SortablePhoto
                    key={p.localId}
                    photo={p}
                    index={i}
                    loadingEdit={loadingEdit === p.localId}
                    onTap={() => {
                      if (justDragged.current) {
                        justDragged.current = false;
                        return;
                      }
                      // A failed photo's main tap target retries the upload —
                      // the crop editor isn't useful (or reachable) for a photo
                      // that never made it to storage and has no preview to fetch.
                      if (p.status === "error") {
                        retryPhoto(p.localId);
                        return;
                      }
                      openEditor(p);
                    }}
                    onRemove={() => removePhoto(p.localId)}
                    onRetry={() => retryPhoto(p.localId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      <div className="note" style={{ fontSize: 11 }}>
        Photos must follow the{" "}
        <Link to="/rules" style={{ color: "var(--chart-4)" }}>
          content rules
        </Link>
        . Faces are fine. Don't post your own mess or urine — but a broken toilet
        with waste left behind is okay.
      </div>

      <button className="btn" disabled={anyUploading} onClick={onNext}>
        {entry.photos.length > 0 ? `Use these ${doneCount} photos` : "Continue without photos"}
      </button>
      {entry.photos.length > 0 && (
        <button className="ghost" disabled={anyUploading} onClick={onNext}>
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
