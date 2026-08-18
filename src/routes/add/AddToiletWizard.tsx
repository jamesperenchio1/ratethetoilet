import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../../components/layout/TopBar";
import { useIdentity } from "../../components/IdentityGateProvider";
import { canPost, createToilet, attachDraftPhotos, type NewToiletInput } from "../../lib/api";
import { enqueuePost } from "../../lib/offlineQueue";
import { emptyDraft, type ToiletDraft } from "./types";
import { saveWizardState, loadWizardState, clearWizardState, type PersistableStep } from "./persist";
import type { Toilet } from "../../lib/types";
import { StepPhotos } from "./StepPhotos";
import { StepLocation } from "./StepLocation";
import { StepVenue } from "./StepVenue";
import { StepScores } from "./StepScores";
import { StepHint } from "./StepHint";
import { Posted } from "./Posted";
import { RateLimited } from "./RateLimited";

type Step = PersistableStep | "posted" | "rate-limited";
const STEP_LABELS: Partial<Record<Step, string>> = {
  photos: "1/5",
  location: "2/5",
  venue: "3/5",
  scores: "4/5",
  hint: "Bonus · optional",
};

function draftToInput(draft: ToiletDraft): NewToiletInput {
  return {
    lat: draft.lat!,
    lng: draft.lng!,
    venue_type: draft.venueType!,
    access_type: draft.accessType!,
    venue_name: draft.venueName?.trim() || null,
    supplies: draft.supplies,
    wheelchair: draft.wheelchair,
    hint_chips: draft.hintChips,
    hint_note: draft.hintNote.trim() || null,
    cleanliness: draft.cleanliness,
    smell: draft.smell,
    privacy: draft.privacy,
    location_source: draft.locationSource,
  };
}

export function AddToiletWizard() {
  const navigate = useNavigate();
  const { withIdentity, ensureSession, profile } = useIdentity();
  const restored = loadWizardState();
  const [draft, setDraft] = useState<ToiletDraft>(restored?.draft ?? emptyDraft());
  const [step, setStep] = useState<Step>(restored?.step ?? "photos");
  const [posted, setPosted] = useState<Toilet | null>(null);
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    saveWizardState(step, draft);
  }, [step, draft]);

  function reset() {
    clearWizardState();
    setDraft(emptyDraft());
    setPosted(null);
    setStep("photos");
  }

  async function submit() {
    setSubmitting(true);
    try {
      if (profile) {
        const { allowed, retryAt: r } = await canPost();
        if (!allowed) {
          setRetryAt(r);
          setStep("rate-limited");
          return;
        }
      }

      if (!navigator.onLine && profile) {
        await enqueuePost("toilet", draftToInput(draft));
        clearWizardState();
        navigate("/");
        return;
      }

      let newToilet: Toilet;
      try {
        newToilet = await withIdentity(async (p) => {
          const t = await createToilet(p.id, draftToInput(draft));
          const paths = draft.photos
            .filter((ph) => ph.status === "done" && ph.storagePath)
            .map((ph) => ph.storagePath as string);
          await attachDraftPhotos(p.id, t.id, paths);
          return t;
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes("rate_limit_exceeded")) {
          setRetryAt(null);
          setStep("rate-limited");
          return;
        }
        throw err;
      }
      clearWizardState();
      setPosted(newToilet);
      setStep("posted");
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
          firstPhotoPath={draft.photos.find((p) => p.status === "done")?.storagePath ?? null}
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

  return (
    <>
      <TopBar onClose title="Add a toilet" meta={STEP_LABELS[step]} />
      {step === "photos" && (
        <StepPhotos draft={draft} onChange={setDraft} onNext={() => setStep("location")} />
      )}
      {step === "location" && (
        <StepLocation draft={draft} onChange={setDraft} onNext={() => setStep("venue")} />
      )}
      {step === "venue" && (
        <StepVenue draft={draft} onChange={setDraft} onNext={() => setStep("scores")} />
      )}
      {step === "scores" && (
        <StepScores draft={draft} onChange={setDraft} onNext={() => setStep("hint")} />
      )}
      {step === "hint" && (
        <StepHint draft={draft} onChange={setDraft} onSubmit={submit} />
      )}
      {submitting && <div className="toast">Posting…</div>}
    </>
  );
}
