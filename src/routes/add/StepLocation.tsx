import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { MapView, locateDevice } from "../../components/map/MapView";
import type { ToiletDraft } from "./types";

export function StepLocation({
  draft,
  onChange,
  onNext,
}: {
  draft: ToiletDraft;
  onChange: Dispatch<SetStateAction<ToiletDraft>>;
  onNext: () => void;
}) {
  useEffect(() => {
    if (draft.lat != null) return;
    locateDevice()
      .then((pos) =>
        onChange((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, locationSource: "gps" }))
      )
      .catch(() => {
        onChange((prev) => ({ ...prev, lat: 13.7563, lng: 100.5018, locationSource: "manual" }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen-body" style={{ padding: 0 }}>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div className="stepper">
          <i className="done" />
          <i className="done" />
          <i />
          <i />
          <i />
        </div>

        <MapView
          className="map"
          center={draft.lat != null ? { lat: draft.lat, lng: draft.lng! } : undefined}
          draggableMarker={draft.lat != null ? { lat: draft.lat, lng: draft.lng! } : undefined}
          onDraggableMarkerMove={(pos) =>
            onChange((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, locationSource: "manual" }))
          }
          onGpsClick={() =>
            locateDevice().then((pos) =>
              onChange((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, locationSource: "gps" }))
            )
          }
        />

        <div className="box" style={{ fontSize: 11 }}>
          <span className="num">
            {draft.lat != null ? `${draft.lat.toFixed(4)}, ${draft.lng!.toFixed(4)}` : "Locating…"}
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            {draft.locationSource === "gps" ? "From GPS" : draft.locationSource === "manual" ? "Dragged" : ""}
          </span>
        </div>

        <div className="ann">Already left? Drag the pin to where it was.</div>

        <button className="btn" disabled={draft.lat == null} onClick={onNext}>
          Pin is right
        </button>
      </div>
    </div>
  );
}
