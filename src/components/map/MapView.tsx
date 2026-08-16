import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scoreColor } from "../../lib/score";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  score: number | null;
}

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const BANGKOK = { lat: 13.7563, lng: 100.5018 };

export function MapView({
  pins = [],
  center,
  zoom = 14,
  onPinClick,
  draggableMarker,
  onDraggableMarkerMove,
  onGpsClick,
  className,
}: {
  pins?: MapPin[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onPinClick?: (id: string) => void;
  draggableMarker?: { lat: number; lng: number };
  onDraggableMarkerMove?: (pos: { lat: number; lng: number }) => void;
  onGpsClick?: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const dragMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const c = center ?? BANGKOK;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: [c.lng, c.lat],
      zoom,
      attributionControl: false,
    });
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
      el.style.padding = "4px 7px";
      el.style.borderRadius = "999px";
      el.style.border = "1.5px solid rgba(255,255,255,.8)";
      el.style.boxShadow = "0 1px 3px rgba(0,0,0,.3)";
      el.style.cursor = "pointer";
      el.textContent = pin.score == null ? "–" : String(pin.score);
      el.addEventListener("click", () => onPinClick?.(pin.id));
      return new Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
    };
  }, [pins, onPinClick]);

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
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}
