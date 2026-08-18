import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "../components/layout/Sheet";
import { useIdentity } from "../components/IdentityGateProvider";
import { myContributions, type ReviewWithToilet } from "../lib/api";
import { VENUE_LABELS } from "../lib/labels";
import { CONFIG } from "../lib/config";
import { ScoreBadge } from "../components/toilet/ScoreBadge";
import type { Toilet } from "../lib/types";

const NUDGE_DISMISSED_KEY = CONFIG.storage.nudgeKey;

export function You() {
  const navigate = useNavigate();
  const { profile, isGuest, withIdentity } = useIdentity();
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [reviews, setReviews] = useState<ReviewWithToilet[]>([]);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (!profile) return;
    myContributions(profile.id).then(({ toilets, reviews }) => {
      setToilets(toilets);
      setReviews(reviews);
      const total = toilets.length + reviews.length;
      const dismissed = localStorage.getItem(NUDGE_DISMISSED_KEY) === "1";
      setShowNudge(total >= 3 && isGuest && !dismissed);
    });
  }, [profile, isGuest]);

  async function startAsGuest() {
    await withIdentity(async () => {});
  }

  if (!profile) {
    return (
      <>
        <div className="topbar">
          <span className="title">You</span>
        </div>
        <div className="center-empty">
          <span>You haven't posted anything yet.</span>
          <button className="btn" style={{ width: "auto", padding: "11px 20px" }} onClick={startAsGuest}>
            Get a handle
          </button>
        </div>
      </>
    );
  }

  const total = toilets.length + reviews.length;

  return (
    <>
      <div className="topbar">
        <span className="title">You</span>
        <span style={{ fontSize: 15, cursor: "pointer" }} onClick={() => navigate("/settings")}>
          ⚙
        </span>
      </div>
      <div className="screen-body">
        <div className="box" style={{ alignItems: "center", gap: 5 }}>
          <span className="num" style={{ fontSize: 17 }}>
            {profile.handle}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {isGuest ? "Guest · this device only" : "Handle saved"}
          </span>
          {isGuest && (
            <span
              className="chip"
              style={{ borderColor: "var(--chart-4)", color: "var(--chart-4)" }}
              onClick={() => navigate("/you/save-handle")}
            >
              Save your handle
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div className="box" style={{ flex: 1, alignItems: "center" }}>
            <span className="num" style={{ fontSize: 17 }}>
              {toilets.length}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>toilets</span>
          </div>
          <div className="box" style={{ flex: 1, alignItems: "center" }}>
            <span className="num" style={{ fontSize: 17 }}>
              {reviews.length}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>reviews</span>
          </div>
        </div>

        <div className="lbl">Your toilets</div>
        {toilets.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nothing yet.</div>
        )}
        {toilets.map((t) => (
          <div
            key={t.id}
            className="box"
            style={{ flexDirection: "row", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => navigate(`/t/${t.id}`)}
          >
            <span>{t.venue_name || VENUE_LABELS[t.venue_type]}</span>
            <ScoreBadge score={t.overall_score} />
          </div>
        ))}

        <div className="lbl">Your reviews</div>
        {reviews.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nothing yet.</div>
        )}
        {reviews.map((r) => (
          <div
            key={r.id}
            className="box"
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/t/${r.toilet_id}`)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
              <span>{r.toilet?.venue_name || (r.toilet ? VENUE_LABELS[r.toilet.venue_type] : "Deleted listing")}</span>
              <span>{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <span>"{r.body}"</span>
          </div>
        ))}
      </div>

      {showNudge && total >= 3 && (
        <Sheet
          onDismiss={() => {
            localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
            setShowNudge(false);
          }}
        >
          <b style={{ fontSize: 15 }}>Your {total} toilets stay up no matter what</b>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--text-secondary)" }}>
            They belong to <b>{profile.handle}</b> and that never changes. But the name lives on
            this phone — clear your browser or switch device and you'd start again as a new name,
            unable to post or edit as this one.
          </div>
          <button className="btn" onClick={() => navigate("/you/save-handle")}>
            Keep this name
          </button>
          <button
            className="ghost"
            onClick={() => {
              localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
              setShowNudge(false);
            }}
          >
            Not now — don't ask again
          </button>
        </Sheet>
      )}
    </>
  );
}
