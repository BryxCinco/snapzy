import type { SupabaseClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { NOT_ANALYZED_YET } from "@/lib/categories";
import { heicToJpeg } from "@/lib/heic";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

export type UploadResult = { ok: true } | { ok: false; error: string };

const BUCKET = "screenshots";
const THUMB_SIZE = 400;

export const DUPLICATE_MESSAGE = "This screenshot already exists in your library.";

// What the file really is, from its first bytes (not its name or the MIME
// type the browser claims). HEIC/HEIF is converted to JPEG further down.
const REAL_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

// Keep storage keys URL-safe; the original name is stored separately.
function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+/, "");
  return (cleaned || "screenshot").slice(-100);
}

/**
 * Re-encodes a PNG/JPEG/WEBP so every piece of metadata is gone (EXIF, GPS
 * location, camera and device info, XMP, comments). sharp drops metadata
 * unless told to keep it; rotate() first applies the EXIF orientation so the
 * picture stays upright without the tag. Output is sRGB.
 * Animated images (and GIFs, which carry no EXIF) are stored as they are.
 */
async function stripMetadata(image: Uint8Array, mime: string): Promise<Uint8Array> {
  if (mime === "image/gif") return image;
  const { pages } = await sharp(image).metadata();
  if ((pages ?? 1) > 1) return image;

  const encode = (quality: number) => {
    const pipeline = sharp(image).rotate();
    if (mime === "image/png") return pipeline.png().toBuffer();
    if (mime === "image/webp") return pipeline.webp({ quality }).toBuffer();
    return pipeline.jpeg({ quality }).toBuffer();
  };

  // A lossy re-encode can come out bigger than a heavily compressed original;
  // retry smaller so it still fits the bucket's size limit.
  let stripped = await encode(90);
  if (stripped.byteLength > MAX_UPLOAD_BYTES && mime !== "image/png") stripped = await encode(75);
  return stripped;
}

// A small WebP preview for the gallery grid. Fits inside THUMB_SIZE x THUMB_SIZE
// without cropping, so tall screenshots keep their shape.
export async function makeThumbnail(image: Uint8Array) {
  return sharp(image)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}

/**
 * Validates one uploaded image, strips its metadata, stores it (plus a
 * thumbnail) in the private bucket and inserts its row. Shared by the upload
 * Server Action and the PWA share target. Uploads wait as "new" until the
 * user presses "Sort photos".
 */
export async function saveUpload(
  supabase: SupabaseClient,
  user: { id: string },
  file: File,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "No file received." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `${file.name}: file is larger than 10 MB.` };
  }

  const original = new Uint8Array(await file.arrayBuffer());

  // Trust the bytes, not the label: a renamed .exe or HTML file is refused.
  const detected = await fileTypeFromBuffer(original);
  if (!detected || !REAL_TYPES.has(detected.mime)) {
    return { ok: false, error: `${file.name}: only real PNG, JPG, WEBP, GIF or HEIC images.` };
  }

  // Hash of exactly what the user sent (before conversion or stripping).
  const fileHash = createHash("sha256").update(original).digest("hex");

  // Duplicate check. A lookup error (42703: migration 010 not applied yet)
  // just means uploads work without duplicate detection.
  const { data: existing, error: lookupError } = await supabase
    .from("screenshots")
    .select("id")
    .eq("user_id", user.id)
    .eq("file_hash", fileHash)
    .limit(1);
  if (!lookupError && existing && existing.length > 0) {
    return { ok: false, error: `${file.name}: ${DUPLICATE_MESSAGE}` };
  }

  // Only valid, new files use up the hourly allowance.
  const allowed = await checkRateLimit(supabase, "upload");
  if (!allowed.ok) return { ok: false, error: `${file.name}: ${allowed.error}` };

  // HEIC/HEIF (iPhone) is converted to JPEG, so the rest of the app (AI,
  // thumbnails, downloads) never sees it. Everything else is stripped of
  // metadata (the conversion already drops it).
  const isHeic = detected.mime === "image/heic" || detected.mime === "image/heif";
  let body: Uint8Array;
  let filename = file.name;
  let mimeType: string;
  try {
    if (isHeic) {
      body = await heicToJpeg(original);
      filename = filename.replace(/\.(heic|heif)$/i, "") + ".jpg";
      mimeType = "image/jpeg";
    } else {
      body = await stripMetadata(original, detected.mime);
      mimeType = detected.mime;
    }
  } catch {
    return { ok: false, error: `${file.name}: couldn't read this image.` };
  }
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `${file.name}: file is larger than 10 MB after processing.` };
  }

  // RLS on storage requires the first folder to be the user's id.
  const stamp = Date.now();
  const safeName = sanitizeFilename(filename);
  const storagePath = `${user.id}/${stamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: mimeType, upsert: false });
  if (uploadError) {
    return { ok: false, error: `${file.name}: ${uploadError.message}` };
  }

  // The thumbnail is a nicety: if it can't be made, the gallery just falls
  // back to the original image.
  let thumbnailPath: string | null = null;
  try {
    const thumb = await makeThumbnail(body);
    const path = `${user.id}/thumb_${stamp}_${safeName}.webp`;
    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(path, thumb, { contentType: "image/webp", upsert: false });
    if (!thumbError) thumbnailPath = path;
  } catch {
    // Ignored on purpose, see above.
  }

  const removeFiles = () =>
    supabase.storage
      .from(BUCKET)
      .remove(thumbnailPath ? [storagePath, thumbnailPath] : [storagePath]);

  // Store the path, not a URL: the bucket is private and signed URLs expire.
  // They are generated fresh each time the gallery renders.
  const row = {
    user_id: user.id,
    storage_path: storagePath,
    original_filename: filename,
    file_size: body.byteLength,
    mime_type: mimeType,
  };
  let fields: Record<string, unknown> = {
    ...row,
    thumbnail_path: thumbnailPath,
    file_hash: fileHash,
  };
  const insert = (extra: Record<string, unknown>) =>
    supabase.from("screenshots").insert({ ...fields, ...extra });

  let { error: insertError } = await insert({ status: "new" });
  // PGRST204 = unknown column: migration 010 not applied yet.
  if (insertError?.code === "PGRST204") {
    fields = row;
    ({ error: insertError } = await insert({ status: "new" }));
  }
  // 23514 = check violation: migration 008 (status 'new') not applied yet.
  // Fall back to a marked "failed" row, which the gallery shows as new.
  if (insertError?.code === "23514") {
    ({ error: insertError } = await insert({
      status: "failed",
      processing_error: NOT_ANALYZED_YET,
    }));
  }
  if (insertError) {
    // Don't leave orphaned files behind if the row couldn't be saved.
    await removeFiles();
    // 23505 = unique violation: the same file was uploaded a moment ago.
    if (insertError.code === "23505") {
      return { ok: false, error: `${file.name}: ${DUPLICATE_MESSAGE}` };
    }
    return { ok: false, error: `${file.name}: ${insertError.message}` };
  }

  return { ok: true };
}
