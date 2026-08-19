import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapView, locateDevice } from "../components/map/MapView";
import { ToiletCard } from "../components/toilet/ToiletCard";
import { listAllToilets } from "../lib/api";
import { haversineMeters, venueTypesLabel } from "../lib/labels";
import { CONFIG } from "../lib/config";
import type { Toilet } from "../lib/types";

const BANGKOK = CONFIG.map.defaultCenter;

interface Filters {
  freeOnly: boolean;
  wheelchairOnly: boolean;
  minScore: number;
}

const SHEET_PEEK = CONFIG.map.sheetPeekPx;

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
    // Fetch every non-hidden toilet once; distance-sorting happens client-side.
    listAllToilets()
      .then((rows) => {
        if (!cancelled) setToilets(rows);
      })
      .catch(() => {
        if (!cancelled) setToilets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const withDistance = useMemo(
    () =>
      filtered
        .map((t) => ({ t, d: haversineMeters(center, { lat: t.lat, lng: t.lng }) }))
        .sort((a, b) => a.d - b.d),
    [filtered, center]
  );

  // One pin per toilet — every listing is on the map, not just nearby ones.
  const pins = filtered.map((t) => ({
    id: t.id,
    lat: t.lat,
    lng: t.lng,
    score: t.overall_score,
    label: t.venue_name || venueTypesLabel(t.venue_types) || undefined,
  }));

  return (
    <>
      <div className="home-map" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <MapView
          pins={pins}
          center={center}
          fitToPins={!hadNavCenter.current}
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
                  ? "Loading…"
                  : `${withDistance.length} toilet${withDistance.length === 1 ? "" : "s"} · nearest first`}
              </b>
              <span style={{ color: "var(--chart-4)" }}>{sheetExpanded ? "Show map" : "See list"}</span>
            </div>
          </div>

          <div className="screen-body" style={{ paddingTop: 2 }}>
            {toilets && withDistance.length === 0 && toilets.length === 0 && (
              <div className="center-empty">
                <b style={{ color: "var(--text-primary)" }}>Nobody has mapped anything yet.</b>
                <button className="btn" style={{ width: "auto", padding: "11px 20px" }} onClick={() => navigate("/add")}>
                  Add the first toilet
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
            {withDistance.map(({ t, d }) => (
              <ToiletCard key={t.id} toilet={t} distanceMeters={d} />
            ))}
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
              Show {withDistance.length} toilet{withDistance.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}