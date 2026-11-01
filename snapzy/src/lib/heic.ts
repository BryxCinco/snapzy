import convert from "heic-convert";
import sharp from "sharp";

// The prebuilt sharp binaries can't decode HEIC (HEVC is patent-encumbered),
// so try sharp first (works on custom libvips builds) and fall back to
// heic-convert, a WASM decoder. Output is an upright JPEG either way.
export async function heicToJpeg(input: Uint8Array): Promise<Uint8Array> {
  try {
    return await sharp(input).rotate().jpeg({ quality: 90 }).toBuffer();
  } catch {
    const decoded = await convert({
      buffer: input,
      format: "JPEG",
      quality: 0.9,
    });
    return new Uint8Array(decoded);
  }
}
