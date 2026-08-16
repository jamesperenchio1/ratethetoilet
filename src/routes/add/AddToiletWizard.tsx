import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../../components/layout/TopBar";
import { useIdentity } from "../../components/IdentityGateProvider";
import { canPost, createToilet, attachDraftPhotos, type NewToiletInput } from "../../lib/api";
import { enqueuePost } from "../../lib/offlineQueue";
import { emptyDraft, type ToiletDraft } from "./types";
import type { Toilet } from "../../lib/types";
import { StepPhotos } from "./StepPhotos";
import { StepLocation } from "./StepLocation";
import { StepVenue } from "./StepVenue";
import { StepScores } from "./StepScores";
import { StepHint } from "./StepHint";
import { Posted } from "./Posted";
import { RateLimited } from "./RateLimited";

type Step = "photos" | "location" | "venue" | "scores" | "hint" | "posted" | "rate-limited";
const STEP_LABELS: Partial<Record<Step, string>> = {
  photos: "1/5",
  location: "2/5",
  venue: "3/5",
  scores: "4/5",
  hint: "5/5 · optional",
};

function draftToInput(draft: ToiletDraft): NewToiletInput {
  return {
    lat: draft.lat!,
    lng: draft.lng!,
    venue_type: draft.venueType!,
    access_type: draft.accessType!,
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
  const [draft, setDraft] = useState<ToiletDraft>(emptyDraft());
  const [step, setStep] = useState<Step>("photos");
  const [posted, setPosted] = useState<Toilet | null>(null);
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Silent — establishes a device session so draft photos can upload,
    // without minting a handle or showing anything to the user yet.
    ensureSession().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
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
        navigate("/");
        return;
      }

      const newToilet = await withIdentity(async (p) => {
        const t = await createToilet(p.id, draftToInput(draft));
        const paths = draft.photos
          .filter((ph) => ph.status === "done" && ph.storagePath)
          .map((ph) => ph.storagePath as string);
        await attachDraftPhotos(p.id, t.id, paths);
        return t;
      });
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
