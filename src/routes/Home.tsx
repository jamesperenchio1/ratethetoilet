import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapView, locateDevice, useDeviceLocation } from "../components/map/MapView";
import { ToiletCard } from "../components/toilet/ToiletCard";
import { listAllToilets } from "../lib/api";
import { haversineMeters, venueTypesLabel } from "../lib/labels";
import { groupToiletsByVenue, groupScore } from "../lib/venueGrouping";
import { CONFIG } from "../lib/config";
import type { Toilet } from "../lib/types";

const BANGKOK = CONFIG.map.defaultCenter;

interface Filters {
  freeOnly: boolean;
  wheelchairOnly: boolean;
  minScore: number;
}

const SHEET_PEEK = CONFIG.map.sheetPeekPx;
// With OSM's ~4k Thailand toilets imported, rendering every row as a map pin
// and a list card froze the map. These caps keep the nearest rows on screen
// (withDistance is already sorted nearest-first) so the map stays smooth.
const MAX_PINS = 200;
const MAX_LIST = 60;

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as
    | { center?: { lat: number; lng: number }; marker?: { lat: number; lng: number; name: string } }
    | null;
  const navCenter = navState?.center;
  const [center, setCenter] = useState(navCenter ?? BANGKOK);
  const userLocation = useDeviceLocation();
  const [placeMarker, setPlaceMarker] = useState(navState?.marker ?? null);
  const [toilets, setToilets] = useState<Toilet[] | null>(null);
  const [toiletsError, setToiletsError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const hadNavCenter = useRef(!!navCenter);
  const autoCentered = useRef(false);
  const [gpsFailed, setGpsFailed] = useState(false);
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
    if (autoCentered.current) return;
    if (!userLocation) return;
    // Center the map on the device's real position once the first GPS fix
    // lands. watchPosition keeps streaming fixes; only the first one recenters
    // so a later pan isn't fought by an automatic re-center.
    autoCentered.current = true;
    setCenter({ lat: userLocation.lat, lng: userLocation.lng });
    setGpsFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    let cancelled = false;
    // Fetch every non-hidden toilet once; distance-sorting happens client-side.
    // A couple of quiet auto-retries handle a network blip; only surface the
    // error banner if it's still failing after that.
    async function load(attempt = 0) {
      try {
        const rows = await listAllToilets();
        if (!cancelled) {
          setToilets(rows);
          setToiletsError(false);
        }
      } catch {
        if (cancelled) return;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          if (!cancelled) return load(attempt + 1);
          return;
        }
        setToilets([]);
        setToiletsError(true);
      }
    }
    setToiletsError(false);
    load();
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

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

  const distanceOrigin = userLocation ?? center;
  const withDistance = useMemo(
    () =>
      filtered
        .map((t) => ({ t, d: haversineMeters(distanceOrigin, { lat: t.lat, lng: t.lng }) }))
        .sort((a, b) => a.d - b.d),
    [filtered, distanceOrigin]
  );

  // Group toilets that belong to the same venue into one pin, so a
  // multi-floor place shows as a single tappable pin with a "N" count
  // instead of several overlapping ones. Single-toilet venues stay as-is.
  const { pins, pinTargets } = useMemo(() => {
    // Only render the nearest MAX_PINS toilets as map pins; withDistance is
    // already sorted nearest-first, so this keeps the map smooth while still
    // showing the closest places.
    const nearest = withDistance.slice(0, MAX_PINS).map(({ t }) => t);
    const groups = groupToiletsByVenue(nearest);
    const targets = new Map<string, string>();
    const out = groups.map((g) => {
      if (g.toilets.length > 1) {
        targets.set(g.key, g.toilets[0].id);
        return {
          id: g.key,
          lat: g.lat,
          lng: g.lng,
          score: groupScore(g),
          label: g.name ?? undefined,
          count: g.toilets.length,
        };
      }
      const t = g.toilets[0];
      return {
        id: t.id,
        lat: t.lat,
        lng: t.lng,
        score: t.overall_score,
        label: t.venue_name || venueTypesLabel(t.venue_types) || undefined,
      };
    });
    return { pins: out, pinTargets: targets };
  }, [withDistance]);

  const onGpsClick = useCallback(() => {
    if (userLocation) {
      setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      setGpsFailed(false);
      return;
    }
    locateDevice()
      .then((c) => {
        setCenter(c);
        setGpsFailed(false);
      })
      .catch(() => setGpsFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng]);

  const onDraggableMarkerMove = useCallback(
    (pos: { lat: number; lng: number }) =>
      setPlaceMarker((m) => (m ? { ...m, ...pos } : m)),
    []
  );

  return (
    <>
      <div className="home-map" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <MapView
          cacheKey="home"
          pins={pins}
          center={center}
          fitToPins={!hadNavCenter.current}
          onPinClick={(id) => navigate(`/t/${pinTargets.get(id) ?? id}`)}
          onGpsClick={onGpsClick}
          draggableMarker={placeMarker ?? undefined}
          onDraggableMarkerMove={onDraggableMarkerMove}
          userLocation={userLocation}
        />

        <div
          className="home-search"
          role="button"
          tabIndex={0}
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
          onClick={() => navigate("/search", { state: { center } })}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/search", { state: { center } })}
        >
          {placeMarker ? placeMarker.name : "Search a place or venue"}
        </div>

        <div className="home-filters" style={{ position: "absolute", top: 50, left: 8, right: 8, display: "flex", gap: 6, overflowX: "auto", zIndex: 3 }}>
          <span
            className={`chip ${filters.freeOnly ? "on" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={filters.freeOnly}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            onClick={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
          >
            Free
          </span>
          <span
            className={`chip ${filters.wheelchairOnly ? "on" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={filters.wheelchairOnly}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            onClick={() => setFilters((f) => ({ ...f, wheelchairOnly: !f.wheelchairOnly }))}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFilters((f) => ({ ...f, wheelchairOnly: !f.wheelchairOnly }))}
          >
            Wheelchair
          </span>
          <span
            className={`chip ${filters.minScore >= CONFIG.score.color.great ? "on" : ""}`}
            role="button"
            tabIndex={0}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}
            onClick={() => setFiltersOpen(true)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFiltersOpen(true)}
          >
            Filters
          </span>
        </div>

        {gpsFailed && (
          <div
            style={{
              position: "absolute",
              top: 92,
              left: 8,
              right: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-card)",
              border: "1.5px solid var(--border-strong)",
              borderRadius: 4,
              padding: "8px 10px",
              fontSize: 13,
              color: "var(--text-primary)",
              boxShadow: "0 1px 4px rgba(0,0,0,.15)",
              zIndex: 3,
            }}
          >
            <span style={{ flex: 1 }}>
              Couldn't pinpoint you — showing all toilets, nearest first. Tap{" "}
              <b>GPS</b> to retry.
            </span>
            <button
              onClick={() => setGpsFailed(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: 15,
                lineHeight: 1,
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 2,
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {placeMarker && !sheetExpanded && (
          <div
            style={{
              position: "absolute",
              left: 8,
              bottom: SHEET_PEEK + 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--surface-card)",
              border: "1.5px solid var(--border-strong)",
              borderRadius: 999,
              padding: "6px 6px 6px 14px",
              fontSize: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,.25)",
              zIndex: 3,
            }}
          >
            <span
              role="button"
              tabIndex={0}
              style={{ color: "var(--chart-4)", cursor: "pointer" }}
              onClick={() => navigate("/add", { state: { center: placeMarker, venueName: placeMarker.name } })}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") &&
                navigate("/add", { state: { center: placeMarker, venueName: placeMarker.name } })
              }
            >
              + Add toilet here
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label="Dismiss searched place"
              style={{ color: "var(--text-muted)", cursor: "pointer", padding: "0 4px" }}
              onClick={() => setPlaceMarker(null)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPlaceMarker(null)}
            >
              ×
            </span>
          </div>
        )}

        {!sheetExpanded && (
          <span
            className="home-add"
            role="button"
            tabIndex={0}
            aria-label="Add a toilet"
            onClick={() => navigate("/add")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/add")}
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
            {toilets && withDistance.length > MAX_LIST && (
              <div style={{ padding: "0 12px 4px", fontSize: 11, color: "var(--text-muted)" }}>
                Showing the {MAX_LIST} nearest · move the map to load more
              </div>
            )}
          </div>

          <div className="screen-body" style={{ paddingTop: 2 }}>
            {toiletsError && (
              <div className="center-empty">
                <b style={{ color: "var(--text-primary)" }}>Couldn't load toilets.</b>
                <span style={{ color: "var(--text-muted)" }}>Check your connection and try again.</span>
                <button
                  className="btn"
                  style={{ width: "auto", padding: "11px 20px" }}
                  onClick={() => setRetryTick((n) => n + 1)}
                >
                  Retry
                </button>
              </div>
            )}
            {!toiletsError && toilets && withDistance.length === 0 && toilets.length === 0 && (
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
            {withDistance.slice(0, MAX_LIST).map(({ t, d }) => (
              <ToiletCard
                key={t.id}
                toilet={t}
                distanceMeters={d}
                onSelect={(sel) => {
                  setCenter({ lat: sel.lat, lng: sel.lng });
                  setSheetExpanded(false);
                }}
              />
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