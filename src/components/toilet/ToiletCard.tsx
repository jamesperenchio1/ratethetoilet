import { useNavigate } from "react-router-dom";
import type { Toilet } from "../../lib/types";
import { ScoreBadge } from "./ScoreBadge";
import { accessTypesLabel, distanceLabel, venueTypesLabel } from "../../lib/labels";
import { photoUrl } from "../../lib/api";

export function ToiletCard({
  toilet,
  distanceMeters,
}: {
  toilet: Toilet;
  distanceMeters?: number;
}) {
  const navigate = useNavigate();
  const title = toilet.venue_name || venueTypesLabel(toilet.venue_types) || "Toilet";
  const thumb = toilet.photo_storage_path ? photoUrl(toilet.photo_storage_path) : null;
  const addressLine = [toilet.address_house_number, toilet.address_road, toilet.address_suburb]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      className="box toilet-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/t/${toilet.id}`)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(`/t/${toilet.id}`)}
      style={{ cursor: "pointer", flexDirection: "row", gap: 10, alignItems: "center" }}
    >
      {thumb && (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="toilet-card-thumb"
          style={{
            width: 52,
            height: 52,
            flex: "0 0 auto",
            objectFit: "cover",
            borderRadius: 6,
            border: "1.5px solid var(--border-strong)",
            background: "var(--surface-note)",
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {toilet.floor ? `${title} · Floor ${toilet.floor}` : title}
          </b>
          <ScoreBadge score={toilet.overall_score} size={18} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "2px 6px" }}>
          <span>{venueTypesLabel(toilet.venue_types)}</span>
          {distanceMeters != null && <span>· {distanceLabel(distanceMeters)}</span>}
          <span>· {accessTypesLabel(toilet.access_types)}</span>
          {addressLine && (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              · {addressLine}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
