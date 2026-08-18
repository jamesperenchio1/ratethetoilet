import { CONFIG } from "../../lib/config";
import type { FloorEntry } from "./types";
import { StepDots } from "./StepDots";

// Wayfinding facts only — anything about payment or asking someone for access
// already belongs to the Access step, not here.
const HINT_CHIPS = CONFIG.wizard.hintChips;

export function StepHint({
  entry,
  onChangeEntry,
  onSubmit,
  stepIndex = 5,
  stepTotal = 5,
  heading,
  submitLabel = "Post this toilet",
  skipLabel = "Skip — post without a hint",
}: {
  entry: FloorEntry;
  onChangeEntry: (updater: (prev: FloorEntry) => FloorEntry) => void;
  onSubmit: () => void;
  stepIndex?: number;
  stepTotal?: number;
  heading?: string;
  submitLabel?: string;
  skipLabel?: string;
}) {
  function toggleChip(c: string) {
    onChangeEntry((prev) => ({
      ...prev,
      hintChips: prev.hintChips.includes(c)
        ? prev.hintChips.filter((x) => x !== c)
        : [...prev.hintChips, c],
    }));
  }

  return (
    <div className="screen-body">
      <StepDots total={stepTotal} done={stepIndex} />
      {heading && <b style={{ fontSize: 14 }}>{heading}</b>}

      <div className="ann">
        This becomes the pinned starting hint everyone sees first. If someone else finds a better
        way in, they add it as a review on the listing — every review stays visible with its own
        name and date, so extra input just adds coverage, it never overwrites yours.
      </div>

      <div className="lbl">Tap what applies (pick any, or none)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {HINT_CHIPS.map((c) => (
          <span
            key={c}
            className={`chip ${entry.hintChips.includes(c) ? "on" : ""}`}
            onClick={() => toggleChip(c)}
          >
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
        value={entry.hintNote}
        onChange={(e) => onChangeEntry((prev) => ({ ...prev, hintNote: e.target.value }))}
        placeholder="Behind the Amazon café. Ask the cashier for the key, ฿5 coin."
      />

      <button className="btn" style={{ marginTop: "auto" }} onClick={onSubmit}>
        {submitLabel}
      </button>
      <button className="ghost" onClick={onSubmit}>
        {skipLabel}
      </button>
    </div>
  );
}
