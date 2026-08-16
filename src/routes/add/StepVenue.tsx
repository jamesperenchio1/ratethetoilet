import type { Dispatch, SetStateAction } from "react";
import type { AccessType, VenueType } from "../../lib/types";
import { ACCESS_LABELS, VENUE_LABELS } from "../../lib/labels";
import type { ToiletDraft } from "./types";

const VENUES = Object.keys(VENUE_LABELS) as VenueType[];
const ACCESSES = Object.keys(ACCESS_LABELS) as AccessType[];
const SUPPLIES = ["Paper", "Hose", "Bring your own", "Not sure"];

export function StepVenue({
  draft,
  onChange,
  onNext,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onNext: () => void;
}) {
  function toggleSupply(s: string) {
    onChange((prev) => ({
      ...prev,
      supplies: prev.supplies.includes(s)
        ? prev.supplies.filter((x) => x !== s)
        : [...prev.supplies, s],
    }));
  }

  return (
    <div className="screen-body">
      <div className="stepper">
        <i className="done" />
        <i className="done" />
        <i className="done" />
        <i />
        <i />
      </div>

      <div className="lbl">Venue</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {VENUES.map((v) => (
          <span
            key={v}
            className={`btn2 ${draft.venueType === v ? "selected" : ""}`}
            onClick={() => onChange((prev) => ({ ...prev, venueType: v }))}
          >
            {VENUE_LABELS[v]}
          </span>
        ))}
      </div>

      <div className="lbl">Access</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ACCESSES.map((a) => (
          <span
            key={a}
            className={`btn2 ${draft.accessType === a ? "selected" : ""}`}
            onClick={() => onChange((prev) => ({ ...prev, accessType: a }))}
          >
            {ACCESS_LABELS[a]}
          </span>
        ))}
      </div>

      <div className="lbl">Supplies</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SUPPLIES.map((s) => (
          <span
            key={s}
            className={`chip ${draft.supplies.includes(s) ? "on" : ""}`}
            onClick={() => toggleSupply(s)}
          >
            {s}
          </span>
        ))}
      </div>

      <button
        className="btn"
        style={{ marginTop: "auto" }}
        disabled={!draft.venueType || !draft.accessType}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
