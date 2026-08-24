import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { MapView, locateDevice } from "../../components/map/MapView";
import { reverseGeocode, searchPlaces, formatAddress, type GeocodeResult } from "../../lib/geocode";
import { CONFIG } from "../../lib/config";
import type { ToiletDraft } from "./types";

/** First address line (street/venue) + a compact second line (area · city · postcode). */
function resultLines(r: GeocodeResult): { line1: string; line2: string } {
  const full = formatAddress(r.address);
  const lines = full.split("\n").filter(Boolean);
  if (lines.length === 0) return { line1: r.displayName.split(",")[0]?.trim() ?? r.name, line2: "" };
  return { line1: lines[0], line2: lines.slice(1).join(" · ") };
}

export function StepLocation({
  draft,
  onChange,
  onNext,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingName, setResolvingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (draft.lat != null) return;
    locateDevice()
      .then((pos) =>
        onChange((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, locationSource: "gps" }))
      )
      .catch(() => {
        onChange((prev) => ({
          ...prev,
          lat: CONFIG.map.defaultCenter.lat,
          lng: CONFIG.map.defaultCenter.lng,
          locationSource: "manual",
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse-geocode the pin whenever it moves from GPS or a drag (not from picking
  // a search result, which already carries its own name + address).
  useEffect(() => {
    if (draft.lat == null || draft.lng == null) return;
    if (draft.locationSource === "search") return;
    geocodeAbort.current?.abort();
    const controller = new AbortController();
    geocodeAbort.current = controller;
    setResolvingName(true);
    const t = setTimeout(() => {
      reverseGeocode(draft.lat!, draft.lng!, controller.signal)
        .then((hit) => {
          onChange((prev) => ({
            ...prev,
            venueName: hit?.name ?? null,
            venueId: null,
            address: hit?.address ?? null,
          }));
        })
        .finally(() => setResolvingName(false));
    }, CONFIG.wizard.reverseGeocodeDelayMs);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.lat, draft.lng, draft.locationSource]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    const t = setTimeout(() => {
      searchPlaces(query, {
        near: draft.lat != null ? { lat: draft.lat, lng: draft.lng! } : undefined,
        signal: controller.signal,
      })
        .then(setResults)
        .finally(() => setSearching(false));
    }, CONFIG.wizard.placeSearchDelayMs);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pickResult(r: GeocodeResult) {
    onChange((prev) => ({
      ...prev,
      lat: r.lat,
      lng: r.lng,
      locationSource: "search",
      venueName: r.name,
      venueId: null,
      address: r.address ?? null,
    }));
    setQuery("");
    setResults([]);
  }

  function useMyLocation() {
    locateDevice()
      .then((pos) =>
        onChange((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, locationSource: "gps" }))
      )
      .catch(() => {});
  }

  async function copyAddress() {
    const text = formatAddress(draft.address ?? undefined, { includeCountry: true });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const addressText = formatAddress(draft.address ?? undefined);

  return (
    <div className="screen-body" style={{ padding: 0 }}>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div className="stepper">
          <i className="done" />
          <i className="done" />
          <i />
          <i />
          <i />
        </div>

        <div style={{ position: "relative" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place or venue"
            style={{
              width: "100%",
              border: "1.5px solid var(--border-strong)",
              borderRadius: 4,
              padding: "8px 9px",
              fontSize: 13,
            }}
          />
          {(results.length > 0 || searching) && (
            <div
              className="sheet"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                padding: 6,
                gap: 2,
                maxHeight: 220,
                zIndex: 6,
              }}
            >
              {searching && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 6 }}>Searching…</div>}
              {!searching &&
                results.map((r) => {
                  const lines = resultLines(r);
                  return (
                    <div
                      key={r.id}
                      className="box dashed"
                      style={{ cursor: "pointer", padding: 8, flexDirection: "column", alignItems: "flex-start" }}
                      onClick={() => pickResult(r)}
                    >
                      <b style={{ fontSize: 13 }}>{r.name}</b>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {lines.line1}
                        {lines.line2 && ` · ${lines.line2}`}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <button className="btn2" onClick={useMyLocation} style={{ alignSelf: "flex-start", fontSize: 12 }}>
          Use my location
        </button>

        <MapView
          className="map"
          center={draft.lat != null ? { lat: draft.lat, lng: draft.lng! } : undefined}
          draggableMarker={draft.lat != null ? { lat: draft.lat, lng: draft.lng! } : undefined}
          onDraggableMarkerMove={(pos) =>
            onChange((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, locationSource: "manual" }))
          }
          onGpsClick={useMyLocation}
        />

        <div className="box" style={{ fontSize: 13, flexDirection: "column", alignItems: "flex-start" }}>
          <b>
            {resolvingName
              ? "Finding the name…"
              : draft.venueName || (draft.lat != null ? "Unnamed spot" : "Locating…")}
          </b>
          {addressText && !resolvingName && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                whiteSpace: "pre-line",
                lineHeight: 1.45,
              }}
            >
              {addressText}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {draft.lat != null && `${draft.lat.toFixed(4)}, ${draft.lng!.toFixed(4)}`}
            {draft.locationSource === "gps" && " · From GPS"}
            {draft.locationSource === "manual" && " · Dragged"}
            {draft.locationSource === "search" && " · From search"}
          </span>
          {addressText && !resolvingName && (
            <button className="btn2" onClick={copyAddress} style={{ marginTop: 2, fontSize: 12 }}>
              {copied ? "Copied!" : "Copy address"}
            </button>
          )}
        </div>

        <div className="ann">Already left? Drag the pin to where it was.</div>

        <button className="btn" disabled={draft.lat == null} onClick={onNext}>
          Pin is right
        </button>
      </div>
    </div>
  );
}