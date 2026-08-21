import { describe, expect, it } from "vitest";
import { throttledProgress } from "./throttledProgress";

describe("throttledProgress", () => {
  it("only forwards a call when the fraction crosses a new step", () => {
    const calls: number[] = [];
    const wrapped = throttledProgress((f) => calls.push(f), 0.05);

    wrapped(0);
    wrapped(0.01);
    wrapped(0.02);
    wrapped(0.049);
    wrapped(0.05);
    wrapped(0.07);
    wrapped(0.1);

    // Gating uses the stepped value, but the raw fraction is what's forwarded
    // (so the displayed percentage is never rounded away from reality).
    expect(calls).toEqual([0, 0.049, 0.1]);
  });

  it("always forwards 1 as a distinct final step", () => {
    const calls: number[] = [];
    const wrapped = throttledProgress((f) => calls.push(f), 0.05);

    wrapped(0.97);
    wrapped(1);

    expect(calls[calls.length - 1]).toBe(1);
  });

  it("does not re-fire for the exact same fraction reported twice", () => {
    const calls: number[] = [];
    const wrapped = throttledProgress((f) => calls.push(f));

    wrapped(0.5);
    wrapped(0.5);
    wrapped(0.5);

    expect(calls).toEqual([0.5]);
  });
});
