import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchToilets } from "../lib/api";
import type { Toilet } from "../lib/types";
import { haversineMeters } from "../lib/labels";
import { searchPlaces, type GeocodeResult } from "../lib/geocode";
import { get, set } from "idb-keyval";
import { CONFIG } from "../lib/config";
import { ToiletCard } from "../components/toilet/ToiletCard";

const RECENTS_KEY = CONFIG.storage.recentsKey;
const MIN_SCORE_OPTIONS = [60, 75, 80];

interface Filters {
  access: Set<string>;
  wheelchair: boolean;
  minScore: number | null;
  venueTypes: Set<string>;
  sort: "nearest" | "top";
}

const EMPTY_FILTERS: Filters = {
  access: new Set(),
  wheelchair: false,
  minScore: null,
  venueTypes: new Set(),
  sort: "nearest",
};

export function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const near = (location.state as { center?: { lat: number; lng: number } } | null)?.center;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Toilet[]>([]);
  const [places, setPlaces] = useState<GeocodeResult[]>([]);
  const [placesSearching, setPlacesSearching] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const placesAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    get(RECENTS_KEY).then((r) => setRecents(r ?? []));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setPlaces([]);
      setPlacesSearching(false);
      return;
    }
    placesAbort.current?.abort();
    const controller = new AbortController();
    placesAbort.current = controller;
    setPlacesSearching(true);
    const t = setTimeout(() => {
      searchToilets(query.trim()).then(setResults);
      searchPlaces(query.trim(), { near, signal: controller.signal })
        .then(setPlaces)
        .finally(() => setPlacesSearching(false));
    }, CONFIG.search.debounceMs);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasActiveFilters =
    filters.access.size > 0 ||
    filters.wheelchair ||
    filters.minScore != null ||
    filters.venueTypes.size > 0 ||
    filters.sort !== "nearest";

  const center = near ?? CONFIG.map.defaultCenter;

  const filtered = useMemo(() => {
    let out = results.filter((t) => {
      if (filters.access.size > 0 && !t.access_types.some((a) => filters.access.has(a))) return false;
      if (filters.wheelchair && t.wheelchair !== "yes") return false;
      if (filters.minScore != null && (t.overall_score == null || t.overall_score < filters.minScore)) return false;
      if (filters.venueTypes.size > 0 && !t.venue_types.some((v) => filters.venueTypes.has(v))) return false;
      return true;
    });
    if (filters.sort === "top") {
      out = out
        .slice()
        .sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
    } else {
      out = out
        .slice()
        .sort((a, b) => haversineMeters(center, { lat: a.lat, lng: a.lng }) - haversineMeters(center, { lat: b.lat, lng: b.lng }));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, filters]);

  function toggleAccess(key: string) {
    setFilters((f) => {
      const next = new Set(f.access);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, access: next };
    });
  }

  function toggleVenue(key: string) {
    setFilters((f) => {
      const next = new Set(f.venueTypes);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, venueTypes: next };
    });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function pickPlace(p: GeocodeResult) {
    commitSearch();
    navigate("/", { state: { center: { lat: p.lat, lng: p.lng }, marker: { lat: p.lat, lng: p.lng, name: p.name } } });
  }

  async function commitSearch() {
    if (!query.trim()) return;
    const next = [query.trim(), ...recents.filter((r) => r !== query.trim())].slice(0, CONFIG.storage.recentsMax);
    setRecents(next);
    await set(RECENTS_KEY, next);
  }

  return (
    <>
      <div className="topbar">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitSearch()}
          placeholder="Search a place or venue"
          style={{
            flex: 1,
            border: "1.5px solid var(--chart-4)",
            borderRadius: 4,
            padding: "6px 9px",
            fontSize: 13,
          }}
        />
        <span style={{ fontSize: 12, cursor: "pointer" }} onClick={() => navigate(-1)}>
          Cancel
        </span>
      </div>
      <div className="screen-body">
        {query.trim().length >= 2 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, flex: "0 0 auto" }}>
            <div
              className={filters.access.has("free") ? "chip on" : "chip"}
              onClick={() => toggleAccess("free")}
            >
              Free
            </div>
            <div
              className={filters.access.has("paid") ? "chip on" : "chip"}
              onClick={() => toggleAccess("paid")}
            >
              Paid
            </div>
            <div
              className={filters.wheelchair ? "chip on" : "chip"}
              onClick={() => setFilters((f) => ({ ...f, wheelchair: !f.wheelchair }))}
            >
              ♿ Wheelchair
            </div>
            {MIN_SCORE_OPTIONS.map((s) => (
              <div
                key={s}
                className={filters.minScore === s ? "chip on" : "chip"}
                onClick={() => setFilters((f) => ({ ...f, minScore: f.minScore === s ? null : s }))}
              >
                {s}+
              </div>
            ))}
            {Object.entries(CONFIG.labels.venue).map(([key, label]) => (
              <div
                key={key}
                className={filters.venueTypes.has(key) ? "chip on" : "chip"}
                onClick={() => toggleVenue(key)}
              >
                {label}
              </div>
            ))}
            <div
              className={filters.sort === "top" ? "chip on" : "chip"}
              onClick={() => setFilters((f) => ({ ...f, sort: f.sort === "top" ? "nearest" : "top" }))}
            >
              {filters.sort === "top" ? "Top rated" : "Nearest"}
            </div>
          </div>
        )}

        {query.trim().length < 2 && recents.length > 0 && (
          <>
            <div className="lbl">Recent</div>
            {recents.map((r) => (
              <div key={r} className="box dashed" onClick={() => setQuery(r)}>
                {r}
              </div>
            ))}
          </>
        )}
        {query.trim().length >= 2 && (
          <>
            {results.length > 0 && (
              <>
                <div className="lbl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Your toilets</span>
                  {hasActiveFilters && (
                    <span
                      style={{ fontSize: 11, color: "var(--chart-4)", cursor: "pointer", textTransform: "none" }}
                      onClick={clearFilters}
                    >
                      Clear filters
                    </span>
                  )}
                </div>
                {filtered.length > 0 &&
                  filtered.map((t) => <ToiletCard key={t.id} toilet={t} distanceMeters={haversineMeters(center, { lat: t.lat, lng: t.lng })} />)}
                {filtered.length === 0 && (
                  <div className="box dashed">
                    No toilets match your filters
                    <button className="btn2" style={{ width: "auto", padding: "8px 16px", marginTop: 8 }} onClick={clearFilters}>
                      Clear filters
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="lbl">Places</div>
            {placesSearching && places.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 6 }}>Searching…</div>
            )}
            {places.map((p) => (
              <div key={p.id} className="box" onClick={() => pickPlace(p)} style={{ cursor: "pointer" }}>
                <b>{p.name}</b>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.displayName}</span>
              </div>
            ))}
            {!placesSearching && results.length === 0 && places.length === 0 && (
              <div className="box dashed" onClick={() => navigate("/add")}>
                Nothing found — add a toilet
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
