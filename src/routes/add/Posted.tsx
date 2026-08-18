import { useNavigate } from "react-router-dom";
import { ScoreBadge } from "../../components/toilet/ScoreBadge";
import { photoUrl } from "../../lib/api";
import { ACCESS_LABELS, VENUE_LABELS } from "../../lib/labels";
import { scoreColor } from "../../lib/score";
import type { Toilet } from "../../lib/types";

function bar(label: string, value: number | null) {
  return (
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
}

export function Posted({
  toilet,
  handle,
  firstPhotoPath,
  onAddAnother,
}: {
  toilet: Toilet;
  handle: string;
  firstPhotoPath: string | null;
  onAddAnother: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="screen-body">
      <div className="ann">Live now — here's exactly what other people will see.</div>

      {firstPhotoPath && (
        <img
          src={photoUrl(firstPhotoPath)}
          alt=""
          style={{ height: 150, objectFit: "cover", borderRadius: 6, border: "1.5px solid var(--border-strong)" }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <b style={{ fontSize: 15 }}>{toilet.venue_name || VENUE_LABELS[toilet.venue_type]}</b>
        <ScoreBadge score={toilet.overall_score} size={24} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {VENUE_LABELS[toilet.venue_type]} · {ACCESS_LABELS[toilet.access_type]}
        {toilet.wheelchair === "yes" && " · Wheelchair"}
        {toilet.supplies.length > 0 && ` · ${toilet.supplies.join(", ")}`}
      </div>

      {(toilet.hint_note || toilet.hint_chips.length > 0) && (
        <div className="note">
          <b>FINDING IT</b>
          <br />
          {toilet.hint_chips.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
              {toilet.hint_chips.map((c) => (
                <span key={c} className="chip on">
                  {c}
                </span>
              ))}
            </div>
          )}
          {toilet.hint_note}
        </div>
      )}

      <div className="box">
        {bar("Cleanliness", toilet.cleanliness)}
        {bar("Smell", toilet.smell)}
        {bar("Privacy", toilet.privacy)}
      </div>

      <div className="box" style={{ fontSize: 11 }}>
        Posted as <b>{handle}</b>{" "}
        <span style={{ color: "var(--chart-4)", cursor: "pointer" }} onClick={() => navigate("/settings")}>
          · change
        </span>
      </div>

      <button className="btn2" onClick={() => navigate(`/t/${toilet.id}`)}>
        Open the full listing
      </button>
      <button className="btn" style={{ marginTop: "auto" }} onClick={onAddAnother}>
        Add another nearby
      </button>
      <button className="ghost" onClick={() => navigate("/")}>
        Back to the map
      </button>
    </div>
  );
}
