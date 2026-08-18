import type { Dispatch, SetStateAction } from "react";
import type { ToiletDraft } from "./types";

// Wayfinding facts only — anything about payment or asking someone for access
// already belongs to the Access step, not here.
const HINT_CHIPS = [
  "Round the back",
  "Behind the building",
  "Upstairs",
  "Downstairs",
  "No sign",
  "Easy to miss",
  "Near the entrance",
];

export function StepHint({
  draft,
  onChange,
  onSubmit,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onSubmit: () => void;
}) {
  function toggleChip(c: string) {
    onChange((prev) => ({
      ...prev,
      hintChips: prev.hintChips.includes(c)
        ? prev.hintChips.filter((x) => x !== c)
        : [...prev.hintChips, c],
    }));
  }

  return (
    <div className="screen-body">
      <div className="stepper">
        <i className="done" />
        <i className="done" />
        <i className="done" />
        <i className="done" />
        <i className="done" />
      </div>

      <div className="lbl">Bonus · finding it</div>
      <div className="ann">
        This becomes the pinned starting hint everyone sees first. If someone else finds a better way
        in, they add it as a review on the listing — every review stays visible with its own name and
        date, so extra input just adds coverage, it never overwrites yours.
      </div>

      <div className="lbl">Tap what applies (pick any, or none)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {HINT_CHIPS.map((c) => (
          <span key={c} className={`chip ${draft.hintChips.includes(c) ? "on" : ""}`} onClick={() => toggleChip(c)}>
            {c}
          </span>
        ))}
      </div>

      <div className="lbl">Directions in your own words (optional)</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -6 }}>
        Whatever you'd tell a friend standing where you are now.
      </div>
      <textarea
        className="note"
        style={{ minHeight: 82, border: "1.5px solid var(--border-note)", resize: "none" }}
        value={draft.hintNote}
        onChange={(e) => onChange((prev) => ({ ...prev, hintNote: e.target.value }))}
        placeholder="Behind the Amazon café. Ask the cashier for the key, ฿5 coin."
      />

      <button className="btn" style={{ marginTop: "auto" }} onClick={onSubmit}>
        Post this toilet
      </button>
      <button className="ghost" onClick={onSubmit}>
        Skip — post without a hint
      </button>
    </div>
  );
}
