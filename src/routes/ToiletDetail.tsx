import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { ReportSheet } from "../components/ReportSheet";
import { getToilet, addReview, photoUrl } from "../lib/api";
import { enqueuePost } from "../lib/offlineQueue";
import { ACCESS_LABELS, VENUE_LABELS } from "../lib/labels";
import { scoreColor } from "../lib/score";
import type { ToiletWithAuthor, ReportTargetType } from "../lib/types";
import { useIdentity } from "../components/IdentityGateProvider";
import { isSaved, toggleSaved } from "../lib/savedList";

export function ToiletDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { withIdentity, profile } = useIdentity();
  const [toilet, setToilet] = useState<ToiletWithAuthor | null | undefined>(undefined);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [report, setReport] = useState<{ type: ReportTargetType; id: string; label: string } | null>(
    null
  );
  const [reviewText, setReviewText] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    if (!id) return;
    const t = await getToilet(id);
    setToilet(t);
  }

  useEffect(() => {
    load();
    if (id) isSaved(id).then(setSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (toilet === undefined) return <div className="screen-body">Loading…</div>;
  if (toilet === null) return <div className="screen-body">Not found.</div>;

  const photos = toilet.photos?.filter((p) => !p.hidden) ?? [];
  const reviews = toilet.reviews?.filter((r) => !r.hidden) ?? [];

  async function submitReview() {
    if (!id || !reviewText.trim()) return;
    await withIdentity(async (p) => {
      if (!navigator.onLine) {
        await enqueuePost("review", { toiletId: id, body: reviewText.trim() });
        return;
      }
      await addReview(p.id, id, reviewText.trim());
    });
    setReviewText("");
    setReviewOpen(false);
    load();
  }

  const bar = (label: string, value: number | null) => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span>{label}</span>
        <span className="num">{value ?? "Not rated"}</span>
      </div>
      <div className="score-bar">
        <i style={{ width: `${value ?? 0}%`, background: scoreColor(value) }} />
      </div>
    </>
  );

  const displayName = toilet.venue_name || VENUE_LABELS[toilet.venue_type];
  const title = toilet.floor ? `${displayName} · Floor ${toilet.floor}` : displayName;

  return (
    <>
      <TopBar
        back
        title={title}
        right={
          <span
            style={{ fontSize: 12, color: saved ? "var(--chart-4)" : "var(--text-muted)", cursor: "pointer" }}
            onClick={() => id && toggleSaved(id).then(setSaved)}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </span>
        }
      />
      <div className="screen-body">
        {photos.length > 0 ? (
          <div style={{ position: "relative" }}>
            <img
              src={photoUrl(photos[photoIndex].storage_path)}
              alt=""
              style={{
                width: "100%",
                height: 180,
                objectFit: "cover",
                borderRadius: 6,
                border: "1.5px solid var(--border-strong)",
              }}
              onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
            />
            <span
              style={{ position: "absolute", right: 8, top: 8, fontSize: 11, color: "#fff", cursor: "pointer" }}
              onClick={() =>
                setReport({ type: "photo", id: photos[photoIndex].id, label: toilet.venue_name || "" })
              }
            >
              photo {photoIndex + 1}/{photos.length} · flag
            </span>
          </div>
        ) : (
          <div
            className="box dashed"
            style={{ height: 100, alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={() => navigate(`/t/${id}/add-photos`)}
          >
            No photos yet — add one
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <b style={{ fontSize: 15 }}>{title}</b>
          <span className="num" style={{ fontSize: 22, color: scoreColor(toilet.overall_score) }}>
            {toilet.overall_score ?? "—"}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {VENUE_LABELS[toilet.venue_type]} · {ACCESS_LABELS[toilet.access_type]}
          {toilet.wheelchair === "yes" && " · Wheelchair"}
          {toilet.supplies.length > 0 && ` · ${toilet.supplies.join(", ")}`}
        </div>

        {toilet.hint_note && (
          <div className="note">
            <b>HOW TO FIND IT</b>
            <br />
            {toilet.hint_note}
            <span
              style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}
            >
              {toilet.author?.handle ?? "unknown"} ·{" "}
              <span
                style={{ cursor: "pointer" }}
                onClick={() => setReport({ type: "hint", id: toilet.id, label: "how-to-find-it note" })}
              >
                flag
              </span>
            </span>
          </div>
        )}

        <div className="box">
          {bar("Cleanliness", toilet.cleanliness)}
          {bar("Smell", toilet.smell)}
          {bar("Privacy", toilet.privacy)}
        </div>

        <div className="lbl">Reviews</div>
        {reviews.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No reviews yet.</div>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="box" style={{ fontSize: 11 }}>
            "{r.body}"{" "}
            <span style={{ color: "var(--text-muted)" }}>
              {r.author?.handle ?? "unknown"} ·{" "}
              <span
                style={{ cursor: "pointer" }}
                onClick={() => setReport({ type: "review", id: r.id, label: r.body })}
              >
                flag
              </span>
            </span>
          </div>
        ))}

        {reviewOpen && (
          <div className="box">
            <textarea
              autoFocus
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you notice?"
              rows={3}
              style={{ border: "none", resize: "none", fontSize: 13 }}
            />
            <button className="btn" onClick={submitReview} disabled={!reviewText.trim()}>
              Post review{profile ? ` as ${profile.handle}` : ""}
            </button>
          </div>
        )}

        <span
          style={{ fontSize: 12, color: "var(--chart-4)", cursor: "pointer" }}
          onClick={() => navigate(`/t/${id}/add-photos`)}
        >
          + Add photos to this toilet
        </span>
      </div>

      <div style={{ borderTop: "1.5px solid var(--border-strong)", padding: 9, display: "flex", gap: 7 }}>
        <a
          className="btn"
          style={{ flex: 1 }}
          href={`https://www.google.com/maps/search/?api=1&query=${toilet.lat},${toilet.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Maps
        </a>
        <button className="btn2" style={{ width: 96 }} onClick={() => setReviewOpen((v) => !v)}>
          Review
        </button>
      </div>

      {report && (
        <ReportSheet
          targetType={report.type}
          targetId={report.id}
          reporterId={profile?.id ?? null}
          contextLabel={report.label}
          onClose={() => setReport(null)}
        />
      )}
    </>
  );
}
