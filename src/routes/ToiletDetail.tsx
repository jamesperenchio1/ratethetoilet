import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { ReportSheet } from "../components/ReportSheet";
import { getToilet, addReview, photoUrl } from "../lib/api";
import { enqueuePost } from "../lib/offlineQueue";
import { accessTypesLabel, venueTypesLabel } from "../lib/labels";
import { scoreColor } from "../lib/score";
import type { ToiletWithAuthor, ReportTargetType } from "../lib/types";
import { useIdentity } from "../components/IdentityGateProvider";
import { ExternalIcon } from "../components/layout/NavIcons";

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
  const [posting, setPosting] = useState(false);

  async function load() {
    if (!id) return;
    const t = await getToilet(id);
    setToilet(t);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (toilet === undefined) return <div className="screen-body">Loading…</div>;
  if (toilet === null) return <div className="screen-body">Not found.</div>;

  const photos = toilet.photos?.filter((p) => !p.hidden) ?? [];
  const reviews = toilet.reviews?.filter((r) => !r.hidden) ?? [];

  async function submitReview() {
    if (!id || !reviewText.trim() || posting) return;
    setPosting(true);
    try {
      await withIdentity(async (p) => {
        if (!navigator.onLine) {
          await enqueuePost("review", { toiletId: id, body: reviewText.trim() });
          return;
        }
        await addReview(p.id, id, reviewText.trim());
      });
      setReviewText("");
      load();
    } finally {
      setPosting(false);
    }
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

  const displayName = toilet.venue_name || venueTypesLabel(toilet.venue_types) || "Toilet";
  const title = toilet.floor ? `${displayName} · Floor ${toilet.floor}` : displayName;

  return (
    <>
      <TopBar back title={title} />
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
          {venueTypesLabel(toilet.venue_types)} · {accessTypesLabel(toilet.access_types)}
          {toilet.wheelchair === "yes" && " · Wheelchair"}
          {toilet.supplies.length > 0 && ` · ${toilet.supplies.join(", ")}`}
        </div>

        {toilet.hint_note && (
          <div className="note">
            <b>HOW TO FIND IT</b>
            <br />
            {toilet.hint_note}
            <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
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
        <div className="box">
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="What did you notice?"
            rows={3}
            style={{ border: "none", resize: "none", fontSize: 13 }}
          />
          <button className="btn" onClick={submitReview} disabled={!reviewText.trim() || posting}>
            {posting ? "Posting…" : `Post review${profile ? ` as ${profile.handle}` : ""}`}
          </button>
        </div>
        {reviews.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No reviews yet — be the first.</div>
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

        <span
          style={{ fontSize: 12, color: "var(--chart-4)", cursor: "pointer" }}
          onClick={() => navigate(`/t/${id}/add-photos`)}
        >
          + Add photos to this toilet
        </span>
      </div>

      <div style={{ borderTop: "1.5px solid var(--border-strong)", padding: 9 }}>
        <a
          className="btn"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          href={`https://www.google.com/maps/search/?api=1&query=${toilet.lat},${toilet.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalIcon /> Open in Maps
        </a>
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
