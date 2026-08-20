import { useState } from "react";
import { CONFIG } from "../../lib/config";
import type { FloorEntry } from "./types";
import { StepDots } from "./StepDots";

const HINT_CHIPS = CONFIG.wizard.hintChips;

export function StepReview({
  entry,
  onChangeEntry,
  onSubmit,
  stepIndex = 5,
  stepTotal = 5,
  heading,
  submitLabel = "Post this toilet",
  skipLabel = "Skip — post without a review",
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
  const [hintOpen, setHintOpen] = useState(false);

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
        Tell the next person what it's like. Your review becomes the first one on the listing.
      </div>

      <div className="lbl">Your review (optional)</div>
      <textarea
        className="note"
        style={{ minHeight: 96, border: "1.5px solid var(--border-note)", resize: "none" }}
        value={entry.review}
        maxLength={CONFIG.wizard.reviewMaxLength}
        onChange={(e) => onChangeEntry((prev) => ({ ...prev, review: e.target.value }))}
        placeholder="Clean and stocked, but the lock was broken…"
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
        {entry.review.length}/{CONFIG.wizard.reviewMaxLength}
      </div>

      <div
        style={{ fontSize: 12, color: "var(--chart-4)", cursor: "pointer" }}
        onClick={() => setHintOpen((o) => !o)}
      >
        {hintOpen ? "▾ Hide" : "▸ Add directions"} — how to find it (optional)
      </div>

      {hintOpen && (
        <>
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
          <textarea
            className="note"
            style={{ minHeight: 82, border: "1.5px solid var(--border-note)", resize: "none" }}
            value={entry.hintNote}
            maxLength={CONFIG.wizard.hintNoteMaxLength}
            onChange={(e) => onChangeEntry((prev) => ({ ...prev, hintNote: e.target.value }))}
            placeholder="Behind the Amazon café. Ask the cashier for the key, ฿5 coin."
          />
        </>
      )}

      <button className="btn" style={{ marginTop: "auto" }} onClick={onSubmit}>
        {submitLabel}
      </button>
      <button className="ghost" onClick={onSubmit}>
        {skipLabel}
      </button>
    </div>
  );
}
