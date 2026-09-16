import { useState } from "react";
import { formatAddress, type Address } from "../lib/geocode";
import { googleMapsUrl } from "../lib/maps";

/** Renders a structured address as Google-Maps-style multi-line text, with a
 * copy button. Used by ToiletDetail, ToiletCard and StepLocation so address
 * formatting stays consistent everywhere.
 *
 * When `lat`/`lng` are given, the copy button and "Open in Google Maps" link
 * both point at the exact coordinates (optionally labeled) instead of the
 * geocoded address text — geocoding a street address routinely lands on the
 * wrong building or a generic area centroid, so linking straight at the pin
 * is the only way to reliably land on the actual toilet. */
export function AddressBlock({
  address,
  lat,
  lng,
  label,
  includeCountry = true,
  muted = false,
}: {
  address: Address | null | undefined;
  lat?: number;
  lng?: number;
  label?: string;
  includeCountry?: boolean;
  muted?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = formatAddress(address ?? undefined, { includeCountry });
  const mapsUrl = lat != null && lng != null ? googleMapsUrl(lat, lng, label) : null;

  if (!text && !mapsUrl) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(mapsUrl ?? text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div style={{ fontSize: 11, color: muted ? "var(--text-muted)" : "var(--text)" }}>
      {text && <div style={{ whiteSpace: "pre-line", lineHeight: 1.45 }}>{text}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        <button
          className="btn2"
          onClick={copy}
          style={{ fontSize: 11, width: "auto", padding: "6px 10px" }}
          aria-label={mapsUrl ? "Copy Google Maps link" : "Copy address"}
        >
          {copied ? "Copied!" : mapsUrl ? "Copy Google Maps link" : "Copy address"}
        </button>
        {mapsUrl && (
          <a
            className="btn2"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, width: "auto", padding: "6px 10px", textAlign: "center" }}
          >
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
