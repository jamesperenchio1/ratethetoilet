import { overallScore, scoreColor, scoreLabel } from "../../lib/score";
import { CONFIG } from "../../lib/config";
import type { TriState } from "../../lib/types";
import type { FloorEntry } from "./types";
import { StepDots } from "./StepDots";

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
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 44 }}>{"avoid"}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 44, textAlign: "right" }}>
          {"great"}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {value} · {scoreLabel(value)}
      </div>
    </>
  );
}

export function StepScores({
  entry,
  onChangeEntry,
  onNext,
  stepIndex = 4,
  stepTotal = 5,
  heading,
}: {
  entry: FloorEntry;
  onChangeEntry: (updater: (prev: FloorEntry) => FloorEntry) => void;
  onNext: () => void;
  stepIndex?: number;
  stepTotal?: number;
  heading?: string;
}) {
  const overall = overallScore(entry.cleanliness, entry.smell, entry.privacy);

  return (
    <div className="screen-body">
      <StepDots total={stepTotal} done={stepIndex} />
      {heading && <b style={{ fontSize: 14 }}>{heading}</b>}

      <div className="box" style={{ alignItems: "center", gap: 8 }}>
        <span className="lbl">Overall</span>
        <span className="num" style={{ fontSize: 28, color: scoreColor(overall) }}>
          {overall ?? "—"}
        </span>
        <span style={{ fontSize: 12 }}>{scoreLabel(overall)}</span>
      </div>

      <div className="ann">Sliders start at {CONFIG.wizard.defaultScore} — drag toward great or toward avoid.</div>

      <Slider
        label="Cleanliness"
        value={entry.cleanliness}
        onChange={(v) => onChangeEntry((prev) => ({ ...prev, cleanliness: v }))}
      />
      <Slider
        label="Smell"
        value={entry.smell}
        onChange={(v) => onChangeEntry((prev) => ({ ...prev, smell: v }))}
      />
      <Slider
        label="Privacy · lock & door"
        value={entry.privacy}
        onChange={(v) => onChangeEntry((prev) => ({ ...prev, privacy: v }))}
      />

      <div className="lbl">Wheelchair</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["yes", "no", "unsure"] as TriState[]).map((w) => (
          <span
            key={w}
            className={`chip ${entry.wheelchair === w ? "on" : ""}`}
            onClick={() => onChangeEntry((prev) => ({ ...prev, wheelchair: w }))}
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
