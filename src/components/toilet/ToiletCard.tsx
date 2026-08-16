import { useNavigate } from "react-router-dom";
import type { Toilet } from "../../lib/types";
import { ScoreBadge } from "./ScoreBadge";
import { ACCESS_LABELS, distanceLabel, VENUE_LABELS } from "../../lib/labels";
import { scoreLabel } from "../../lib/score";

export function ToiletCard({
  toilet,
  distanceMeters,
}: {
  toilet: Toilet;
  distanceMeters?: number;
}) {
  const navigate = useNavigate();
  return (
    <div className="box" onClick={() => navigate(`/t/${toilet.id}`)} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <b>{toilet.venue_name || VENUE_LABELS[toilet.venue_type]}</b>
        <ScoreBadge score={toilet.overall_score} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {VENUE_LABELS[toilet.venue_type]} · {ACCESS_LABELS[toilet.access_type]}
        {distanceMeters != null && <> · {distanceLabel(distanceMeters)}</>} ·{" "}
        {scoreLabel(toilet.overall_score)}
      </div>
    </div>
  );
}
