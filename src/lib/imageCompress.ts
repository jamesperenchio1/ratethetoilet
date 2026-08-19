/**
 * Downscales + re-encodes a photo before upload. Raw phone camera photos
 * (HEIC/JPEG, often 3-8MB at full sensor resolution) are large enough that a
 * slow or cellular connection can time out or reset mid-transfer — this is
 * the most common cause behind an otherwise-unexplained "Load failed" /
 * "Failed to fetch" on photo upload. Capping the longest side and
 * re-encoding as JPEG typically brings that down to a few hundred KB.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Any failure here (unsupported codec, low-memory decode failure, etc.)
    // falls back to the original file rather than blocking the upload.
    return file;
  }
}
