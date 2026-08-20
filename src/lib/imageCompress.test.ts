import { describe, expect, it } from "vitest";
import { compressImage, ImageTooLargeError, MAX_INPUT_BYTES } from "./imageCompress";

describe("compressImage", () => {
  it("rejects files over the input size cap before attempting to decode", async () => {
    const oversized = new File([new Uint8Array(MAX_INPUT_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    await expect(compressImage(oversized)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});
