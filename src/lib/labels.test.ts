import { describe, expect, it } from "vitest";
import { distanceLabel, haversineMeters } from "./labels";

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    const p = { lat: 13.7563, lng: 100.5018 };
    expect(haversineMeters(p, p)).toBeCloseTo(0, 6);
  });

  it("matches a known distance (~157km, Bangkok to Pattaya-ish)", () => {
    const bangkok = { lat: 13.7563, lng: 100.5018 };
    const pattaya = { lat: 12.9236, lng: 100.8825 };
    const d = haversineMeters(bangkok, pattaya);
    expect(d).toBeGreaterThan(90_000);
    expect(d).toBeLessThan(110_000);
  });
});

describe("distanceLabel", () => {
  it("formats sub-km distances in meters", () => {
    expect(distanceLabel(250)).toBe("250 m");
  });

  it("formats km distances with one decimal", () => {
    expect(distanceLabel(1500)).toBe("1.5 km");
  });
});
