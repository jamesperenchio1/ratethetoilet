import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import {
  getToilet,
  listVenueTypes,
  findOrCreateVenueType,
  searchVenues,
  photoUrl,
  deleteToiletPhoto,
  updateOwnToilet,
  deleteOwnToilet,
  type ToiletEditInput,
} from "../lib/api";
import { ACCESS_LABELS, venueTypeLabel } from "../lib/labels";
import { CONFIG } from "../lib/config";
import { overallScore, scoreColor, scoreLabel } from "../lib/score";
import { MapView, locateDevice } from "../components/map/MapView";
import { reverseGeocode, flattenAddress } from "../lib/geocode";
import type { ToiletWithAuthor, TriState, Venue, VenueTypeDef } from "../lib/types";

const ACCESSES = Object.keys(ACCESS_LABELS);
const SUPPLIES = CONFIG.wizard.supplies;
const HINT_CHIPS = CONFIG.wizard.hintChips;

export function EditToilet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useIdentity();
  const [toilet, setToilet] = useState<ToiletWithAuthor | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<VenueTypeDef[]>([]);
  const [venueMatches, setVenueMatches] = useState<Venue[]>([]);
  const [customTypeOpen, setCustomTypeOpen] = useState(false);
  const [customTypeValue, setCustomTypeValue] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const venueAbort = useRef<AbortController | null>(null);

  // Editable form state, initialised from the loaded toilet.
  const [form, setForm] = useState<ToiletEditInput | null>(null);

  useEffect(() => {
    if (id) getToilet(id).then(setToilet);
  }, [id]);

  useEffect(() => {
    if (!toilet || form) return;
    setForm({
      venue_name: toilet.venue_name ?? null,
      venue_types: toilet.venue_types,
      access_types: toilet.access_types,
      supplies: toilet.supplies,
      wheelchair: toilet.wheelchair,
      hint_chips: toilet.hint_chips,
      hint_note: toilet.hint_note ?? null,
      cleanliness: toilet.cleanliness,
      smell: toilet.smell,
      privacy: toilet.privacy,
      floor: toilet.floor ?? null,
      lat: toilet.lat,
      lng: toilet.lng,
      location_source: toilet.location_source ?? null,
      venue_id: toilet.venue_id ?? null,
      address_road: toilet.address_road ?? null,
      address_house_number: toilet.address_house_number ?? null,
      address_suburb: toilet.address_suburb ?? null,
      address_city: toilet.address_city ?? null,
      address_postcode: toilet.address_postcode ?? null,
      address_country: toilet.address_country ?? null,
    });
  }, [toilet, form]);

  useEffect(() => {
    listVenueTypes()
      .then(setCatalog)
      .catch(() =>
        setCatalog(
          Object.keys(CONFIG.labels.venue).map((key) => ({
            key,
            label: CONFIG.labels.venue[key],
            is_custom: false,
          }))
        )
      );
  }, []);

  // Debounced "is this an existing place?" lookup while the name is typed.
  useEffect(() => {
    const name = (form?.venue_name ?? "").trim();
    if (!form || form.venue_id || name.length < 2) {
      setVenueMatches([]);
      return;
    }
    venueAbort.current?.abort();
    const controller = new AbortController();
    venueAbort.current = controller;
    const t = setTimeout(() => {
      searchVenues(name, { lat: form.lat, lng: form.lng })
        .then(setVenueMatches)
        .catch(() => setVenueMatches([]));
    }, CONFIG.wizard.placeSearchDelayMs);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.venue_name, form?.venue_id, form?.lat, form?.lng]);

  const isAuthor = !!profile && toilet?.author_id === profile.id;
  const photos = useMemo(() => toilet?.photos?.filter((p) => !p.hidden) ?? [], [toilet]);
  const overall = form ? overallScore(form.cleanliness, form.smell, form.privacy) : null;

  // Refresh the denormalized address whenever the pin moves (drag or GPS), so
  // edits carry fresh Google-Maps-style location detail too.
  useEffect(() => {
    if (!form) return;
    if (form.location_source === "search") return;
    const t = setTimeout(() => {
      reverseGeocode(form.lat, form.lng).then((hit) => {
        if (hit) {
          setForm((prev) => ({ ...prev!, ...flattenAddress(hit.address) }));
        }
      });
    }, CONFIG.wizard.reverseGeocodeDelayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.lat, form?.lng, form?.location_source]);

  if (!toilet) return <div className="screen-body">Loading…</div>;
  if (!isAuthor) {
    return (
      <>
        <TopBar back title="Edit listing" />
        <div className="screen-body">
          <div className="center-empty">
            <span>This isn't your listing to edit.</span>
            <button className="btn" style={{ width: "auto", padding: "11px 20px" }} onClick={() => navigate(`/t/${toilet.id}`)}>
              Back to listing
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!form) return <div className="screen-body">Loading…</div>;

  function toggle(list: keyof Pick<ToiletEditInput, "venue_types" | "access_types" | "supplies" | "hint_chips">, key: string) {
    setForm((prev) => ({
      ...prev!,
      [list]: prev![list].includes(key)
        ? prev![list].filter((k) => k !== key)
        : [...prev![list], key],
    }));
  }

  function setWheelchair(w: TriState | null) {
    setForm((prev) => ({ ...prev!, wheelchair: prev!.wheelchair === w ? null : w }));
  }

  async function addCustomType() {
    const label = customTypeValue.trim();
    if (!label || addingCustom) return;
    setAddingCustom(true);
    try {
      const key = await findOrCreateVenueType(label);
      setForm((prev) => ({ ...prev!, venue_types: [...prev!.venue_types, key] }));
      setCatalog((prev) =>
        prev.some((v) => v.key === key) ? prev : [...prev, { key, label: venueTypeLabel(key), is_custom: true }]
      );
      setCustomTypeValue("");
      setCustomTypeOpen(false);
    } finally {
      setAddingCustom(false);
    }
  }

  async function removePhoto(photo: (typeof photos)[number]) {
    if (removingPhoto) return;
    setRemovingPhoto(photo.id);
    setError(null);
    try {
      await deleteToiletPhoto(photo);
      setToilet((prev) => prev ? { ...prev, photos: prev.photos?.filter((p) => p.id !== photo.id) } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingPhoto(null);
    }
  }

  async function save() {
    if (!id || !form || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateOwnToilet(id, form);
      navigate(`/t/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeListing() {
    if (!id || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteOwnToilet(id);
      navigate("/you");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  const bar = (label: string, value: number | null, onChange: (v: number) => void) => (
    <>
      <div className="lbl">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 44 }}>avoid</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 44, textAlign: "right" }}>great</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {value ?? "Not rated"} · {scoreLabel(value)}
      </div>
    </>
  );

  return (
    <>
      <TopBar back title="Edit listing" />
      <div className="screen-body">
        <div className="box" style={{ alignItems: "center", gap: 4 }}>
          <b style={{ fontSize: 15 }}>{form.venue_name || venueTypeLabel(form.venue_types[0] ?? "") || "Unnamed toilet"}</b>
          <span className="num" style={{ fontSize: 22, color: scoreColor(overall) }}>
            {overall ?? "—"}
          </span>
        </div>

        <div className="lbl">Place name</div>
        <input
          value={form.venue_name ?? ""}
          onChange={(e) =>
            setForm((prev) => ({ ...prev!, venue_name: e.target.value, venue_id: null }))
          }
          placeholder="e.g. Terminal 21, Siam Paragon"
          maxLength={CONFIG.wizard.venueNameMaxLength}
          style={{
            border: "1.5px solid var(--border-strong)",
            borderRadius: 4,
            padding: "8px 9px",
            fontSize: 13,
          }}
        />
        {venueMatches.length > 0 && !form.venue_id && (
          <div className="box dashed" style={{ gap: 4, padding: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Is this an existing place? Tap to join it:
            </div>
            {venueMatches.map((v) => (
              <button key={v.id} className="btn2" style={{ textAlign: "left" }} onClick={() => setForm((prev) => ({ ...prev!, venue_id: v.id, venue_name: v.name }))}>
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="lbl">Floor (optional)</div>
        <input
          value={form.floor ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev!, floor: e.target.value.trim() || null }))}
          placeholder="e.g. G, 1, B2, Mezzanine"
          style={{
            border: "1.5px solid var(--border-strong)",
            borderRadius: 4,
            padding: "8px 9px",
            fontSize: 13,
          }}
        />

        <div className="lbl">Location</div>
        <div className="map" style={{ height: 180, borderRadius: 6, overflow: "hidden", border: "1.5px solid var(--border-strong)", display: "flex", flexDirection: "column" }}>
          <MapView
            center={{ lat: form.lat, lng: form.lng }}
            zoom={17}
            maxZoom={18}
            draggableMarker={{ lat: form.lat, lng: form.lng }}
            onDraggableMarkerMove={(pos) =>
              setForm((prev) => ({ ...prev!, lat: pos.lat, lng: pos.lng, location_source: "manual" }))
            }
            onGpsClick={() =>
              locateDevice().then((pos) =>
                setForm((prev) => ({ ...prev!, lat: pos.lat, lng: pos.lng, location_source: "gps" }))
              )
            }
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {form.lat.toFixed(6)}, {form.lng.toFixed(6)} · drag the pin or tap GPS
        </div>

        <div className="lbl">Venue</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {catalog.map((v) => (
            <span key={v.key} className={`chip ${form.venue_types.includes(v.key) ? "on" : ""}`} onClick={() => toggle("venue_types", v.key)}>
              {v.label}
            </span>
          ))}
          <span className={`chip ${customTypeOpen ? "on" : ""}`} onClick={() => setCustomTypeOpen((o) => !o)}>
            + Other
          </span>
        </div>
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
            <button className="btn2" style={{ width: "auto", padding: "8px 12px" }} disabled={!customTypeValue.trim() || addingCustom} onClick={addCustomType}>
              {addingCustom ? "…" : "Add"}
            </button>
          </div>
        )}

        <div className="lbl">Access</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ACCESSES.map((a) => (
            <span key={a} className={`chip ${form.access_types.includes(a) ? "on" : ""}`} onClick={() => toggle("access_types", a)}>
              {ACCESS_LABELS[a]}
            </span>
          ))}
        </div>

        <div className="lbl">Supplies</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SUPPLIES.map((s) => (
            <span key={s} className={`chip ${form.supplies.includes(s) ? "on" : ""}`} onClick={() => toggle("supplies", s)}>
              {s}
            </span>
          ))}
        </div>

        <div className="lbl">Wheelchair</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["yes", "no", "unsure"] as TriState[]).map((w) => (
            <span key={w} className={`chip ${form.wheelchair === w ? "on" : ""}`} onClick={() => setWheelchair(w)}>
              {w[0].toUpperCase() + w.slice(1)}
            </span>
          ))}
          <span className={`chip ${form.wheelchair === null ? "on" : ""}`} onClick={() => setWheelchair(null)}>
            Clear
          </span>
        </div>

        <div className="lbl">Scores</div>
        {bar("Cleanliness", form.cleanliness, (v) => setForm((prev) => ({ ...prev!, cleanliness: v })))}
        {bar("Smell", form.smell, (v) => setForm((prev) => ({ ...prev!, smell: v })))}
        {bar("Privacy", form.privacy, (v) => setForm((prev) => ({ ...prev!, privacy: v })))}
        <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Overall</span>
          <span className="num" style={{ color: scoreColor(overall) }}>{overall ?? "—"}</span>
        </div>

        <div className="lbl">How to find it</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {HINT_CHIPS.map((h) => (
            <span key={h} className={`chip ${form.hint_chips.includes(h) ? "on" : ""}`} onClick={() => toggle("hint_chips", h)}>
              {h}
            </span>
          ))}
        </div>
        <textarea
          value={form.hint_note ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev!, hint_note: e.target.value || null }))}
          placeholder="Directions, what to look for…"
          rows={3}
          maxLength={CONFIG.wizard.hintNoteMaxLength}
          style={{
            border: "1.5px solid var(--border-strong)",
            borderRadius: 4,
            padding: "8px 9px",
            fontSize: 13,
          }}
        />

        <div className="lbl">Photos · {photos.length}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <img
                src={photoUrl(p.storage_path)}
                alt=""
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, border: "1.5px solid var(--border-strong)" }}
              />
              <span
                onClick={() => removePhoto(p)}
                style={{
                  position: "absolute",
                  right: -5,
                  top: -5,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--red-3)",
                  color: "#fff",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {removingPhoto === p.id ? "…" : "✕"}
              </span>
            </div>
          ))}
        </div>
        <button className="btn2" style={{ width: "100%" }} onClick={() => navigate(`/t/${toilet.id}/add-photos`)}>
          + Add photos
        </button>

        <button className="btn" style={{ marginTop: "auto" }} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {error && (
          <div className="toast" style={{ background: "var(--red-3)" }}>{error}</div>
        )}

        <div className="lbl" style={{ color: "var(--red-3)" }}>Danger</div>
        {!confirmDelete ? (
          <div
            className="box"
            style={{ flexDirection: "row", justifyContent: "space-between", borderColor: "var(--red-3)", color: "var(--red-3)", cursor: "pointer" }}
            onClick={() => setConfirmDelete(true)}
          >
            <span>Delete this listing</span>
            <span>→</span>
          </div>
        ) : (
          <div className="box" style={{ borderColor: "var(--red-3)" }}>
            <span style={{ fontSize: 12 }}>Delete this toilet and its photos for good? This can't be undone.</span>
            <button className="btn danger" disabled={deleting} onClick={removeListing}>
              {deleting ? "Deleting…" : "Yes, delete it"}
            </button>
            <button className="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}