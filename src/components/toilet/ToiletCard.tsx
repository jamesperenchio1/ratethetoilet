import { useNavigate } from "react-router-dom";
import type { Toilet } from "../../lib/types";
import { ScoreBadge } from "./ScoreBadge";
import { accessTypesLabel, distanceLabel, venueTypesLabel } from "../../lib/labels";
import { scoreLabel } from "../../lib/score";

export function ToiletCard({
  toilet,
  distanceMeters,
}: {
  toilet: Toilet;
  distanceMeters?: number;
}) {
  const navigate = useNavigate();
  const title = toilet.venue_name || venueTypesLabel(toilet.venue_types) || "Toilet";
  return (
    <div className="box" onClick={() => navigate(`/t/${toilet.id}`)} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <b>{toilet.floor ? `${title} · Floor ${toilet.floor}` : title}</b>
        <ScoreBadge score={toilet.overall_score} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {venueTypesLabel(toilet.venue_types)} · {accessTypesLabel(toilet.access_types)}
        {distanceMeters != null && <> · {distanceLabel(distanceMeters)}</>} ·{" "}
        {scoreLabel(toilet.overall_score)}
      </div>
    </div>
  );
}
