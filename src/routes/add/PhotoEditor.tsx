import { useEffect, useRef, useState } from "react";

type Corner = "tl" | "tr" | "bl" | "br";
interface Inset {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MIN_SIZE = 15; // percent — keeps the crop box from collapsing to nothing

function rotateToCanvas(img: HTMLImageElement, rotationDeg: number): HTMLCanvasElement {
  const swapped = rotationDeg % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = swapped ? img.naturalHeight : img.naturalWidth;
  canvas.height = swapped ? img.naturalWidth : img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas;
}

export function PhotoEditor({
  file,
  onCancel,
  onSave,
  onRemove,
}: {
  file: File;
  onCancel: () => void;
  onSave: (file: File) => void;
  onRemove: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [rotated, setRotated] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [inset, setInset] = useState<Inset>({ left: 8, top: 8, right: 8, bottom: 8 });
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragCorner = useRef<Corner | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setLoadError(false);
      setRotated(rotateToCanvas(img, rotation));
    };
    // Without this, a photo the browser can't decode (e.g. HEIC on a browser
    // with no native HEIC support) just leaves `rotated` null forever — the
    // preview area stays blank and Save is silently disabled with no
    // explanation. Surface it instead so Cancel/Remove are the obvious way out.
    img.onerror = () => setLoadError(true);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, rotation]);

  // Re-encoding the full-resolution canvas to a data URL is expensive (a
  // multi-megapixel photo can take real time to base64-encode) — doing it
  // inline in JSX meant it re-ran on every render, including every single
  // pointermove while dragging a crop handle, causing the whole editor to
  // stutter/freeze while cropping. Recompute only when the decoded image
  // itself changes (a new file or a rotation), never for a crop-box drag.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!rotated) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    rotated.toBlob((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rotated]);

  useEffect(() => {
    function move(e: PointerEvent) {
      const wrap = wrapRef.current;
      if (!wrap || !dragCorner.current) return;
      const rect = wrap.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      setInset((prev) => {
        const next = { ...prev };
        const c = dragCorner.current!;
        if (c === "tl" || c === "bl") next.left = clamp(px, 0, 100 - prev.right - MIN_SIZE);
        if (c === "tr" || c === "br") next.right = clamp(100 - px, 0, 100 - prev.left - MIN_SIZE);
        if (c === "tl" || c === "tr") next.top = clamp(py, 0, 100 - prev.bottom - MIN_SIZE);
        if (c === "bl" || c === "br") next.bottom = clamp(100 - py, 0, 100 - prev.top - MIN_SIZE);
        return next;
      });
    }
    function up() {
      dragCorner.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  function startDrag(c: Corner) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      dragCorner.current = c;
    };
  }

  async function save() {
    if (!rotated) return;
    setSaving(true);
    try {
      const x = (inset.left / 100) * rotated.width;
      const y = (inset.top / 100) * rotated.height;
      const w = rotated.width - x - (inset.right / 100) * rotated.width;
      const h = rotated.height - y - (inset.bottom / 100) * rotated.height;
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(w));
      out.height = Math.max(1, Math.round(h));
      out.getContext("2d")!.drawImage(rotated, x, y, w, h, 0, 0, out.width, out.height);
      const blob: Blob = await new Promise((resolve, reject) =>
        out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), file.type || "image/jpeg", 0.92)
      );
      onSave(new File([blob], file.name, { type: file.type || "image/jpeg" }));
    } finally {
      setSaving(false);
    }
  }

  const handleStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#fff",
    border: "2px solid var(--surface-accent)",
    touchAction: "none",
    cursor: "pointer",
    ...extra,
  });

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <div className="lbl">Edit photo</div>

        <div
          ref={wrapRef}
          style={{ position: "relative", display: "inline-block", maxWidth: "100%", alignSelf: "center" }}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              style={{ display: "block", maxWidth: "100%", maxHeight: 320, borderRadius: 4 }}
            />
          )}
          {loadError && (
            <div
              className="box"
              style={{ minHeight: 160, minWidth: 240, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 12 }}
            >
              Can't preview this photo's format here. You can still remove it or cancel.
            </div>
          )}
          {rotated && (
            <>
              {/* dimmed mask outside the crop box */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,.45)",
                  clipPath: `polygon(0 0, 0 100%, ${inset.left}% 100%, ${inset.left}% ${inset.top}%, ${
                    100 - inset.right
                  }% ${inset.top}%, ${100 - inset.right}% ${100 - inset.bottom}%, ${inset.left}% ${
                    100 - inset.bottom
                  }%, ${inset.left}% 100%, 100% 100%, 100% 0)`,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${inset.left}%`,
                  top: `${inset.top}%`,
                  right: `${inset.right}%`,
                  bottom: `${inset.bottom}%`,
                  border: "1.5px dashed #fff",
                  pointerEvents: "none",
                }}
              />
              <div
                onPointerDown={startDrag("tl")}
                style={handleStyle({ left: `calc(${inset.left}% - 11px)`, top: `calc(${inset.top}% - 11px)` })}
              />
              <div
                onPointerDown={startDrag("tr")}
                style={handleStyle({ right: `calc(${inset.right}% - 11px)`, top: `calc(${inset.top}% - 11px)` })}
              />
              <div
                onPointerDown={startDrag("bl")}
                style={handleStyle({ left: `calc(${inset.left}% - 11px)`, bottom: `calc(${inset.bottom}% - 11px)` })}
              />
              <div
                onPointerDown={startDrag("br")}
                style={handleStyle({ right: `calc(${inset.right}% - 11px)`, bottom: `calc(${inset.bottom}% - 11px)` })}
              />
            </>
          )}
        </div>

        {rotated && (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn2" style={{ flex: 1 }} onClick={() => setRotation((r) => (r + 270) % 360)}>
                ↺ Rotate left
              </button>
              <button className="btn2" style={{ flex: 1 }} onClick={() => setRotation((r) => (r + 90) % 360)}>
                ↻ Rotate right
              </button>
            </div>
            <button className="ghost" onClick={() => setInset({ left: 8, top: 8, right: 8, bottom: 8 })}>
              Reset crop
            </button>
          </>
        )}

        <button className="btn" disabled={saving || !rotated} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn danger" onClick={onRemove}>
          Remove photo
        </button>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max));
}
