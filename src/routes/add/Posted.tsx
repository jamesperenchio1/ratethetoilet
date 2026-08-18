import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScoreBadge } from "../../components/toilet/ScoreBadge";
import { useIdentity } from "../../components/IdentityGateProvider";
import { photoUrl } from "../../lib/api";
import { ExternalIcon, PlusIcon } from "../../components/layout/NavIcons";
import type { Toilet } from "../../lib/types";

export function Posted({
  toilet,
  handle,
  photoPaths,
  failedFloors = [],
  totalFloors = 0,
  onAddAnother,
}: {
  toilet: Toilet;
  handle: string;
  photoPaths: string[];
  failedFloors?: string[];
  totalFloors?: number;
  onAddAnother: () => void;
}) {
  const navigate = useNavigate();
  const { isGuest, sendKeepNameLink } = useIdentity();
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  return (
    <div className="screen-body">
      <div className="ann">Live now — here's exactly what other people will see.</div>

      {photoPaths.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {photoPaths.map((path) => (
            <img
              key={path}
              src={photoUrl(path)}
              alt=""
              style={{
                height: 130,
                width: 130,
                objectFit: "cover",
                borderRadius: 6,
                border: "1.5px solid var(--border-strong)",
                flex: "0 0 auto",
              }}
            />
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <b style={{ fontSize: 15 }}>{toilet.venue_name || "Your toilet"}</b>
        <ScoreBadge score={toilet.overall_score} size={24} />
      </div>

      {totalFloors > 1 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {failedFloors.length === 0
            ? `Posted ${totalFloors} floors as separate listings.`
            : `Posted ${Math.max(totalFloors - failedFloors.length, 1)} of ${totalFloors} floors.`}
        </div>
      )}

      <div className="box" style={{ fontSize: 11 }}>
        Posted as <b>{handle}</b>{" "}
        <span style={{ color: "var(--chart-4)", cursor: "pointer" }} onClick={() => navigate("/settings")}>
          · change
        </span>
      </div>

      {failedFloors.length > 0 && (
        <div className="note" style={{ fontSize: 11, color: "var(--text-danger)" }}>
          {failedFloors
            .map((f) => (f === "primary" ? "the main restroom" : `floor ${f}`))
            .join(failedFloors.length === 1 ? "" : ", ")}
          {failedFloors.length === 1 ? " didn't save" : " didn't save"} — you can add
          {failedFloors.length === 1 ? " it" : " them"} separately later.
        </div>
      )}

      {isGuest && !dismissed && (
        <div className="note" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {saveState === "sent" ? (
            <span>
              Check your email to keep <b>{handle}</b> on other devices.
            </span>
          ) : (
            <>
              <span>
                Keep <b>{handle}</b> across devices? Optional — no password needed.
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="box"
                  style={{ flex: 1, padding: "8px 9px", fontSize: 12 }}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  className="btn2"
                  style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}
                  disabled={!email.trim() || saveState === "sending"}
                  onClick={async () => {
                    setSaveState("sending");
                    try {
                      await sendKeepNameLink(email.trim());
                      setSaveState("sent");
                    } catch {
                      setSaveState("error");
                    }
                  }}
                >
                  Save
                </button>
              </div>
              {saveState === "error" && (
                <span style={{ color: "var(--text-danger)" }}>Couldn't send that — try again.</span>
              )}
              <span style={{ color: "var(--text-muted)", cursor: "pointer" }} onClick={() => setDismissed(true)}>
                Not now
              </span>
            </>
          )}
        </div>
      )}

      <button className="btn2" onClick={() => navigate(`/t/${toilet.id}`)}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <ExternalIcon /> Open the full listing
        </span>
      </button>
      <button className="btn" style={{ marginTop: "auto" }} onClick={onAddAnother}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <PlusIcon /> Add another nearby
        </span>
      </button>
      <button
        className="ghost"
        onClick={() => navigate("/", { state: { center: { lat: toilet.lat, lng: toilet.lng } } })}
      >
        Back to the map
      </button>
    </div>
  );
}
