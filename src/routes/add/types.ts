import type { AccessType, TriState, VenueType } from "../../lib/types";

export interface PendingPhoto {
  localId: string;
  file: File;
  storagePath: string | null;
  status: "uploading" | "done" | "error";
}

export interface ToiletDraft {
  draftId: string;
  photos: PendingPhoto[];
  lat: number | null;
  lng: number | null;
  locationSource: "gps" | "search" | "manual" | null;
  venueType: VenueType | null;
  accessType: AccessType | null;
  supplies: string[];
  wheelchair: TriState | null;
  cleanliness: number | null;
  smell: number | null;
  privacy: number | null;
  hintChips: string[];
  hintNote: string;
}

export function emptyDraft(): ToiletDraft {
  return {
    draftId: crypto.randomUUID(),
    photos: [],
    lat: null,
    lng: null,
    locationSource: null,
    venueType: null,
    accessType: null,
    supplies: [],
    wheelchair: null,
    cleanliness: null,
    smell: null,
    privacy: null,
    hintChips: [],
    hintNote: "",
  };
}
