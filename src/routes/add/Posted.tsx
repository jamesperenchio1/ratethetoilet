import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScoreBadge } from "../../components/toilet/ScoreBadge";
import { useIdentity } from "../../components/IdentityGateProvider";
import { photoUrl, deleteOwnToilet } from "../../lib/api";
import { ExternalIcon, PlusIcon } from "../../components/layout/NavIcons";
import { accessTypesLabel, venueTypesLabel } from "../../lib/labels";
import type { Toilet } from "../../lib/types";

function addressLines(t: Toilet): string {
  return [
    [t.address_house_number, t.address_road].filter(Boolean).join(" "),
    t.address_suburb,
    t.address_city,
    t.address_postcode,
    t.address_country,
  ]
    .filter((p) => p && p.trim())
    .join("\n");
}

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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function removeListing() {
    if (removing) return;
    setRemoving(true);
    try {
      await deleteOwnToilet(toilet.id);
      navigate("/you");
    } catch {
      setRemoving(false);
    }
  }

  const address = addressLines(toilet);
  const scoreRows: [string, number | null | undefined][] = [
    ["Cleanliness", toilet.cleanliness],
    ["Smell", toilet.smell],
    ["Privacy", toilet.privacy],
  ];

  return (
    <div className="screen-body">
      <div className="ann">Live now — here's exactly what other people will see.</div>

      {photoPaths.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {photoPaths.map((path) => (
            <img
              key={path}
              src={photoUrl(path)}
              alt=""
              style={{
                width: "100%",
                height: "auto",
                objectFit: "contain",
                borderRadius: 8,
                border: "1.5px solid var(--border-strong)",
                display: "block",
                background: "var(--surface-note)",
              }}
            />
          ))}
        </div>
      )}

      <div
        className="box"
        style={{ flexDirection: "column", alignItems: "stretch", gap: 8, borderStyle: "dashed" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <b style={{ fontSize: 16 }}>{toilet.venue_name || "Your toilet"}</b>
          <ScoreBadge score={toilet.overall_score} size={26} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Posted {new Date(toilet.created_at).toLocaleString()}
        </div>
        {address && <div style={{ fontSize: 12, whiteSpace: "pre-line", lineHeight: 1.45 }}>{address}</div>}
        {toilet.venue_types?.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 90 }}>Type</span>
            <span style={{ fontSize: 13 }}>{venueTypesLabel(toilet.venue_types)}</span>
          </div>
        )}
        {toilet.access_types?.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 90 }}>Access</span>
            <span style={{ fontSize: 13 }}>{accessTypesLabel(toilet.access_types)}</span>
          </div>
        )}
        {toilet.supplies?.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 90 }}>Supplies</span>
            <span style={{ fontSize: 13 }}>{toilet.supplies.join(", ")}</span>
          </div>
        )}
        {toilet.wheelchair && (
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 90 }}>Wheelchair</span>
            <span style={{ fontSize: 13 }}>{toilet.wheelchair}</span>
          </div>
        )}
        {scoreRows.map(([label, value]) =>
          value == null ? null : (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="lbl" style={{ flexShrink: 0, width: 90 }}>
                {label}
              </span>
              <span style={{ fontSize: 13 }}>{value}</span>
            </div>
          )
        )}
        {toilet.hint_chips?.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span className="lbl" style={{ flexShrink: 0, width: 90 }}>Hints</span>
            <span style={{ fontSize: 13 }}>{toilet.hint_chips.join(", ")}</span>
          </div>
        )}
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
                Keep <b>{handle}</b> across devices? Optional.
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

      {confirmRemove ? (
        <div className="box" style={{ borderColor: "var(--red-3)", gap: 6 }}>
          <span style={{ fontSize: 12 }}>Remove this listing for good?</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn danger" style={{ flex: 1 }} disabled={removing} onClick={removeListing}>
              {removing ? "…" : "Yes, remove"}
            </button>
            <button className="btn2" style={{ flex: 1 }} onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn2"
          style={{ color: "var(--red-3)", borderColor: "var(--red-3)" }}
          onClick={() => setConfirmRemove(true)}
        >
          Remove this listing
        </button>
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
