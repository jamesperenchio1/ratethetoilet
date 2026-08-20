import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchToilets } from "../lib/api";
import type { Toilet } from "../lib/types";
import { accessTypesLabel, venueTypesLabel } from "../lib/labels";
import { searchPlaces, type GeocodeResult } from "../lib/geocode";
import { get, set } from "idb-keyval";
import { CONFIG } from "../lib/config";

const RECENTS_KEY = CONFIG.storage.recentsKey;

export function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const near = (location.state as { center?: { lat: number; lng: number } } | null)?.center;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Toilet[]>([]);
  const [places, setPlaces] = useState<GeocodeResult[]>([]);
  const [placesSearching, setPlacesSearching] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
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
                <div className="lbl">Your toilets</div>
                {results.map((t) => (
                  <div
                    key={t.id}
                    className="box"
                    onClick={() => navigate(`/t/${t.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    {t.venue_name || venueTypesLabel(t.venue_types) || "Toilet"}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {venueTypesLabel(t.venue_types)} · {accessTypesLabel(t.access_types)}
                    </span>
                  </div>
                ))}
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
