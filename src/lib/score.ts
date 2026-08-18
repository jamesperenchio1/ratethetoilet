import { CONFIG } from "./config";

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--ink-4)";
  const { great, good, ok } = CONFIG.score.color;
  if (score >= great) return "var(--score-great)";
  if (score >= good) return "var(--score-good)";
  if (score >= ok) return "var(--score-ok)";
  return "var(--score-poor)";
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return "Not rated";
  const { spotless, clean, usable, rough } = CONFIG.score.label;
  if (score >= spotless) return "Spotless";
  if (score >= clean) return "Clean";
  if (score >= usable) return "Usable";
  if (score >= rough) return "Rough";
  return "Avoid";
}

/** Overall score is a simple mean of the rated sub-scores; unrated ones are excluded. */
export function overallScore(
  cleanliness: number | null,
  smell: number | null,
  privacy: number | null
): number | null {
  const vals = [cleanliness, smell, privacy].filter(
    (v): v is number => v != null
  );
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
