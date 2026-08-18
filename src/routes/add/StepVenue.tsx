import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AccessType, VenueType } from "../../lib/types";
import { ACCESS_LABELS, VENUE_LABELS } from "../../lib/labels";
import { CONFIG } from "../../lib/config";
import { searchVenues } from "../../lib/api";
import type { Venue } from "../../lib/types";
import { emptyFloorEntry, type ToiletDraft } from "./types";

const VENUES = Object.keys(VENUE_LABELS) as VenueType[];
const ACCESSES = Object.keys(ACCESS_LABELS) as AccessType[];
const SUPPLIES = CONFIG.wizard.supplies;
const FLOOR_PRESETS = CONFIG.wizard.floorPresets;

export function StepVenue({
  draft,
  onChange,
  onNext,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onNext: () => void;
}) {
  const [customFloor, setCustomFloor] = useState("");
  const [venueMatches, setVenueMatches] = useState<Venue[]>([]);
  const [searchingVenue, setSearchingVenue] = useState(false);
  const venueAbort = useRef<AbortController | null>(null);

  // Debounced "is this an existing place?" lookup while the name is being
  // typed and we already know where the pin is.
  useEffect(() => {
    const name = (draft.venueName ?? "").trim();
    if (draft.venueId || name.length < 2 || draft.lat == null || draft.lng == null) {
      setVenueMatches([]);
      setSearchingVenue(false);
      return;
    }
    venueAbort.current?.abort();
    const controller = new AbortController();
    venueAbort.current = controller;
    setSearchingVenue(true);
    const t = setTimeout(() => {
      searchVenues(name, { lat: draft.lat!, lng: draft.lng! })
        .then(setVenueMatches)
        .catch(() => setVenueMatches([]))
        .finally(() => setSearchingVenue(false));
    }, CONFIG.wizard.placeSearchDelayMs);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.venueName, draft.venueId, draft.lat, draft.lng]);

  function toggleSupply(s: string) {
    onChange((prev) => ({
      ...prev,
      supplies: prev.supplies.includes(s)
        ? prev.supplies.filter((x) => x !== s)
        : [...prev.supplies, s],
    }));
  }

  function setVenueName(name: string) {
    // Editing the name always re-opens "create new" — the user can re-attach
    // by picking one of the matches below.
    onChange((prev) => ({ ...prev, venueName: name, venueId: null }));
  }

  function attachVenue(v: Venue) {
    onChange((prev) => ({ ...prev, venueId: v.id, venueName: v.name }));
    setVenueMatches([]);
  }

  function setPrimaryFloor(label: string | null) {
    onChange((prev) => ({ ...prev, primary: { ...prev.primary, floorLabel: label } }));
  }

  function addAdditionalFloor(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    onChange((prev) => {
      if (
        prev.additionalFloors.some((f) => f.floorLabel === trimmed) ||
        prev.primary.floorLabel === trimmed
      ) {
        return prev;
      }
      return { ...prev, additionalFloors: [...prev.additionalFloors, emptyFloorEntry(trimmed)] };
    });
  }

  function removeAdditionalFloor(label: string) {
    onChange((prev) => ({
      ...prev,
      additionalFloors: prev.additionalFloors.filter((f) => f.floorLabel !== label),
    }));
  }

  return (
    <div className="screen-body">
      <div className="stepper">
        <i className="done" />
        <i className="done" />
        <i className="done" />
        <i />
        <i />
      </div>

      <div className="lbl">Place name</div>
      <input
        value={draft.venueName ?? ""}
        onChange={(e) => setVenueName(e.target.value)}
        placeholder="e.g. Terminal 21, Siam Paragon"
        maxLength={CONFIG.wizard.venueNameMaxLength}
        style={{
          border: "1.5px solid var(--border-strong)",
          borderRadius: 4,
          padding: "8px 9px",
          fontSize: 13,
        }}
      />
      {draft.venueId && (
        <div style={{ fontSize: 11, color: "var(--green-3)" }}>
          ✓ Linked to an existing place — new toilets will join it
        </div>
      )}
      {(venueMatches.length > 0 || searchingVenue) && !draft.venueId && (
        <div className="box dashed" style={{ gap: 4, padding: 6 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {searchingVenue ? "Looking for this place…" : "Is this an existing place? Tap to join it:"}
          </div>
          {venueMatches.map((v) => (
            <button key={v.id} className="btn2" style={{ textAlign: "left" }} onClick={() => attachVenue(v)}>
              {v.name}
            </button>
          ))}
        </div>
      )}

      <div className="lbl">Venue</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {VENUES.map((v) => (
          <span
            key={v}
            className={`btn2 ${draft.venueType === v ? "selected" : ""}`}
            onClick={() => onChange((prev) => ({ ...prev, venueType: v }))}
          >
            {VENUE_LABELS[v]}
          </span>
        ))}
      </div>

      <div className="lbl">Access</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ACCESSES.map((a) => (
          <span
            key={a}
            className={`btn2 ${draft.accessType === a ? "selected" : ""}`}
            onClick={() => onChange((prev) => ({ ...prev, accessType: a }))}
          >
            {ACCESS_LABELS[a]}
          </span>
        ))}
      </div>

      <div className="lbl">Supplies</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SUPPLIES.map((s) => (
          <span
            key={s}
            className={`chip ${draft.supplies.includes(s) ? "on" : ""}`}
            onClick={() => toggleSupply(s)}
          >
            {s}
          </span>
        ))}
      </div>

      <div
        className="lbl"
        style={{ cursor: "pointer" }}
        onClick={() => onChange((prev) => ({ ...prev, multiFloor: !prev.multiFloor }))}
      >
        {draft.multiFloor ? "☑" : "☐"} Restrooms on other floors too?
      </div>

      {draft.multiFloor && (
        <>
          <div className="lbl">This one is on floor (optional)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FLOOR_PRESETS.map((f) => (
              <span
                key={f}
                className={`chip ${draft.primary.floorLabel === f ? "on" : ""}`}
                onClick={() => setPrimaryFloor(draft.primary.floorLabel === f ? null : f)}
              >
                {f}
              </span>
            ))}
          </div>

          <div className="lbl">Also add floors</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FLOOR_PRESETS.filter((f) => f !== draft.primary.floorLabel).map((f) => {
              const on = draft.additionalFloors.some((e) => e.floorLabel === f);
              return (
                <span
                  key={f}
                  className={`chip ${on ? "on" : ""}`}
                  onClick={() => (on ? removeAdditionalFloor(f) : addAdditionalFloor(f))}
                >
                  {f}
                </span>
              );
            })}
            {draft.additionalFloors
              .filter((e) => e.floorLabel && !FLOOR_PRESETS.includes(e.floorLabel))
              .map((e) => (
                <span key={e.entryId} className="chip on" onClick={() => removeAdditionalFloor(e.floorLabel!)}>
                  {e.floorLabel}
                </span>
              ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="box"
              style={{ flex: 1 }}
              value={customFloor}
              onChange={(e) => setCustomFloor(e.target.value)}
              placeholder="Custom floor, e.g. Mezzanine"
            />
            <button
              className="btn2"
              style={{ width: "auto", padding: "8px 12px" }}
              disabled={!customFloor.trim()}
              onClick={() => {
                addAdditionalFloor(customFloor);
                setCustomFloor("");
              }}
            >
              Add
            </button>
          </div>
        </>
      )}

      <button
        className="btn"
        style={{ marginTop: "auto" }}
        disabled={!draft.venueType || !draft.accessType}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
