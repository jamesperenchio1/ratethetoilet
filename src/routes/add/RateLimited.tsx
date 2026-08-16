import { useNavigate } from "react-router-dom";

export function RateLimited({ retryAt }: { retryAt: string | null }) {
  const navigate = useNavigate();
  const timeLabel = retryAt
    ? new Date(retryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "soon";

  return (
    <div className="screen-body">
      <div className="note">
        <b>Slow down a moment — three toilets an hour.</b>
        <br />
        You can post again at <span className="num">{timeLabel}</span>.
      </div>
      <div className="box dashed">
        <b>Draft saved</b>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Photo, pin and scores are kept. Nothing to redo.
        </span>
      </div>
      <button className="btn2" onClick={() => navigate("/")}>
        Write a review instead
      </button>
      <button className="ghost" style={{ marginTop: "auto" }} onClick={() => navigate("/")}>
        Back to the map
      </button>
    </div>
  );
}
