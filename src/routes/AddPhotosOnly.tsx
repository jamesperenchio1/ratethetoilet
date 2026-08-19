import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import { getToilet, uploadToiletPhoto, photoUrl, friendlyUploadError } from "../lib/api";
import { compressImage } from "../lib/imageCompress";
import { CONFIG } from "../lib/config";
import type { ToiletWithAuthor } from "../lib/types";

function NewPhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div
      className="img"
      style={{ width: 56, height: 56, cursor: "pointer", position: "relative", overflow: "hidden" }}
      onClick={onRemove}
    >
      {objectUrl && (
        <img src={objectUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
      <span
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
        }}
      >
        ✕
      </span>
    </div>
  );
}

export function AddPhotosOnly() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { withIdentity } = useIdentity();
  const [toilet, setToilet] = useState<ToiletWithAuthor | null>(null);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) getToilet(id).then(setToilet);
  }, [id]);

  if (!toilet) return <div className="screen-body">Loading…</div>;
  const existing = toilet.photos?.filter((p) => !p.hidden) ?? [];

  async function submit() {
    if (!id || newPhotos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await withIdentity(async (profile) => {
        const queue = [...newPhotos];
        const workers = Array.from(
          { length: Math.min(CONFIG.wizard.photoUploadConcurrency, queue.length) },
          async () => {
            while (queue.length) {
              const file = queue.shift()!;
              const compressed = await compressImage(file);
              await uploadToiletPhoto(profile.id, id, compressed);
            }
          }
        );
        await Promise.all(workers);
      });
      navigate(`/t/${id}`);
    } catch (err) {
      console.error(err);
      setError(friendlyUploadError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar back title="Add photos" />
      <div className="screen-body">
        <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <span>{toilet.venue_name || "This toilet"}</span>
          <span className="num" style={{ color: "var(--chart-4)" }}>
            {toilet.overall_score ?? "—"}
          </span>
        </div>

        <div className="lbl">Already posted · {existing.length}</div>
        <div style={{ display: "flex", gap: 5 }}>
          {existing.map((p) => (
            <div key={p.id} className="img" style={{ width: 56, height: 56, overflow: "hidden" }}>
              <img
                src={photoUrl(p.storage_path)}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>

        <div className="lbl">Yours</div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => e.target.files && setNewPhotos((p) => [...p, ...Array.from(e.target.files!)])}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && setNewPhotos((p) => [...p, ...Array.from(e.target.files!)])}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn2" style={{ flex: 1 }} onClick={() => cameraRef.current?.click()}>
            ◉ Take a photo
          </button>
          <button className="btn2" style={{ flex: 1 }} onClick={() => uploadRef.current?.click()}>
            ▣ Upload
          </button>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {newPhotos.map((file, i) => (
            <NewPhotoThumb
              key={i}
              file={file}
              onRemove={() => setNewPhotos((p) => p.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        <div className="note" style={{ fontSize: 11 }}>
          Newest photo shows first — a fresh one is worth more than a good one.
        </div>

        <button className="btn" style={{ marginTop: "auto" }} disabled={newPhotos.length === 0 || busy} onClick={submit}>
          Add {newPhotos.length || ""} photo{newPhotos.length === 1 ? "" : "s"}
        </button>
      </div>
      {busy && <div className="toast">Uploading…</div>}
      {error && !busy && (
        <div className="toast" style={{ background: "var(--red-3)" }}>
          {error}
        </div>
      )}
    </>
  );
}
