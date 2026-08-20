import { describe, expect, it } from "vitest";
import { overallScore, scoreLabel } from "./score";

describe("overallScore", () => {
  it("returns null when nothing is rated", () => {
    expect(overallScore(null, null, null)).toBeNull();
  });

  it("averages only the rated sub-scores", () => {
    expect(overallScore(80, null, 60)).toBe(70);
  });

  it("rounds to the nearest integer", () => {
    expect(overallScore(80, 79, null)).toBe(80);
  });
});

describe("scoreLabel", () => {
  it("labels an unrated score", () => {
    expect(scoreLabel(null)).toBe("Not rated");
  });

  it("labels a high score as Spotless", () => {
    expect(scoreLabel(95)).toBe("Spotless");
  });

  it("labels a low score as Avoid", () => {
    expect(scoreLabel(10)).toBe("Avoid");
  });
});
