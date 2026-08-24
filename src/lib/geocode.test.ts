import { describe, expect, it } from "vitest";
import { addressFromFlat, flattenAddress, formatAddress } from "./geocode";

describe("formatAddress", () => {
  it("returns an empty string for no address", () => {
    expect(formatAddress(undefined)).toBe("");
    expect(formatAddress(undefined, { includeCountry: true })).toBe("");
  });

  it("renders a Google-Maps-style multiline address", () => {
    const out = formatAddress({
      building: "Siam Paragon",
      house_number: "991",
      road: "Rama I Rd",
      suburb: "Pathum Wan",
      city: "Bangkok",
      postcode: "10330",
      country: "Thailand",
    });
    expect(out).toBe("Siam Paragon\n991 Rama I Rd\nPathum Wan\nBangkok\n10330");
  });

  it("appends the country only when includeCountry is set", () => {
    const addr = { road: "Sukhumvit", city: "Bangkok", country: "Thailand" };
    expect(formatAddress(addr)).toBe("Sukhumvit\nBangkok");
    expect(formatAddress(addr, { includeCountry: true })).toBe("Sukhumvit\nBangkok\nThailand");
  });

  it("dedupes a venue that repeats the road name", () => {
    const out = formatAddress({ building: "Central Embassy", road: "Central Embassy", city: "Bangkok" });
    expect(out).toBe("Central Embassy\nBangkok");
  });

  it("drops empty parts without leaving blank lines", () => {
    const out = formatAddress({ house_number: "12", road: "Sukhumvit Soi 24" });
    expect(out).toBe("12 Sukhumvit Soi 24");
  });

  it("falls back road->area->city when the top lines are missing", () => {
    const out = formatAddress({ neighbourhood: "Thong Lo", city_district: "Wattana", postcode: "10110" });
    expect(out).toBe("Thong Lo\nWattana\n10110");
  });
});

describe("flattenAddress", () => {
  it("returns null columns for a missing address", () => {
    expect(flattenAddress(undefined)).toEqual({
      address_road: null,
      address_house_number: null,
      address_suburb: null,
      address_city: null,
      address_postcode: null,
      address_country: null,
    });
  });

  it("maps structured fields onto the flat address_* columns", () => {
    expect(
      flattenAddress({ road: "Rama I Rd", house_number: "991", suburb: "Pathum Wan", city: "Bangkok", country: "Thailand" })
    ).toEqual({
      address_road: "Rama I Rd",
      address_house_number: "991",
      address_suburb: "Pathum Wan",
      address_city: "Bangkok",
      address_postcode: null,
      address_country: "Thailand",
    });
  });
});

describe("addressFromFlat", () => {
  it("returns undefined when every field is empty", () => {
    expect(addressFromFlat({})).toBeUndefined();
    expect(addressFromFlat({ address_road: null, address_city: "" })).toBeUndefined();
  });

  it("rebuilds a structured Address, dropping empty values", () => {
    expect(
      addressFromFlat({
        address_road: "Rama I Rd",
        address_house_number: "991",
        address_suburb: "Pathum Wan",
        address_city: "Bangkok",
        address_postcode: null,
        address_country: "Thailand",
      })
    ).toEqual({
      road: "Rama I Rd",
      house_number: "991",
      suburb: "Pathum Wan",
      city: "Bangkok",
      country: "Thailand",
    });
  });

  it("round-trips through flattenAddress", () => {
    const addr = { road: "Sukhumvit", city: "Bangkok", postcode: "10110", country: "Thailand" };
    expect(addressFromFlat(flattenAddress(addr))).toEqual(addr);
  });
});