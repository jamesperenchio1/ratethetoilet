/**
 * Downscales + re-encodes a photo before upload. Raw phone camera photos
 * (HEIC/JPEG, often 3-8MB at full sensor resolution) are large enough that a
 * slow or cellular connection can time out or reset mid-transfer — this is
 * the most common cause behind an otherwise-unexplained "Load failed" /
 * "Failed to fetch" on photo upload. Capping the longest side and
 * re-encoding as JPEG typically brings that down to a few hundred KB.
 *
 * Decoding happens through two paths:
 *  1. `createImageBitmap` (fast, no DOM element needed).
 *  2. An `<img>` element + canvas — Safari/iOS can render HEIC for display,
 *     so this path also shrinks iPhone HEIC photos, which `createImageBitmap`
 *     rejects. Without it, a HEIC photo fell back to uploading the original
 *     multi-MB file, which is exactly what failed as "Load failed".
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
/** Origins above this size are always re-encoded even if the JPEG is slightly
 * larger than the source (still a net win vs. shipping a huge original). */
const ALWAYS_REENCODE_BYTES = 1_000_000;
/** Hard cap on the *input* before we even attempt to decode it. A phone photo
 * is a few MB; anything past this is either not a photo or big enough that
 * createImageBitmap/canvas decode could burn real time/memory for nothing —
 * reject it outright instead of shipping it uncompressed. */
export const MAX_INPUT_BYTES = 30_000_000;

export class ImageTooLargeError extends Error {
  constructor() {
    super("Photo is too large (over 30MB).");
    this.name = "ImageTooLargeError";
  }
}

export interface CompressResult {
  file: File;
  /** True when compression failed and `file` is still the original — the
   * caller should let the user know a large file is about to be uploaded. */
  fellBackToOriginal: boolean;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

function drawToBlob(
  source: CanvasImageSource,
  width: number,
  height: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
}

function reencodedName(file: File): string {
  return file.name.replace(/\.[^.]+$/, "") + ".jpg";
}

export async function compressImage(file: File): Promise<CompressResult> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageTooLargeError();
  }
  try {
    let blob: Blob | null = null;

    // Path 1: createImageBitmap.
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(
          1,
          MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
        );
        blob = await drawToBlob(
          bitmap,
          bitmap.width * scale,
          bitmap.height * scale
        );
      } finally {
        bitmap.close();
      }
    } catch {
      blob = null;
    }

    // Path 2: <img> decode (handles HEIC on iOS, respects EXIF rotation).
    if (!blob) {
      const img = await loadImage(file);
      const scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
      );
      blob = await drawToBlob(
        img,
        img.naturalWidth * scale,
        img.naturalHeight * scale
      );
    }

    if (blob && (blob.size < file.size || file.size > ALWAYS_REENCODE_BYTES)) {
      return {
        file: new File([blob], reencodedName(file), { type: "image/jpeg" }),
        fellBackToOriginal: false,
      };
    }
    return { file, fellBackToOriginal: false };
  } catch (err) {
    // Any failure here (unsupported codec, low-memory decode failure, etc.)
    // falls back to the original file rather than blocking the upload —
    // callers should warn the user when the original is large.
    console.warn("Image compression failed, uploading original file", err);
    return { file, fellBackToOriginal: true };
  }
}