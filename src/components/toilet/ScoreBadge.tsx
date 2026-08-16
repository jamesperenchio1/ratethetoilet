import { scoreColor } from "../../lib/score";

export function ScoreBadge({
  score,
  size = 16,
}: {
  score: number | null | undefined;
  size?: number;
}) {
  return (
    <span
      className="num"
      style={{ color: scoreColor(score), fontSize: size }}
    >
      {score == null ? "—" : score}
    </span>
  );
}
