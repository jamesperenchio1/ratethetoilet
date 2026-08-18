// Breakpoints match scoreLabel's exactly, so the color and the word under a
// slider always describe the same tier.
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--ink-4)";
  if (score >= 90) return "var(--score-great)";
  if (score >= 75) return "var(--score-good)";
  if (score >= 60) return "var(--score-ok)";
  if (score >= 40) return "var(--score-poor)";
  return "var(--score-bad)";
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return "Not rated";
  if (score >= 90) return "Spotless";
  if (score >= 75) return "Clean";
  if (score >= 60) return "Usable";
  if (score >= 40) return "Rough";
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
