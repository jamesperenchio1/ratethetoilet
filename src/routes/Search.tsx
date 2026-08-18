import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchToilets } from "../lib/api";
import type { Toilet } from "../lib/types";
import { ACCESS_LABELS, VENUE_LABELS } from "../lib/labels";
import { get, set } from "idb-keyval";
import { CONFIG } from "../lib/config";

const RECENTS_KEY = CONFIG.storage.recentsKey;

export function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Toilet[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    get(RECENTS_KEY).then((r) => setRecents(r ?? []));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchToilets(query.trim()).then(setResults);
    }, CONFIG.search.debounceMs);
    return () => clearTimeout(t);
  }, [query]);

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
            <div className="lbl">Places</div>
            {results.map((t) => (
              <div
                key={t.id}
                className="box"
                onClick={() => navigate(`/t/${t.id}`)}
                style={{ cursor: "pointer" }}
              >
                {t.venue_name || VENUE_LABELS[t.venue_type]}
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {VENUE_LABELS[t.venue_type]} · {ACCESS_LABELS[t.access_type]}
                </span>
              </div>
            ))}
            {results.length === 0 && (
              <div className="box dashed" onClick={() => navigate("/add")}>
                No toilet here yet — add the first one
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
