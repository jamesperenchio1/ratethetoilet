import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../../components/layout/TopBar";
import { useIdentity } from "../../components/IdentityGateProvider";
import { canPost, createToilet, attachDraftPhotos, findOrCreateVenue, addReview, type NewToiletInput } from "../../lib/api";
import { enqueuePost } from "../../lib/offlineQueue";
import { emptyDraft, type FloorEntry, type ToiletDraft } from "./types";
import { saveWizardState, loadWizardState, clearWizardState, type PersistableStep } from "./persist";
import type { Toilet } from "../../lib/types";
import { StepPhotos } from "./StepPhotos";
import { StepLocation } from "./StepLocation";
import { StepVenue } from "./StepVenue";
import { StepScores } from "./StepScores";
import { StepReview } from "./StepReview";
import { Posted } from "./Posted";
import { RateLimited } from "./RateLimited";

type Step = PersistableStep | "posted" | "rate-limited";
const STEP_LABELS: Partial<Record<Step, string>> = {
  photos: "1/5",
  location: "2/5",
  venue: "3/5",
  scores: "4/5",
  review: "5/5",
};
const STEP_ORDER: PersistableStep[] = ["photos", "location", "venue", "scores", "review"];

function entryToInput(draft: ToiletDraft, entry: FloorEntry, venueId: string | null): NewToiletInput {
  return {
    lat: draft.lat!,
    lng: draft.lng!,
    venue_types: draft.venueTypes,
    access_types: draft.accessTypes,
    supplies: draft.supplies,
    wheelchair: entry.wheelchair,
    hint_chips: entry.hintChips,
    hint_note: entry.hintNote.trim() || null,
    cleanliness: entry.cleanliness,
    smell: entry.smell,
    privacy: entry.privacy,
    venue_name: draft.venueName?.trim() || null,
    location_source: draft.locationSource,
    floor: entry.floorLabel,
    venue_id: venueId,
  };
}

function floorLabel(entry: FloorEntry): string {
  return entry.floorLabel ?? "primary";
}

export function AddToiletWizard() {
  const navigate = useNavigate();
  const { withIdentity, ensureSession, profile } = useIdentity();
  const restored = loadWizardState();
  const [draft, setDraft] = useState<ToiletDraft>(restored?.draft ?? emptyDraft());
  const [step, setStep] = useState<Step>(restored?.step ?? "photos");
  const [floorIdx, setFloorIdx] = useState(restored?.floorIdx ?? 0);
  const [posted, setPosted] = useState<Toilet | null>(null);
  const [failedFloors, setFailedFloors] = useState<string[]>([]);
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Silent — establishes a device session so draft photos can upload,
    // without minting a handle or showing anything to the user yet.
    ensureSession().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Autosave so an accidental back-swipe (or tab reload) doesn't wipe the draft —
    // only the in-progress steps are worth persisting, not the terminal screens.
    if (step === "posted" || step === "rate-limited") return;
    saveWizardState(step, draft, floorIdx);
  }, [step, draft, floorIdx]);

  function reset() {
    clearWizardState();
    setDraft(emptyDraft());
    setPosted(null);
    setFailedFloors([]);
    setFloorIdx(0);
    setSubmitError(null);
    setStep("photos");
  }

  function updatePrimary(updater: (prev: FloorEntry) => FloorEntry) {
    setDraft((prev) => ({ ...prev, primary: updater(prev.primary) }));
  }

  function updateFloor(idx: number, updater: (prev: FloorEntry) => FloorEntry) {
    setDraft((prev) => ({
      ...prev,
      additionalFloors: prev.additionalFloors.map((f, i) => (i === idx ? updater(f) : f)),
    }));
  }

  function goBack() {
    setSubmitError(null);
    if (step === "floor-scores") {
      setStep("floor-photos");
      return;
    }
    if (step === "floor-review") {
      setStep("floor-scores");
      return;
    }
    if (step === "floor-photos") {
      if (floorIdx === 0) {
        setStep("review");
      } else {
        setFloorIdx((i) => i - 1);
        setStep("floor-review");
      }
      return;
    }
    const i = STEP_ORDER.indexOf(step as PersistableStep);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  }

  function handlePrimaryReviewDone() {
    if (draft.multiFloor && draft.additionalFloors.length > 0) {
      setFloorIdx(0);
      setStep("floor-photos");
    } else {
      submit();
    }
  }

  function handleFloorReviewDone() {
    if (floorIdx + 1 < draft.additionalFloors.length) {
      setFloorIdx((i) => i + 1);
      setStep("floor-photos");
    } else {
      submit();
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (profile) {
        const { allowed, retryAt: r } = await canPost();
        if (!allowed) {
          setRetryAt(r);
          setStep("rate-limited");
          return;
        }
      }

      const entries = [draft.primary, ...draft.additionalFloors];

      // Offline: queue the whole batch with their photos, review and venue, so
      // the flush can attach everything when back online.
      if (!navigator.onLine) {
        const name = (draft.venueName ?? "").trim() || null;
        for (const entry of entries) {
          const input = entryToInput(draft, entry, draft.venueId);
          const storagePaths = entry.photos
            .filter((ph) => ph.status === "done" && ph.storagePath)
            .map((ph) => ph.storagePath as string);
          await enqueuePost("toilet", {
            input,
            storagePaths,
            venueName: name,
            lat: draft.lat!,
            lng: draft.lng!,
            review: entry.review.trim() || null,
          });
        }
        clearWizardState();
        navigate("/");
        return;
      }

      let firstToilet: Toilet | null = null;
      let rateLimited = false;
      const failures: string[] = [];
      await withIdentity(async (p) => {
        // Resolve the venue once for the whole batch: reuse the attached one,
        // or create/reuse by name + proximity.
        let venueId = draft.venueId;
        const name = (draft.venueName ?? "").trim();
        if (name && !venueId) {
          const venue = await findOrCreateVenue(name, draft.lat!, draft.lng!);
          venueId = venue.id;
        }

        for (const entry of entries) {
          if (rateLimited) {
            failures.push(floorLabel(entry));
            continue;
          }
          try {
            const t = await createToilet(p.id, entryToInput(draft, entry, venueId));
            const paths = entry.photos
              .filter((ph) => ph.status === "done" && ph.storagePath)
              .map((ph) => ph.storagePath as string);
            await attachDraftPhotos(p.id, t.id, paths);
            if (entry.review.trim()) {
              await addReview(p.id, t.id, entry.review.trim());
            }
            if (!firstToilet) firstToilet = t;
          } catch (err) {
            if (err instanceof Error && err.message.includes("rate_limit_exceeded")) {
              rateLimited = true;
            }
            failures.push(floorLabel(entry));
          }
        }
      });

      if (!firstToilet) {
        // Nothing saved at all.
        if (rateLimited) {
          setRetryAt(null);
          setStep("rate-limited");
          return;
        }
        throw new Error("All submissions failed");
      }

      // Some floors saved — always land on Posted with an honest failure note,
      // never back on the rate-limited screen (which would imply nothing saved
      // and invite a duplicate re-submit of the whole batch).
      clearWizardState();
      setPosted(firstToilet);
      setFailedFloors(failures);
      setStep("posted");
    } catch (err) {
      console.error(err);
      setSubmitError("Couldn't post right now — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "posted" && posted) {
    return (
      <>
        <TopBar title="Posted" />
        <Posted
          toilet={posted}
          handle={profile?.handle ?? "you"}
          photoPaths={draft.primary.photos
            .filter((p) => p.status === "done" && p.storagePath)
            .map((p) => p.storagePath as string)}
          failedFloors={failedFloors}
          totalFloors={draft.multiFloor ? [draft.primary, ...draft.additionalFloors].length : 0}
          onAddAnother={reset}
        />
      </>
    );
  }

  if (step === "rate-limited") {
    return (
      <>
        <TopBar onClose title="Add a toilet" />
        <RateLimited retryAt={retryAt} />
      </>
    );
  }

  const activeFloor = draft.additionalFloors[floorIdx];
  const meta = step.startsWith("floor-")
    ? `Floor ${floorIdx + 1}/${draft.additionalFloors.length}`
    : STEP_LABELS[step];

  return (
    <>
      <TopBar
        onClose
        back={step !== "photos"}
        onBack={goBack}
        title="Add a toilet"
        meta={meta}
      />
      {step === "photos" && (
        <StepPhotos
          entry={draft.primary}
          onChangeEntry={updatePrimary}
          onNext={() => setStep("location")}
          ensureSession={ensureSession}
          draftId={draft.draftId}
        />
      )}
      {step === "location" && (
        <StepLocation draft={draft} onChange={setDraft} onNext={() => setStep("venue")} />
      )}
      {step === "venue" && (
        <StepVenue draft={draft} onChange={setDraft} onNext={() => setStep("scores")} />
      )}
      {step === "scores" && (
        <StepScores entry={draft.primary} onChangeEntry={updatePrimary} onNext={() => setStep("review")} />
      )}
      {step === "review" && (
        <StepReview
          entry={draft.primary}
          onChangeEntry={updatePrimary}
          onSubmit={handlePrimaryReviewDone}
          submitLabel={
            draft.multiFloor && draft.additionalFloors.length > 0 ? "Next: add other floors" : undefined
          }
        />
      )}
      {step === "floor-photos" && activeFloor && (
        <StepPhotos
          entry={activeFloor}
          onChangeEntry={(fn) => updateFloor(floorIdx, fn)}
          onNext={() => setStep("floor-scores")}
          ensureSession={ensureSession}
          draftId={draft.draftId}
          stepIndex={1}
          stepTotal={3}
          heading={`Floor ${activeFloor.floorLabel} · Photos`}
        />
      )}
      {step === "floor-scores" && activeFloor && (
        <StepScores
          entry={activeFloor}
          onChangeEntry={(fn) => updateFloor(floorIdx, fn)}
          onNext={() => setStep("floor-review")}
          stepIndex={2}
          stepTotal={3}
          heading={`Floor ${activeFloor.floorLabel} · Scores`}
        />
      )}
      {step === "floor-review" && activeFloor && (
        <StepReview
          entry={activeFloor}
          onChangeEntry={(fn) => updateFloor(floorIdx, fn)}
          onSubmit={handleFloorReviewDone}
          stepIndex={3}
          stepTotal={3}
          heading={`Floor ${activeFloor.floorLabel} · Review`}
          submitLabel={floorIdx + 1 < draft.additionalFloors.length ? "Next floor" : "Post all toilets"}
          skipLabel={floorIdx + 1 < draft.additionalFloors.length ? "Skip — next floor" : "Skip — post all toilets"}
        />
      )}
      {submitting && <div className="toast">Posting…</div>}
      {submitError && !submitting && (
        <div className="toast" style={{ background: "var(--red-3)" }}>
          {submitError}
        </div>
      )}
    </>
  );
}
