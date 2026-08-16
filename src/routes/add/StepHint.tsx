import type { Dispatch, SetStateAction } from "react";
import type { ToiletDraft } from "./types";

const HINT_CHIPS = ["Ask staff", "Behind the building", "Upstairs", "No sign", "Round the back"];

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

      <div className="ann">Skip it if you're not sure — someone else can add it later.</div>

      <div className="lbl">Tap what applies</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {HINT_CHIPS.map((c) => (
          <span key={c} className={`chip ${draft.hintChips.includes(c) ? "on" : ""}`} onClick={() => toggleChip(c)}>
            {c}
          </span>
        ))}
      </div>

      <div className="lbl">Add a line (optional)</div>
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
