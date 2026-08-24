import { useState } from "react";
import { formatAddress, type Address } from "../lib/geocode";

/** Renders a structured address as Google-Maps-style multi-line text, with a
 * copy button. Used by ToiletDetail, ToiletCard and StepLocation so address
 * formatting stays consistent everywhere. */
export function AddressBlock({
  address,
  includeCountry = true,
  muted = false,
}: {
  address: Address | null | undefined;
  includeCountry?: boolean;
  muted?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = formatAddress(address ?? undefined, { includeCountry });

  if (!text) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div style={{ fontSize: 11, color: muted ? "var(--text-muted)" : "var(--text)" }}>
      <div style={{ whiteSpace: "pre-line", lineHeight: 1.45 }}>{text}</div>
      <button
        className="btn2"
        onClick={copy}
        style={{ marginTop: 4, fontSize: 11 }}
        aria-label="Copy address"
      >
        {copied ? "Copied!" : "Copy address"}
      </button>
    </div>
  );
}