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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const dragMarkerRef = useRef<Marker | null>(null);
  const fitDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const c = center ?? BANGKOK;
    let map: MaplibreMap;
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
    map.once("load", () => setLoading(false));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.easeTo({ center: [center.lng, center.lat], duration: 400 });
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map((pin) => {
      const el = document.createElement("div");
      el.style.background = scoreColor(pin.score);
      el.style.color = "#fff";
      el.style.font = "600 11px 'IBM Plex Mono', monospace";
      el.style.padding = "4px 8px";
      el.style.borderRadius = "999px";
      el.style.border = "1.5px solid rgba(255,255,255,.8)";
      el.style.boxShadow = "0 1px 3px rgba(0,0,0,.3)";
      el.style.cursor = "pointer";
      el.style.maxWidth = "150px";
      el.style.overflow = "hidden";
      el.style.textOverflow = "ellipsis";
      el.style.whiteSpace = "nowrap";
      if (pin.label) {
        el.textContent = pin.count && pin.count > 1 ? `${pin.label} · ${pin.count}` : pin.label;
      } else {
        el.textContent = pin.score == null ? "–" : String(pin.score);
      }
      el.addEventListener("click", () => onPinClick?.(pin.id));
      return new Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    });
    if (fitToPins && !fitDoneRef.current && pins.length > 0) {
      const bounds = new LngLatBounds();
      pins.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, duration: 500 });
      fitDoneRef.current = true;
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
    };
  }, [pins, onPinClick, fitToPins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (dragMarkerRef.current) {
      dragMarkerRef.current.remove();
      dragMarkerRef.current = null;
    }
    if (!draggableMarker) return;
    const marker = new Marker({
      draggable: true,
      color: "#0B5FA5",
    })
      .setLngLat([draggableMarker.lng, draggableMarker.lat])
      .addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onDraggableMarkerMove?.({ lat: pos.lat, lng: pos.lng });
    });
    dragMarkerRef.current = marker;
  }, [draggableMarker?.lat, draggableMarker?.lng, onDraggableMarkerMove]);

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
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: CONFIG.map.geolocationTimeoutMs }
    );
  });
}
