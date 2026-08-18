import type { AccessType, TriState, VenueType } from "../../lib/types";

export interface PendingPhoto {
  localId: string;
  // Absent after a draft is restored from persisted storage (File objects
  // can't survive serialization) — the storagePath is used for preview instead.
  file: File | null;
  storagePath: string | null;
  status: "uploading" | "done" | "error";
}

export interface ToiletDraft {
  draftId: string;
  photos: PendingPhoto[];
  lat: number | null;
  lng: number | null;
  locationSource: "gps" | "search" | "manual" | null;
  venueName: string | null;
  venueType: VenueType | null;
  accessType: AccessType | null;
  supplies: string[];
  wheelchair: TriState | null;
  cleanliness: number;
  smell: number;
  privacy: number;
  hintChips: string[];
  hintNote: string;
}

export const DEFAULT_SCORE = 50;

export function emptyDraft(): ToiletDraft {
  return {
    draftId: crypto.randomUUID(),
    photos: [],
    lat: null,
    lng: null,
    locationSource: null,
    venueName: null,
    venueType: null,
    accessType: null,
    supplies: [],
    wheelchair: null,
    cleanliness: DEFAULT_SCORE,
    smell: DEFAULT_SCORE,
    privacy: DEFAULT_SCORE,
    hintChips: [],
    hintNote: "",
  };
}
