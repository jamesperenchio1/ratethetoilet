import { emptyDraft, emptyFloorEntry, type FloorEntry, type ToiletDraft } from "./types";
import { CONFIG } from "../../lib/config";

const STORAGE_KEY = CONFIG.storage.draftKey;

export type PersistableStep =
  | "photos"
  | "location"
  | "venue"
  | "scores"
  | "hint"
  | "floor-photos"
  | "floor-scores"
  | "floor-hint";

/**
 * File objects can't survive JSON serialization, so uploaded photos are kept
 * (they have a storagePath the API can render a preview from) and anything
 * still mid-upload — which has no file to resume from after a reload — is
 * dropped rather than shown as permanently stuck.
 */
function sanitizeEntry(e: FloorEntry): FloorEntry {
  return {
    ...e,
    photos: e.photos
      .filter((p) => p.status === "done" && p.storagePath)
      .map((p) => ({ ...p, file: null })),
  };
}

export function saveWizardState(
  step: PersistableStep,
  draft: ToiletDraft,
  floorIdx = 0
) {
  try {
    const serializable = {
      step,
      floorIdx,
      draft: {
        ...draft,
        primary: sanitizeEntry(draft.primary),
        additionalFloors: draft.additionalFloors.map(sanitizeEntry),
      },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Storage full or unavailable (private browsing) — losing autosave beats crashing.
  }
}

export function loadWizardState(): {
  step: PersistableStep;
  draft: ToiletDraft;
  floorIdx: number;
} | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      step: PersistableStep;
      floorIdx?: number;
      draft: Partial<ToiletDraft> & {
        primary?: Partial<FloorEntry>;
        additionalFloors?: Partial<FloorEntry>[];
      };
    };
    const base = emptyDraft();
    const additionalFloors = (parsed.draft?.additionalFloors ?? []).map((e) => ({
      ...emptyFloorEntry(),
      ...e,
    }));
    const floorIdx = Math.min(
      Math.max(parsed.floorIdx ?? 0, 0),
      Math.max(additionalFloors.length - 1, 0)
    );
    return {
      step: parsed.step,
      floorIdx,
      draft: {
        ...base,
        ...parsed.draft,
        primary: { ...emptyFloorEntry(), ...(parsed.draft?.primary ?? {}) },
        additionalFloors,
      },
    };
  } catch {
    return null;
  }
}

export function clearWizardState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
