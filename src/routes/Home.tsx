import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapView, locateDevice } from "../components/map/MapView";
import { ToiletCard } from "../components/toilet/ToiletCard";
import { listToiletsNear } from "../lib/api";
import { haversineMeters } from "../lib/labels";
import { venueTypesLabel } from "../lib/labels";
import { groupToiletsByVenue, groupScore, type VenueGroup } from "../lib/venueGrouping";
import { CONFIG } from "../lib/config";
import type { Toilet } from "../lib/types";

const BANGKOK = CONFIG.map.defaultCenter;

// Fixed 3km is often empty in lightly-mapped areas even when a closer-than-you'd-
// think toilet exists further out — widen the search instead of giving up.
const SEARCH_RADII_M = CONFIG.map.searchRadiiM;

interface Filters {
  freeOnly: boolean;
  wheelchairOnly: boolean;
  minScore: number;
}

const SHEET_PEEK = CONFIG.map.sheetPeekPx;

function VenueGroupCard({ group, distanceMeters }: { group: VenueGroup; distanceMeters?: number }) {
  const [open, setOpen] = useState(false);
  const first = group.toilets[0];
  return (
    <div className="box" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 10,
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <b>{group.name || venueTypesLabel(first.venue_types) || "Toilet"}</b>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {group.toilets.length} floor{group.toilets.length === 1 ? "" : "s"}
            {distanceMeters != null && ` · ${Math.round(distanceMeters)} m`}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--chart-4)" }}>{open ? "Hide" : "Show"}</span>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 10px 10px" }}>
          {group.toilets.map((t) => (
            <ToiletCard key={t.id} toilet={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const navCenter = (location.state as { center?: { lat: number; lng: number } } | null)?.center;
  const [center, setCenter] = useState(navCenter ?? BANGKOK);
  const [toilets, setToilets] = useState<Toilet[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const hadNavCenter = useRef(!!navCenter);
  const [filters, setFilters] = useState<Filters>({
    freeOnly: false,
    wheelchairOnly: false,
    minScore: 0,
  });

  useEffect(() => {
    function onPointerUp(e: PointerEvent) {
      if (dragStartY.current == null) return;
      const delta = e.clientY - dragStartY.current;
      dragStartY.current = null;
      if (delta < -30) setSheetExpanded(true);
      else if (delta > 30) setSheetExpanded(false);
    }
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  useEffect(() => {
    // A caller (e.g. "Back to the map" after posting) already handed us the
    // right place to look — don't let a slower/disagreeing device GPS fix
    // pull the view away from the toilet the user just came here to see.
    if (hadNavCenter.current) return;
    locateDevice()
      .then(setCenter)
      .catch(() => {
        /* fall back to Bangkok center */
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const radius of SEARCH_RADII_M) {
        const rows = await listToiletsNear(center, radius);
        if (cancelled) return;
        const isLastAttempt = radius === SEARCH_RADII_M[SEARCH_RADII_M.length - 1];
        if (rows.length > 0 || isLastAttempt) {
          setToilets(rows);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng]);

  const filtered = useMemo(() => {
    if (!toilets) return [];
    return toilets.filter((t) => {
      if (filters.freeOnly && !t.access_types.includes("free")) return false;
      if (filters.wheelchairOnly && t.wheelchair !== "yes") return false;
      if (
        filters.minScore > 0 &&
        (t.overall_score == null || t.overall_score < filters.minScore)
      )
        return false;
      return true;
    });
  }, [toilets, filters]);

  const groups = useMemo(() => groupToiletsByVenue(filtered), [filtered]);

  const withDistance = useMemo(
    () =>
      groups
        .map((g) => ({ g, d: haversineMeters(center, { lat: g.lat, lng: g.lng }) }))
        .sort((a, b) => a.d - b.d),
    [groups, center]
  );

  const pins = groups.map((g) => ({
    id: g.toilets[0].id,
    lat: g.lat,
    lng: g.lng,
    score: groupScore(g),
    label: g.name,
    count: g.toilets.length,
  }));

  return (
    <>
      <div className="home-map" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <MapView
          pins={pins}
          center={center}
          onPinClick={(id) => navigate(`/t/${id}`)}
          onGpsClick={() => locateDevice().then(setCenter).catch(() => {})}
        />

        <div
          className="home-search"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 64,
            background: "var(--surface-card)",
            border: "1.5px solid var(--border-strong)",
            borderRadius: 4,
            padding: "8px 10px",
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "text",
            boxShadow: "0 1px 4px rgba(0,0,0,.15)",
            zIndex: 3,
          }}
          onClick={() => navigate("/search")}
        >
          Search a place or venue
        </div>

        <div className="home-filters" style={{ position: "absolute", top: 50, left: 8, right: 8, display: "flex", gap: 6, overflowX: "auto", zIndex: 3 }}>
          <span
            className={`chip ${filters.freeOnly ? "on" : ""}`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            onClick={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
          >
            Free
          </span>
          <span
            className={`chip ${filters.wheelchairOnly ? "on" : ""}`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            onClick={() => setFilters((f) => ({ ...f, wheelchairOnly: !f.wheelchairOnly }))}
          >
            Wheelchair
          </span>
          <span
            className={`chip ${filters.minScore >= CONFIG.score.color.great ? "on" : ""}`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            onClick={() => setFiltersOpen(true)}
          >
            Filters
          </span>
        </div>

        {!sheetExpanded && (
          <span
            className="home-add"
            onClick={() => navigate("/add")}
            style={{
              position: "absolute",
              right: 8,
              bottom: SHEET_PEEK + 10,
              background: "var(--surface-accent)",
              color: "#fff",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,.25)",
              zIndex: 3,
            }}
          >
            + Add
          </span>
        )}

        <div
          className="home-sheet"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: sheetExpanded ? "72vh" : SHEET_PEEK,
            transition: "height .25s ease",
            background: "var(--surface-card)",
            borderTop: "2px solid var(--border-strong)",
            borderRadius: "10px 10px 0 0",
            boxShadow: "0 -2px 8px rgba(0,0,0,.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 4,
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", cursor: "pointer", touchAction: "none" }}
            onPointerDown={(e) => {
              dragStartY.current = e.clientY;
            }}
            onClick={() => setSheetExpanded((v) => !v)}
          >
            <span className="grab" style={{ marginTop: 8 }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 12px 4px",
                fontSize: 12,
              }}
            >
              <b>
                {toilets == null
                  ? "Looking nearby…"
                  : `${withDistance.length} place${withDistance.length === 1 ? "" : "s"} nearby`}
              </b>
              <span style={{ color: "var(--chart-4)" }}>{sheetExpanded ? "Show map" : "See list"}</span>
            </div>
          </div>

          <div className="screen-body" style={{ paddingTop: 2 }}>
            {toilets && withDistance.length === 0 && toilets.length === 0 && (
              <div className="center-empty">
                <b style={{ color: "var(--text-primary)" }}>Nobody has mapped this area yet.</b>
                <button className="btn" style={{ width: "auto", padding: "11px 20px" }} onClick={() => navigate("/add")}>
                  Add the first toilet here
                </button>
              </div>
            )}
            {toilets && withDistance.length === 0 && toilets.length > 0 && (
              <div className="center-empty">
                <b style={{ color: "var(--text-primary)" }}>No toilets match your filters.</b>
                <button
                  className="btn2"
                  style={{ width: "auto", padding: "11px 20px" }}
                  onClick={() => setFilters({ freeOnly: false, wheelchairOnly: false, minScore: 0 })}
                >
                  Clear filters
                </button>
              </div>
            )}
            {withDistance.map(({ g, d }) =>
              g.toilets.length === 1 ? (
                <ToiletCard key={g.key} toilet={g.toilets[0]} distanceMeters={d} />
              ) : (
                <VenueGroupCard key={g.key} group={g} distanceMeters={d} />
              )
            )}
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="sheet-backdrop" onClick={() => setFiltersOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <span className="grab" />
            <div className="lbl">Access</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span
                className={`chip ${filters.freeOnly ? "on" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
              >
                Free
              </span>
              <span
                className={`chip ${filters.wheelchairOnly ? "on" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, wheelchairOnly: !f.wheelchairOnly }))}
              >
                Wheelchair
              </span>
            </div>
            <div className="lbl">Minimum score</div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.minScore}
              onChange={(e) => setFilters((f) => ({ ...f, minScore: Number(e.target.value) }))}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
              <span>Any</span>
              <span className="num">{filters.minScore || "Any"}</span>
            </div>
            <button className="btn" onClick={() => setFiltersOpen(false)}>
              Show {withDistance.length} place{withDistance.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
