import jsQR from "jsqr";
import sharp from "sharp";
import type { WifiInfo } from "@/lib/metadata";

// Large photos are shrunk first: jsQR is pure JS and slow on 12 MP images,
// and a readable QR code survives this size easily.
const MAX_SIDE = 1600;

/**
 * Reads a QR code straight from the pixels. Unlike the AI, this returns the
 * exact payload (URLs, WiFi configs, GCash/InstaPay codes). Returns null if
 * there's no readable QR code or the image can't be decoded.
 */
export async function decodeQrCode(image: Uint8Array): Promise<string | null> {
  try {
    const { data, info } = await sharp(image)
      .rotate() // honor EXIF orientation from phone photos
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const code = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      info.width,
      info.height,
      { inversionAttempts: "attemptBoth" },
    );
    return code?.data?.trim() || null;
  } catch {
    return null;
  }
}

// WiFi QR payload: WIFI:T:WPA;S:MyNetwork;P:secret;H:false;;
// Values may escape \ ; , : and " with a backslash.
export function parseWifiQr(payload: string): WifiInfo | null {
  if (!/^WIFI:/i.test(payload)) return null;
  const fields: Record<string, string> = {};
  const body = payload.slice(5);
  let key = "";
  let value = "";
  let readingKey = true;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && i + 1 < body.length) {
      if (readingKey) key += body[++i];
      else value += body[++i];
    } else if (readingKey && ch === ":") {
      readingKey = false;
    } else if (!readingKey && ch === ";") {
      fields[key.toUpperCase()] = value;
      key = "";
      value = "";
      readingKey = true;
    } else if (readingKey) {
      key += ch;
    } else {
      value += ch;
    }
  }
  if (!fields.S) return null;
  const security = fields.T && fields.T.toLowerCase() !== "nopass" ? fields.T : null;
  return { ssid: fields.S, password: fields.P || null, security };
}
