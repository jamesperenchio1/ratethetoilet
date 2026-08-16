import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapView, locateDevice } from "../components/map/MapView";
import { ToiletCard } from "../components/toilet/ToiletCard";
import { listToiletsNear } from "../lib/api";
import { haversineMeters } from "../lib/labels";
import type { Toilet } from "../lib/types";

const BANGKOK = { lat: 13.7563, lng: 100.5018 };

interface Filters {
  freeOnly: boolean;
  wheelchairOnly: boolean;
  minScore: number;
}

export function Home() {
  const navigate = useNavigate();
  const [center, setCenter] = useState(BANGKOK);
  const [toilets, setToilets] = useState<Toilet[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    freeOnly: false,
    wheelchairOnly: false,
    minScore: 0,
  });

  useEffect(() => {
    locateDevice()
      .then(setCenter)
      .catch(() => {
        /* fall back to Bangkok center */
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    listToiletsNear(center, 3000).then((rows) => {
      if (!cancelled) setToilets(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng]);

  const filtered = useMemo(() => {
    if (!toilets) return [];
    return toilets.filter((t) => {
      if (filters.freeOnly && t.access_type !== "free") return false;
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

  const pins = filtered.map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, score: t.overall_score }));

  return (
    <>
      <div className="topbar">
        <span
          style={{
            flex: 1,
            border: "1.5px solid var(--border-strong)",
            borderRadius: 4,
            padding: "6px 9px",
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "text",
          }}
          onClick={() => navigate("/search")}
        >
          Search a place or venue
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "8px 10px 0", overflowX: "auto" }}>
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
        <span
          className={`chip ${filters.minScore >= 80 ? "on" : ""}`}
          onClick={() => setFiltersOpen(true)}
        >
          Filters
        </span>
      </div>

      <div style={{ flex: "0 0 220px", position: "relative", margin: "8px 10px 0" }}>
        <MapView
          pins={pins}
          center={center}
          onPinClick={(id) => navigate(`/t/${id}`)}
          onGpsClick={() => locateDevice().then(setCenter).catch(() => {})}
          className="map"
        />
        <span
          onClick={() => navigate("/add")}
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            background: "var(--surface-accent)",
            color: "#fff",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          + Add
        </span>
      </div>

      <div className="screen-body" style={{ paddingTop: 10 }}>
        {toilets && withDistance.length === 0 && (
          <div className="center-empty">
            <b style={{ color: "var(--text-primary)" }}>Nobody has mapped this area yet.</b>
            <button className="btn" style={{ width: "auto", padding: "11px 20px" }} onClick={() => navigate("/add")}>
              Add the first toilet here
            </button>
          </div>
        )}
        {withDistance.map(({ t, d }) => (
          <ToiletCard key={t.id} toilet={t} distanceMeters={d} />
        ))}
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
