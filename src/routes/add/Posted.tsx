import { useNavigate } from "react-router-dom";
import { ScoreBadge } from "../../components/toilet/ScoreBadge";
import { photoUrl } from "../../lib/api";
import type { Toilet } from "../../lib/types";

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
      <div className="box" style={{ borderColor: "var(--chart-4)", alignItems: "center", gap: 6 }}>
        <ScoreBadge score={toilet.overall_score} size={24} />
        <b>{toilet.venue_name || "Your toilet"}</b>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Live now</span>
      </div>

      {firstPhotoPath && (
        <img
          src={photoUrl(firstPhotoPath)}
          alt=""
          style={{ height: 130, objectFit: "cover", borderRadius: 6, border: "1.5px solid var(--border-strong)" }}
        />
      )}

      <div className="box" style={{ fontSize: 11 }}>
        Posted as <b>{handle}</b>{" "}
        <span style={{ color: "var(--chart-4)", cursor: "pointer" }} onClick={() => navigate("/settings")}>
          · change
        </span>
      </div>

      <button className="btn2" onClick={() => navigate(`/t/${toilet.id}`)}>
        See the listing
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
