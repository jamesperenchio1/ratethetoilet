import type { Dispatch, SetStateAction } from "react";
import type { ToiletDraft } from "./types";
import { overallScore, scoreColor, scoreLabel } from "../../lib/score";
import type { TriState } from "../../lib/types";

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <>
      <div className="lbl">{label}</div>
      <input
        type="range"
        min={0}
        max={100}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {value == null ? "Not rated — leave it if you didn't check" : `${value} · ${scoreLabel(value)}`}
      </div>
    </>
  );
}

export function StepScores({
  draft,
  onChange,
  onNext,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onNext: () => void;
}) {
  const overall = overallScore(draft.cleanliness, draft.smell, draft.privacy);

  return (
    <div className="screen-body">
      <div className="stepper">
        <i className="done" />
        <i className="done" />
        <i className="done" />
        <i className="done" />
        <i />
      </div>

      <div className="box" style={{ alignItems: "center", gap: 8 }}>
        <span className="lbl">Overall</span>
        <span className="num" style={{ fontSize: 28, color: scoreColor(overall) }}>
          {overall ?? "—"}
        </span>
        <span style={{ fontSize: 12 }}>{scoreLabel(overall)}</span>
      </div>

      <Slider
        label="Cleanliness"
        value={draft.cleanliness}
        onChange={(v) => onChange((prev) => ({ ...prev, cleanliness: v }))}
      />
      <Slider
        label="Smell"
        value={draft.smell}
        onChange={(v) => onChange((prev) => ({ ...prev, smell: v }))}
      />
      <Slider
        label="Privacy · lock & door"
        value={draft.privacy}
        onChange={(v) => onChange((prev) => ({ ...prev, privacy: v }))}
      />

      <div className="lbl">Wheelchair</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["yes", "no", "unsure"] as TriState[]).map((w) => (
          <span
            key={w}
            className={`chip ${draft.wheelchair === w ? "on" : ""}`}
            onClick={() => onChange((prev) => ({ ...prev, wheelchair: w }))}
          >
            {w[0].toUpperCase() + w.slice(1)}
          </span>
        ))}
      </div>

      <button className="btn" style={{ marginTop: "auto" }} onClick={onNext}>
        Next
      </button>
    </div>
  );
}
