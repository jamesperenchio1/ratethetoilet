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
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <div className="lbl">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 44 }}>{scoreLabel(0)}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 44, textAlign: "right" }}>
          {scoreLabel(100)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {value} · {scoreLabel(value)}
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

      <div className="ann">Sliders start at 50 — drag toward great or toward avoid.</div>

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
