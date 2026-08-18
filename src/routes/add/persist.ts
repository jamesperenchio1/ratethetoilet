import { emptyDraft, type ToiletDraft } from "./types";

const STORAGE_KEY = "toilet-draft:v1";

export type PersistableStep = "photos" | "location" | "venue" | "scores" | "hint";

interface PersistedState {
  step: PersistableStep;
  draft: ToiletDraft;
}

/**
 * File objects can't survive JSON serialization, so uploaded photos are kept
 * (they have a storagePath the API can render a preview from) and anything
 * still mid-upload — which has no file to resume from after a reload — is
 * dropped rather than shown as permanently stuck.
 */
export function saveWizardState(step: PersistableStep, draft: ToiletDraft) {
  try {
    const serializable: PersistedState = {
      step,
      draft: {
        ...draft,
        photos: draft.photos
          .filter((p) => p.status === "done" && p.storagePath)
          .map((p) => ({ ...p, file: null })),
      },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Storage full or unavailable (private browsing) — losing autosave beats crashing.
  }
}

export function loadWizardState(): { step: PersistableStep; draft: ToiletDraft } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      step: parsed.step,
      draft: { ...emptyDraft(), ...parsed.draft },
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
