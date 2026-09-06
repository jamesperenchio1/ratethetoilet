import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ACCESS_LABELS, venueTypeLabel } from "../../lib/labels";
import { CONFIG } from "../../lib/config";
import { listVenueTypes, findOrCreateVenueType, searchVenues } from "../../lib/api";
import type { Venue, VenueTypeDef } from "../../lib/types";
import { emptyFloorEntry, type ToiletDraft } from "./types";

const ACCESSES = Object.keys(ACCESS_LABELS);
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
  const [catalog, setCatalog] = useState<VenueTypeDef[]>([]);
  const [customFloor, setCustomFloor] = useState("");
  const [customFloorOpen, setCustomFloorOpen] = useState(false);
  const [customPrimaryFloor, setCustomPrimaryFloor] = useState("");
  const [venueMatches, setVenueMatches] = useState<Venue[]>([]);
  const [searchingVenue, setSearchingVenue] = useState(false);
  const venueAbort = useRef<AbortController | null>(null);

  const [customTypeOpen, setCustomTypeOpen] = useState(false);
  const [customTypeValue, setCustomTypeValue] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const [venueTypeQuery, setVenueTypeQuery] = useState("");
  const [customSupply, setCustomSupply] = useState("");

  useEffect(() => {
    listVenueTypes()
      .then(setCatalog)
      .catch(() => {
        // fall back to the base config keys so the picker still renders
        setCatalog(
          Object.keys(CONFIG.labels.venue).map((key) => ({ key, label: CONFIG.labels.venue[key], is_custom: false }))
        );
      });
  }, []);

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

  function toggleVenueType(key: string) {
    onChange((prev) => ({
      ...prev,
      venueTypes: prev.venueTypes.includes(key)
        ? prev.venueTypes.filter((k) => k !== key)
        : [...prev.venueTypes, key],
    }));
  }

  function toggleAccess(key: string) {
    onChange((prev) => ({
      ...prev,
      accessTypes: prev.accessTypes.includes(key)
        ? prev.accessTypes.filter((k) => k !== key)
        : [...prev.accessTypes, key],
    }));
  }

  function toggleSupply(s: string) {
    onChange((prev) => ({
      ...prev,
      supplies: prev.supplies.includes(s)
        ? prev.supplies.filter((x) => x !== s)
        : [...prev.supplies, s],
    }));
  }

  function addCustomSupply() {
    const s = customSupply.trim();
    if (!s) return;
    onChange((prev) =>
      prev.supplies.includes(s) ? prev : { ...prev, supplies: [...prev.supplies, s] }
    );
    setCustomSupply("");
  }

  async function addCustomType() {
    const label = customTypeValue.trim();
    if (!label || addingCustom) return;
    setAddingCustom(true);
    try {
      const key = await findOrCreateVenueType(label);
      onChange((prev) => ({ ...prev, venueTypes: [...prev.venueTypes, key] }));
      // Add to the local catalog so it renders as a chip immediately.
      setCatalog((prev) => {
        if (prev.some((v) => v.key === key)) return prev;
        return [...prev, { key, label: venueTypeLabel(key), is_custom: true }];
      });
      setCustomTypeValue("");
      setCustomTypeOpen(false);
    } finally {
      setAddingCustom(false);
    }
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
      <input
        className="box"
        style={{ flex: "none" }}
        value={venueTypeQuery}
        onChange={(e) => setVenueTypeQuery(e.target.value)}
        placeholder="Search types (e.g. mall, beach)…"
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {catalog
          .filter((v) => {
            if (!venueTypeQuery.trim()) return true;
            const q = venueTypeQuery.trim().toLowerCase();
            return v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q);
          })
          .map((v) => (
            <span
              key={v.key}
              className={`chip ${draft.venueTypes.includes(v.key) ? "on" : ""}`}
              onClick={() => toggleVenueType(v.key)}
            >
              {v.label}
            </span>
          ))}
        <span className={`chip ${customTypeOpen ? "on" : ""}`} onClick={() => setCustomTypeOpen((o) => !o)}>
          + Add
        </span>
      </div>
      {venueTypeQuery.trim() &&
        !catalog.some(
          (v) => v.label.toLowerCase() === venueTypeQuery.trim().toLowerCase() || v.key === venueTypeQuery.trim().toLowerCase()
        ) && (
          <button
            className="btn2"
            style={{ textAlign: "left" }}
            onClick={async () => {
              const label = venueTypeQuery.trim();
              setVenueTypeQuery("");
              setCustomTypeValue(label);
              await addCustomType();
            }}
          >
            + Add new type “{venueTypeQuery.trim()}”
          </button>
        )}
      {customTypeOpen && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            autoFocus
            className="box"
            style={{ flex: 1 }}
            value={customTypeValue}
            onChange={(e) => setCustomTypeValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomType()}
            placeholder="e.g. Coworking space, Beach, Hospital…"
          />
          <button
            className="btn2"
            style={{ width: "auto", padding: "8px 12px" }}
            disabled={!customTypeValue.trim() || addingCustom}
            onClick={addCustomType}
          >
            {addingCustom ? "…" : "Add"}
          </button>
        </div>
      )}

      <div className="lbl">Access</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ACCESSES.map((a) => (
          <span
            key={a}
            className={`chip ${draft.accessTypes.includes(a) ? "on" : ""}`}
            onClick={() => toggleAccess(a)}
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
        {draft.supplies
          .filter((s) => !SUPPLIES.includes(s))
          .map((s) => (
            <span
              key={s}
              className={`chip ${draft.supplies.includes(s) ? "on" : ""}`}
              onClick={() => toggleSupply(s)}
            >
              {s}
            </span>
          ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="box"
          style={{ flex: 1 }}
          value={customSupply}
          onChange={(e) => setCustomSupply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomSupply()}
          placeholder="Add a supply, e.g. Soap, Dryer…"
        />
        <button
          className="btn2"
          style={{ width: "auto", padding: "8px 12px" }}
          disabled={!customSupply.trim()}
          onClick={addCustomSupply}
        >
          Add
        </button>
      </div>

      <button
        type="button"
        className="btn2"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          borderColor: draft.multiFloor ? "var(--chart-4)" : "var(--border-strong)",
          background: draft.multiFloor ? "var(--surface-accent-soft)" : "var(--surface-card)",
        }}
        onClick={() => onChange((prev) => ({ ...prev, multiFloor: !prev.multiFloor }))}
      >
        <span style={{ fontWeight: 600 }}>Not on the ground floor?</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 24,
            borderRadius: 12,
            background: draft.multiFloor ? "var(--chart-4)" : "var(--border-strong)",
            padding: "0 3px",
            fontSize: 10,
            color: "#fff",
            transition: "background 0.12s ease",
          }}
        >
          {draft.multiFloor ? "Yes" : "No"}
        </span>
      </button>

      {draft.multiFloor && (
        <>
          <div className="lbl">This restroom is on floor</div>
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
            {draft.primary.floorLabel && !FLOOR_PRESETS.includes(draft.primary.floorLabel) && (
              <span className="chip on" onClick={() => setPrimaryFloor(null)}>
                {draft.primary.floorLabel}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="box"
              style={{ flex: 1 }}
              value={customPrimaryFloor}
              onChange={(e) => setCustomPrimaryFloor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPrimaryFloor(customPrimaryFloor.trim());
                  setCustomPrimaryFloor("");
                }
              }}
              placeholder="Other floor, e.g. 2A"
            />
            <button
              className="btn2"
              style={{ width: "auto", padding: "8px 12px" }}
              disabled={!customPrimaryFloor.trim()}
              onClick={() => {
                setPrimaryFloor(customPrimaryFloor.trim());
                setCustomPrimaryFloor("");
              }}
            >
              Set
            </button>
          </div>

          <div className="lbl">Add restrooms on these other floors</div>
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
                  {e.floorLabel} ✕
                </span>
              ))}
            <span className="chip" onClick={() => setCustomFloorOpen((o) => !o)}>
              + Add
            </span>
          </div>
          {customFloorOpen && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                autoFocus
                className="box"
                style={{ flex: 1 }}
                value={customFloor}
                onChange={(e) => setCustomFloor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addAdditionalFloor(customFloor);
                    setCustomFloor("");
                  }
                }}
                placeholder="Other floor, e.g. 2A"
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
          )}
        </>
      )}

      <button
        className="btn"
        style={{ marginTop: "auto" }}
        disabled={draft.venueTypes.length === 0 || draft.accessTypes.length === 0}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
