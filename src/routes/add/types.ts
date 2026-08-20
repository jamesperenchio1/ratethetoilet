import type { TriState } from "../../lib/types";
import { CONFIG } from "../../lib/config";

export interface PendingPhoto {
  localId: string;
  // Absent after a draft is restored from persisted storage (File objects
  // can't survive serialization) — the storagePath is used for preview instead.
  file: File | null;
  storagePath: string | null;
  status: "uploading" | "done" | "error";
  errorMessage?: string;
  /** Non-blocking heads-up (e.g. "couldn't compress this photo") — the
   * upload still proceeds, this is just a UX signal, not a failure. */
  warning?: string;
}

/** One toilet's per-floor data. The primary submission is an entry too — a
 * single-restroom add is just a draft whose `additionalFloors` is empty. */
export interface FloorEntry {
  entryId: string;
  floorLabel: string | null;
  photos: PendingPhoto[];
  cleanliness: number;
  smell: number;
  privacy: number;
  wheelchair: TriState | null;
  hintChips: string[];
  hintNote: string;
  review: string;
}

export function emptyFloorEntry(floorLabel: string | null = null): FloorEntry {
  const d = CONFIG.wizard.defaultScore;
  return {
    entryId: crypto.randomUUID(),
    floorLabel,
    photos: [],
    cleanliness: d,
    smell: d,
    privacy: d,
    wheelchair: null,
    hintChips: [],
    hintNote: "",
    review: "",
  };
}

export interface ToiletDraft {
  draftId: string;
  primary: FloorEntry;
  additionalFloors: FloorEntry[];
  multiFloor: boolean;
  lat: number | null;
  lng: number | null;
  locationSource: "gps" | "search" | "manual" | null;
  venueTypes: string[];
  venueName: string | null;
  /** Resolved venue id (null = create a new venue on submit). */
  venueId: string | null;
  accessTypes: string[];
  supplies: string[];
}

export function emptyDraft(): ToiletDraft {
  return {
    draftId: crypto.randomUUID(),
    primary: emptyFloorEntry(),
    additionalFloors: [],
    multiFloor: false,
    lat: null,
    lng: null,
    locationSource: null,
    venueTypes: [],
    venueName: null,
    venueId: null,
    accessTypes: [],
    supplies: [],
  };
}
