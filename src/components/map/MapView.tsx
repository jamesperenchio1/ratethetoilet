import { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scoreColor } from "../../lib/score";
import { CONFIG } from "../../lib/config";

// maplibre-gl resolves its worker via `new URL("./maplibre-gl-worker.mjs", import.meta.url)`,
// which points at our bundle's own URL once bundled, not the package's dist folder — 404s in
// production. /maplibre-assets/ is served/copied verbatim by the maplibreWorkerAssets vite
// plugin (see vite.config.ts) — the worker's own sibling import of maplibre-gl-shared.mjs
// needs that exact unhashed filename to stay next to it.
setWorkerUrl(new URL("/maplibre-assets/maplibre-gl-worker.mjs", window.location.origin).href);

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  score: number | null;
  /** Venue name shown on the pin (when the pin represents a grouped venue). */
  label?: string | null;
  /** Number of toilets collapsed into this pin. */
  count?: number;
}

const OPENFREEMAP_STYLE = CONFIG.map.tileStyleUrl;
const BANGKOK = CONFIG.map.defaultCenter;
const MAX_ZOOM = CONFIG.map.maxZoom;
const PIN_SPREAD_THRESHOLD_PX = CONFIG.map.pinSpreadThresholdPx;
const PIN_SPREAD_STEP_PX = CONFIG.map.pinSpreadStepPx;

/** Live MapLibre instances (+ their marker-by-id maps) keyed by `cacheKey`,
 * kept alive across unmount instead of torn down with `map.remove()`. React
 * Router unmounts a route's whole tree on navigation, so without this,
 * bouncing between the map screen and a detail page rebuilds the WebGL
 * context, re-parses the style, and re-adds every marker every single time —
 * the "reloads every time I swap pages" complaint. Reusing the instance and
 * just re-parenting its (still-live) container div into the new mount makes
 * a return visit instant. Only opt in a MapView that's genuinely revisited
 * often (Home) — a one-shot picker map has nothing to gain from this. */
const mapCache = new Map<
  string,
  { map: MaplibreMap; markersMap: Map<string, Marker>; dragMarker: Marker | null }
>();

// Spread overlapping pins out into a ring so toilets that are close together
// (e.g. pins within a couple of houses of each other) stay individually
// tappable instead of stacking on the same screen pixel. Pins within
// PIN_SPREAD_THRESHOLD_PX screen-pixels of each other form a cluster; each
// cluster is fanned out on a circle whose radius grows with cluster size.
function applyPinSpread(map: MaplibreMap, markers: Marker[], pins: MapPin[]): void {
  if (pins.length === 0 || markers.length !== pins.length) return;
  const pos = pins.map((p) => map.project([p.lng, p.lat]));

  // Union-find to cluster pins whose screen positions are within the threshold.
  const parent = pins.map((_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const thresholdSq = PIN_SPREAD_THRESHOLD_PX * PIN_SPREAD_THRESHOLD_PX;

  // Bucket pins into a grid of threshold-sized cells so we only pairwise-compare
  // pins that could plausibly be within the threshold of each other (their own
  // cell + the 8 neighbors), instead of every pin against every other pin.
  // Degrades to the old O(n^2) only if most pins land in one cell, which is
  // exactly the case where n is small anyway (it's a spread cluster).
  const grid = new Map<string, number[]>();
  pos.forEach((p, i) => {
    const key = `${Math.floor(p.x / PIN_SPREAD_THRESHOLD_PX)},${Math.floor(p.y / PIN_SPREAD_THRESHOLD_PX)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  });
  pos.forEach((p, i) => {
    const cx = Math.floor(p.x / PIN_SPREAD_THRESHOLD_PX);
    const cy = Math.floor(p.y / PIN_SPREAD_THRESHOLD_PX);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighbors = grid.get(`${cx + dx},${cy + dy}`);
        if (!neighbors) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const ddx = pos[i].x - pos[j].x;
          const ddy = pos[i].y - pos[j].y;
          if (ddx * ddx + ddy * ddy <= thresholdSq) union(i, j);
        }
      }
    }
  });

  const clusters = new Map<number, number[]>();
  pos.forEach((_, i) => {
    const root = find(i);
    const members = clusters.get(root) ?? [];
    members.push(i);
    clusters.set(root, members);
  });

  for (const members of clusters.values()) {
    if (members.length === 1) {
      markers[members[0]].setOffset([0, 0]);
      continue;
    }
    const n = members.length;
    const cx = members.reduce((s, m) => s + pos[m].x, 0) / n;
    const cy = members.reduce((s, m) => s + pos[m].y, 0) / n;
    const radius = Math.max(
      PIN_SPREAD_THRESHOLD_PX / 2 + 12,
      (n * PIN_SPREAD_STEP_PX) / (2 * Math.PI)
    );
    members.sort(
      (a, b) =>
        Math.atan2(pos[a].y - cy, pos[a].x - cx) - Math.atan2(pos[b].y - cy, pos[b].x - cx)
    );
    members.forEach((m, k) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / n;
      const tx = cx + radius * Math.cos(angle);
      const ty = cy + radius * Math.sin(angle);
      markers[m].setOffset([tx - pos[m].x, ty - pos[m].y]);
    });
  }
}

export function MapView({
  pins = [],
  center,
  zoom = 14,
  onPinClick,
  draggableMarker,
  onDraggableMarkerMove,
  onGpsClick,
  className,
  fitToPins = false,
  maxZoom = MAX_ZOOM,
  cacheKey,
  userLocation,
}: {
  pins?: MapPin[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onPinClick?: (id: string) => void;
  draggableMarker?: { lat: number; lng: number };
  onDraggableMarkerMove?: (pos: { lat: number; lng: number }) => void;
  onGpsClick?: () => void;
  className?: string;
  /** On first pin render, zoom the map out to frame every pin. */
  fitToPins?: boolean;
  /** Cap for programmatic zoom (easeTo/fitBounds); manual pinch can go higher. */
  maxZoom?: number;
  /** Keeps the underlying MapLibre instance alive across unmount/remount
   * (e.g. navigating away and back) instead of recreating it — reuse is
   * keyed by this string, so give every persistently-revisited map its own
   * stable key. Omit for a map that's only ever shown once per flow. */
  cacheKey?: string;
  /** The device's live position, drawn as a GPS dot (+ heading cone if known). */
  userLocation?: { lat: number; lng: number; heading?: number | null } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markersMapRef = useRef<Map<string, Marker>>(new Map());
  const pinsRef = useRef<MapPin[]>([]);
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);
  const dragMarkerRef = useRef<Marker | null>(null);
  const onDragMoveRef = useRef(onDraggableMarkerMove);
  useEffect(() => {
    onDragMoveRef.current = onDraggableMarkerMove;
  }, [onDraggableMarkerMove]);
  const userMarkerRef = useRef<Marker | null>(null);
  const userConeRef = useRef<HTMLDivElement | null>(null);
  const fitDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    // rAF-throttled: "move" fires on every pan/zoom frame, and re-clustering
    // on each one is wasted work once a frame is already queued.
    let rafId: number | null = null;
    let map: MaplibreMap;

    const cached = cacheKey ? mapCache.get(cacheKey) : undefined;
    const spread = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        applyPinSpread(map, markersRef.current, pinsRef.current);
      });
    };

    if (cached) {
      map = cached.map;
      markersMapRef.current = cached.markersMap;
      dragMarkerRef.current = cached.dragMarker;
      // MapLibre uses the element passed as `container` *directly* as its own
      // container (not an inner child) — so on a genuine remount (a new
      // `containerRef.current` div) this reparents the map's existing
      // container into it, but React's dev-only StrictMode mount→unmount→
      // remount cycle reuses the very same DOM node both times, where
      // `map.getContainer()` already *is* `containerRef.current` — appending
      // a node to itself throws HierarchyRequestError. Skip the no-op case.
      if (map.getContainer() !== containerRef.current) {
        containerRef.current.appendChild(map.getContainer());
        // The container was just re-parented (possibly at a different size
        // than last time) — MapLibre caches canvas dimensions and won't
        // notice on its own. requestAnimationFrame so layout has settled first.
        requestAnimationFrame(() => map.resize());
      }
      map.on("move", spread);
      mapRef.current = map;
      setLoading(false);
      applyPinSpread(map, markersRef.current, pinsRef.current);
    } else {
      const c = center ?? BANGKOK;
      try {
        map = new MaplibreMap({
          container: containerRef.current,
          style: OPENFREEMAP_STYLE,
          center: [c.lng, c.lat],
          zoom,
          attributionControl: false,
        });
      } catch {
        // e.g. a device/browser without WebGL2 — don't take the whole screen down.
        setLoading(false);
        setFailed(true);
        return;
      }
      map.on("move", spread);
      map.once("load", () => {
        setLoading(false);
        applyPinSpread(map, markersRef.current, pinsRef.current);
      });
      mapRef.current = map;
      if (cacheKey) {
        mapCache.set(cacheKey, { map, markersMap: markersMapRef.current, dragMarker: null });
      }
    }

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      map.off("move", spread);
      mapRef.current = null;
      if (!cacheKey) {
        map.remove();
        markersMapRef.current.clear();
      }
      // A cached map is deliberately left running (container just gets
      // detached along with the rest of this component's DOM) so the next
      // mount under the same key can reattach it instantly.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: Math.min(map.getZoom(), maxZoom),
      duration: 400,
    });
  }, [center?.lat, center?.lng, maxZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function labelFor(pin: MapPin): string {
      if (pin.label) {
        const parts = [pin.label];
        if (pin.count && pin.count > 1) parts.push(String(pin.count));
        if (pin.score != null) parts.push(String(pin.score));
        return parts.join(" · ");
      }
      return pin.score == null ? "–" : String(pin.score);
    }

    function styleEl(el: HTMLDivElement, pin: MapPin) {
      el.style.background = scoreColor(pin.score);
      el.style.color = "#fff";
      el.style.font = "600 11px 'IBM Plex Mono', monospace";
      el.style.padding = "4px 8px";
      el.style.borderRadius = "999px";
      el.style.border = "1.5px solid rgba(255,255,255,.8)";
      el.style.boxShadow = "0 1px 3px rgba(0,0,0,.3)";
      el.style.cursor = "pointer";
      el.style.maxWidth = "180px";
      el.style.overflow = "hidden";
      el.style.textOverflow = "ellipsis";
      el.style.whiteSpace = "nowrap";
      el.textContent = labelFor(pin);
      el.setAttribute(
        "aria-label",
        `${pin.label ? pin.label + ", " : ""}${pin.score == null ? "unrated" : `score ${pin.score}`}`
      );
    }

    // Diff against the existing marker set instead of tearing every marker
    // down and recreating it on each change — filter toggles etc. used to
    // rebuild the whole DOM set even when most pins were unchanged.
    const existing = markersMapRef.current;
    const nextIds = new Set(pins.map((p) => p.id));
    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }
    for (const pin of pins) {
      const current = existing.get(pin.id);
      if (current) {
        current.setLngLat([pin.lng, pin.lat]);
        styleEl(current.getElement() as HTMLDivElement, pin);
        continue;
      }
      const el = document.createElement("div");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      styleEl(el, pin);
      const activate = () => onPinClickRef.current?.(pin.id);
      el.addEventListener("click", activate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
      existing.set(
        pin.id,
        new Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map)
      );
    }

    markersRef.current = pins.map((p) => existing.get(p.id)!);
    pinsRef.current = pins;
    applyPinSpread(map, markersRef.current, pins);
    if (fitToPins && !fitDoneRef.current && pins.length > 0) {
      const bounds = new LngLatBounds();
      pins.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, duration: 500, maxZoom });
      fitDoneRef.current = true;
    }
  }, [pins, fitToPins, maxZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (dragMarkerRef.current) {
      dragMarkerRef.current.remove();
      dragMarkerRef.current = null;
    }
    if (!draggableMarker) {
      if (cacheKey) mapCache.get(cacheKey)!.dragMarker = null;
      return;
    }
    const marker = new Marker({
      draggable: true,
      color: "#0B5FA5",
    })
      .setLngLat([draggableMarker.lng, draggableMarker.lat])
      .addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onDragMoveRef.current?.({ lat: pos.lat, lng: pos.lng });
    });
    dragMarkerRef.current = marker;
    if (cacheKey) mapCache.get(cacheKey)!.dragMarker = marker;
  }, [draggableMarker?.lat, draggableMarker?.lng, cacheKey]);

  // Live "you are here" GPS dot (+ heading cone when the device reports one).
  // Kept separate from the drag marker so a user pin never collides with a
  // toilet pin the user is dragging.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    userConeRef.current = null;
    if (!userLocation) return;

    const el = document.createElement("div");
    el.style.width = "0";
    el.style.height = "0";
    el.style.pointerEvents = "none";

    const ring = document.createElement("div");
    ring.style.cssText = [
      "position:absolute",
      "left:-16px",
      "top:-16px",
      "width:32px",
      "height:32px",
      "border-radius:50%",
      "background:rgba(11,95,165,.18)",
    ].join(";");

    const dot = document.createElement("div");
    dot.style.cssText = [
      "position:absolute",
      "left:-6px",
      "top:-6px",
      "width:12px",
      "height:12px",
      "border-radius:50%",
      "background:#0B5FA5",
      "border:2px solid #fff",
      "box-shadow:0 0 0 1px rgba(11,95,165,.6),0 1px 3px rgba(0,0,0,.4)",
    ].join(";");

    el.appendChild(ring);
    el.appendChild(dot);

    if (userLocation.heading != null) {
      const cone = document.createElement("div");
      cone.style.cssText = [
        "position:absolute",
        "left:-7px",
        "top:-16px",
        "width:0",
        "height:0",
        "border-left:7px solid transparent",
        "border-right:7px solid transparent",
        "border-bottom:16px solid rgba(11,95,165,.55)",
        "transform-origin:50% 100%",
        `transform:rotate(${userLocation.heading}deg)`,
      ].join(";");
      el.appendChild(cone);
      userConeRef.current = cone;
    }

    userMarkerRef.current = new Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
        userConeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    if (!userConeRef.current || userLocation?.heading == null) return;
    userConeRef.current.style.transform = `rotate(${userLocation.heading}deg)`;
  }, [userLocation?.heading]);

  return (
    <div className={className} style={{ position: "relative", flex: 1, minHeight: 140 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--map-land)",
            color: "var(--text-muted)",
            fontSize: 12,
            padding: 12,
            textAlign: "center",
          }}
        >
          Map unavailable on this device.
        </div>
      )}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--map-land)",
            color: "var(--text-muted)",
            fontSize: 12,
            zIndex: 1,
          }}
        >
          Loading map…
        </div>
      )}
      {onGpsClick && (
        <button
          onClick={onGpsClick}
          aria-label="Center map on my location"
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            border: "1.5px solid var(--border-strong)",
            background: "#fff",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          GPS
        </button>
      )}
    </div>
  );
}

export function locateDevice(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not available"));
      return;
    }
    const attempt = (enableHighAccuracy: boolean) =>
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          if (enableHighAccuracy) attempt(false);
          else reject(err);
        },
        {
          enableHighAccuracy,
          timeout: CONFIG.map.geolocationTimeoutMs,
          maximumAge: enableHighAccuracy ? 0 : 60000,
        }
      );
    attempt(true);
  });
}

export interface DeviceLocation {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number | null;
}

/**
 * Continuously tracks the device's position with `watchPosition`, so it keeps
 * delivering fixes even when the initial one-shot call raced a permission
 * grant or timed out. Returns null until the first fix arrives; the heading is
 * null when the device has no compass.
 */
export function useDeviceLocation(): DeviceLocation | null {
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    let cancelled = false;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        setLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          accuracy: pos.coords.accuracy ?? null,
        });
      },
      () => {
        // Permission denied or no fix yet — keep watching; callbacks resume
        // once the user grants access. The caller decides what to render.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(id);
    };
  }, []);
  return loc;
}
