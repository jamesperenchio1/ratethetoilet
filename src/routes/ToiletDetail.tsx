import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { ReportSheet } from "../components/ReportSheet";
import { getToilet, addReview, photoUrl, deleteOwnToilet, reorderToiletPhotos } from "../lib/api";
import { isReportedLocally } from "../lib/reportedLocal";
import { addressFromFlat } from "../lib/geocode";
import { AddressBlock } from "../components/AddressBlock";
import { enqueuePost } from "../lib/offlineQueue";
import { accessTypesLabel, venueTypesLabel } from "../lib/labels";
import { scoreColor } from "../lib/score";
import { CONFIG } from "../lib/config";
import { getTurnstileToken } from "../lib/turnstile";
import type { ToiletWithAuthor, ReportTargetType } from "../lib/types";
import { useIdentity } from "../components/IdentityGateProvider";
import { ExternalIcon } from "../components/layout/NavIcons";

export function ToiletDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { withIdentity, profile } = useIdentity();
  const [toilet, setToilet] = useState<ToiletWithAuthor | null | undefined>(undefined);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [report, setReport] = useState<{ type: ReportTargetType; id: string; label: string } | null>(
    null
  );
  const [reviewText, setReviewText] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [justPosted, setJustPosted] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; idx: number } | null>(null);
  const dragged = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [reorderError, setReorderError] = useState(false);

  async function load(attempt = 0) {
    if (!id) return;
    try {
      const t = await getToilet(id);
      setToilet(t);
      setLoadError(false);
    } catch {
      // A couple of quiet auto-retries handle a blip; only surface the error
      // state (and a manual retry) if it's still failing after that.
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        return load(attempt + 1);
      }
      setLoadError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadError) {
    return (
      <div className="screen-body center-empty">
        <b style={{ color: "var(--text-primary)" }}>Couldn't load this toilet.</b>
        <span style={{ color: "var(--text-muted)" }}>Check your connection and try again.</span>
        <button className="btn" style={{ width: "auto", padding: "11px 20px" }} onClick={() => load()}>
          Retry
        </button>
      </div>
    );
  }
  if (toilet === undefined) return <div className="screen-body">Loading…</div>;
  if (toilet === null) return <div className="screen-body">Not found.</div>;

  const photos = toilet.photos?.filter((p) => !p.hidden && !isReportedLocally("photo", p.id)) ?? [];
  const reviews = toilet.reviews?.filter((r) => !r.hidden && !isReportedLocally("review", r.id)) ?? [];

  async function submitReview() {
    if (!id || !reviewText.trim() || posting) return;
    setPosting(true);
    try {
      if (navigator.onLine) await getTurnstileToken();
      await withIdentity(async (p) => {
        if (!navigator.onLine) {
          await enqueuePost("review", { toiletId: id, body: reviewText.trim() });
          return;
        }
        await addReview(p.id, id, reviewText.trim());
      });
      setReviewText("");
      load();
      setJustPosted(true);
      setTimeout(() => setJustPosted(false), 2500);
    } finally {
      setPosting(false);
    }
  }

  async function removeListing() {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      await deleteOwnToilet(id);
      navigate("/you");
    } finally {
      setDeleting(false);
    }
  }

  const isAuthor = profile?.id === toilet.author_id;

  function movePhoto(from: number, to: number) {
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    return ids;
  }

  function handleDrop(from: number, to: number) {
    if (savingOrder) return;
    const ids = movePhoto(from, to);
    setPhotoIndex(from === photoIndex ? to : from > photoIndex && to <= photoIndex ? photoIndex + 1 : from < photoIndex && to >= photoIndex ? photoIndex - 1 : photoIndex);
    setToilet((prev) => (prev ? { ...prev, photos: ids.map((pid) => photos.find((p) => p.id === pid)!) } : prev));
    setSavingOrder(true);
    setReorderError(false);
    if (toilet) {
      const save = async () => {
        try {
          await reorderToiletPhotos(toilet.id, ids);
        } catch {
          setReorderError(true);
          load();
        } finally {
          setSavingOrder(false);
        }
      };
      save();
    }
  }

  function onThumbPointerDown(i: number) {
    return (e: React.PointerEvent) => {
      if (savingOrder) return;
      dragStart.current = { x: e.clientX, y: e.clientY, idx: i };
      dragged.current = false;
      setDragIdx(null);
      setOverIndex(null);
    };
  }

  function onThumbPointerMove(e: React.PointerEvent) {
    const start = dragStart.current;
    if (!start) return;
    if (!dragged.current && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
    dragged.current = true;
    setDragIdx(start.idx);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest("[data-photo-idx]") as HTMLElement | null;
    const idx = target ? Number(target.dataset.photoIdx) : NaN;
    if (!Number.isNaN(idx)) setOverIndex(idx);
  }

  function onThumbPointerUp() {
    const start = dragStart.current;
    dragStart.current = null;
    if (dragged.current && start && overIndex != null && overIndex !== start.idx) {
      handleDrop(start.idx, overIndex);
    }
    setDragIdx(null);
    setOverIndex(null);
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
  const address = addressFromFlat(toilet);

  return (
    <>
      <TopBar back title={title} />
      <div className="screen-body">
        {photos.length > 0 ? (
          <div>
            <div
              style={{ position: "relative" }}
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current == null) return;
                const delta = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(delta) > 40) {
                  setPhotoIndex((i) =>
                    delta > 0
                      ? (i - 1 + photos.length) % photos.length
                      : (i + 1) % photos.length
                  );
                }
              }}
            >
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
                onClick={() => setViewer(true)}
              />
              {photos.length > 1 && (
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 26,
                    color: "#fff",
                    background: "rgba(0,0,0,.35)",
                    borderRadius: 6,
                    cursor: "pointer",
                    padding: "0 8px",
                    lineHeight: 1,
                  }}
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
                  }}
                >
                  ‹
                </span>
              )}
              {photos.length > 1 && (
                <span
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 26,
                    color: "#fff",
                    background: "rgba(0,0,0,.35)",
                    borderRadius: 6,
                    cursor: "pointer",
                    padding: "0 8px",
                    lineHeight: 1,
                  }}
                  aria-label="Next photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex((i) => (i + 1) % photos.length);
                  }}
                >
                  ›
                </span>
              )}
              <span
                style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  fontSize: 11,
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 32,
                  padding: "0 6px",
                }}
                aria-label="Report this photo"
                onClick={() =>
                  setReport({ type: "photo", id: photos[photoIndex].id, label: toilet.venue_name || "" })
                }
              >
                photo {photoIndex + 1}/{photos.length} · <b style={{ color: "var(--red-3)" }}>⚑</b>
              </span>
            </div>
            {photos.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                {photos.map((p, i) => (
                  <div
                    key={p.id}
                    data-photo-idx={i}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 6,
                      overflow: "hidden",
                      cursor: isAuthor ? "grab" : "pointer",
                      border: `2px solid ${
                        i === photoIndex
                          ? "var(--chart-4)"
                          : overIndex === i && dragIdx != null
                            ? "var(--red-3)"
                            : "var(--border-strong)"
                      }`,
                      opacity: dragIdx === i ? 0.5 : 1,
                      touchAction: "none",
                    }}
                    onPointerDown={isAuthor ? onThumbPointerDown(i) : undefined}
                    onPointerMove={isAuthor ? onThumbPointerMove : undefined}
                    onPointerUp={isAuthor ? onThumbPointerUp : undefined}
                    onClick={isAuthor ? undefined : () => setPhotoIndex(i)}
                  >
                    <img
                      src={photoUrl(p.storage_path)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                    />
                  </div>
                ))}
              </div>
            )}
            {isAuthor && photos.length > 1 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Drag to reorder — the first photo shows first.
              </div>
            )}
            {reorderError && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Couldn't save the new order — try again.
              </div>
            )}
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
        <div className="box" style={{ gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 76 }}>Venue</span>
            <span style={{ fontSize: 13 }}>{venueTypesLabel(toilet.venue_types)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 76 }}>Access</span>
            <span style={{ fontSize: 13 }}>{accessTypesLabel(toilet.access_types)}</span>
          </div>
          {toilet.wheelchair !== null && (
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span className="lbl" style={{ flexShrink: 0, width: 76 }}>Wheelchair</span>
              <span style={{ fontSize: 13 }}>
                {toilet.wheelchair === "yes" ? "Yes" : toilet.wheelchair === "no" ? "No" : "Unsure"}
              </span>
            </div>
          )}
          {toilet.supplies.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span className="lbl" style={{ flexShrink: 0, width: 76 }}>Supplies</span>
              <span style={{ fontSize: 13 }}>{toilet.supplies.join(", ")}</span>
            </div>
          )}
          {address && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span className="lbl" style={{ flexShrink: 0, width: 76 }}>Address</span>
              <AddressBlock address={address} />
            </div>
          )}
        </div>

        {profile?.id === toilet.author_id && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn2" style={{ flex: 1 }} onClick={() => navigate(`/t/${toilet.id}/edit`)}>
              Edit
            </button>
            {confirmDelete ? (
              <div className="box" style={{ flex: 1, borderColor: "var(--red-3)", gap: 6 }}>
                <span style={{ fontSize: 12 }}>Delete this listing for good?</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn danger" style={{ flex: 1 }} disabled={deleting} onClick={removeListing}>
                    {deleting ? "…" : "Yes, delete"}
                  </button>
                  <button className="btn2" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn2"
                style={{ flex: 1, color: "var(--red-3)", borderColor: "var(--red-3)" }}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        )}

        {toilet.hint_note && !isReportedLocally("hint", toilet.id) && (
          <div className="note">
            <b>HOW TO FIND</b>
            <br />
            {toilet.hint_note}
            <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {toilet.author?.handle ?? "unknown"} ·{" "}
              <span
                role="button"
                aria-label="Report how-to-find note"
                style={{ cursor: "pointer", color: "var(--red-3)", minHeight: 32, display: "inline-flex", alignItems: "center", padding: "0 4px" }}
                onClick={() => setReport({ type: "hint", id: toilet.id, label: "how-to-find-it note" })}
              >
                ⚑ report
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
            maxLength={CONFIG.wizard.reviewMaxLength}
            style={{ border: "none", resize: "none", fontSize: 13 }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
            {reviewText.length}/{CONFIG.wizard.reviewMaxLength}
          </div>
          <button className="btn" onClick={submitReview} disabled={!reviewText.trim() || posting}>
            {posting ? "Posting…" : `Post review${profile ? ` as ${profile.handle}` : ""}`}
          </button>
        </div>
        {justPosted && <div className="toast">Review posted.</div>}
        {reviews.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No reviews yet — be the first.</div>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="box" style={{ fontSize: 11 }}>
            "{r.body}"{" "}
            <span style={{ color: "var(--text-muted)" }}>
              {r.author?.handle ?? "unknown"} · {new Date(r.created_at).toLocaleString()} ·{" "}
              <span
                role="button"
                aria-label="Report this review"
                style={{ cursor: "pointer", color: "var(--red-3)", minHeight: 32, display: "inline-flex", alignItems: "center", padding: "0 4px" }}
                onClick={() => setReport({ type: "review", id: r.id, label: r.body })}
              >
                ⚑ report
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
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}@${toilet.lat},${toilet.lng}`}
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
          onClose={() => {
            setReport(null);
            setPhotoIndex(0);
          }}
        />
      )}

      {viewer && photos.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            background: "rgba(0,0,0,.94)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              fontSize: 22,
              color: "#fff",
              cursor: "pointer",
              lineHeight: 1,
            }}
            onClick={() => setViewer(false)}
          >
            ×
          </span>
          {photos.length > 1 && (
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 30,
                color: "#fff",
                cursor: "pointer",
                padding: "0 6px",
              }}
              onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
            >
              ‹
            </span>
          )}
          {photos.length > 1 && (
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 30,
                color: "#fff",
                cursor: "pointer",
                padding: "0 6px",
              }}
              onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
            >
              ›
            </span>
          )}
          <img
            src={photoUrl(photos[photoIndex].storage_path)}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain" }}
          />
          <span style={{ fontSize: 12, color: "#fff", fontFamily: "var(--font-mono)" }}>
            {photoIndex + 1}/{photos.length} · {new Date(photos[photoIndex].created_at).toLocaleString()}
          </span>
        </div>
      )}
    </>
  );
}
