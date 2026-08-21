/** Thin fill bar for a 0-1 progress fraction — shared by the per-photo
 * overlay and the wizard's aggregate batch bar so there's one place that
 * owns the fill color/animation. */
export function ProgressFill({
  progress,
  height = 4,
  track = "rgba(255,255,255,.5)",
}: {
  progress: number;
  height?: number;
  track?: string;
}) {
  return (
    <div style={{ height, background: track }}>
      <div
        style={{
          height: "100%",
          width: `${Math.round(progress * 100)}%`,
          background: "var(--green-3)",
          transition: "width 120ms linear",
        }}
      />
    </div>
  );
}

/** Dark scrim + percentage readout + bottom fill bar, absolutely positioned
 * over a photo thumbnail while it's uploading. Shared between the wizard's
 * `Thumb` (StepPhotos.tsx) and the existing-toilet `NewPhotoThumb`
 * (AddPhotosOnly.tsx) — same overlay, same data shape, one place to change. */
export function UploadProgressOverlay({ progress }: { progress: number }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {Math.round(progress * 100)}%
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <ProgressFill progress={progress} />
      </div>
    </>
  );
}
