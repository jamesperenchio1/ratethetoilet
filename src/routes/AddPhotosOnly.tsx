import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import { getToilet, uploadToiletPhoto } from "../lib/api";
import type { ToiletWithAuthor } from "../lib/types";

export function AddPhotosOnly() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { withIdentity } = useIdentity();
  const [toilet, setToilet] = useState<ToiletWithAuthor | null>(null);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
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
    try {
      await withIdentity(async (profile) => {
        for (const file of newPhotos) {
          await uploadToiletPhoto(profile.id, id, file);
        }
      });
      navigate(`/t/${id}`);
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
            <div key={p.id} className="img" style={{ width: 56, height: 56 }} />
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
          {newPhotos.map((_, i) => (
            <div
              key={i}
              className="img"
              style={{ width: 56, height: 56, cursor: "pointer" }}
              onClick={() => setNewPhotos((p) => p.filter((_, j) => j !== i))}
            >
              {i + 1} ✕
            </div>
          ))}
        </div>

        <div className="note" style={{ fontSize: 11 }}>
          Newest photo shows first — a fresh one is worth more than a good one.
        </div>

        <button className="btn" style={{ marginTop: "auto" }} disabled={newPhotos.length === 0 || busy} onClick={submit}>
          Add {newPhotos.length || ""} photo{newPhotos.length === 1 ? "" : "s"}
        </button>
      </div>
    </>
  );
}
