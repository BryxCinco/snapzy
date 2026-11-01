import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { NOT_ANALYZED_YET } from "@/lib/categories";
import { heicToJpeg } from "@/lib/heic";
import { isAllowedUpload, isHeicFile, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export type UploadResult = { ok: true } | { ok: false; error: string };

const BUCKET = "screenshots";
const THUMB_SIZE = 400;

export const DUPLICATE_MESSAGE = "This screenshot already exists in your library.";

// Keep storage keys URL-safe; the original name is stored separately.
function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+/, "");
  return (cleaned || "screenshot").slice(-100);
}

// A small WebP preview for the gallery grid. Fits inside THUMB_SIZE x THUMB_SIZE
// without cropping, so tall screenshots keep their shape.
async function makeThumbnail(image: Uint8Array) {
  return sharp(image)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}

/**
 * Validates one uploaded image, stores it (plus a thumbnail) in the private
 * bucket and inserts its row. Shared by the upload Server Action and the
 * PWA share target. Uploads wait as "new" until the user presses "Sort photos".
 */
export async function saveUpload(
  supabase: SupabaseClient,
  user: { id: string },
  file: File,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "No file received." };
  if (!isAllowedUpload(file)) {
    return { ok: false, error: `${file.name}: only PNG, JPG, WEBP, GIF or HEIC.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `${file.name}: file is larger than 10 MB.` };
  }

  const original = new Uint8Array(await file.arrayBuffer());
  // Hash of exactly what the user sent (before any HEIC conversion).
  const fileHash = createHash("sha256").update(original).digest("hex");

  // Duplicate check. 42703 = undefined column: migration 010 not applied yet,
  // in which case uploads still work, just without duplicate detection.
  const { data: existing, error: lookupError } = await supabase
    .from("screenshots")
    .select("id")
    .eq("user_id", user.id)
    .eq("file_hash", fileHash)
    .limit(1);
  if (!lookupError && existing && existing.length > 0) {
    return { ok: false, error: `${file.name}: ${DUPLICATE_MESSAGE}` };
  }

  // HEIC/HEIF (iPhone) is converted to JPEG before it is stored, so the rest
  // of the app (AI, thumbnails, downloads) never sees it.
  let body: Uint8Array = original;
  let filename = file.name;
  let mimeType = file.type;
  if (isHeicFile(file)) {
    try {
      body = await heicToJpeg(original);
    } catch {
      return { ok: false, error: `${file.name}: couldn't read this HEIC file.` };
    }
    if (body.byteLength > MAX_UPLOAD_BYTES) {
      return { ok: false, error: `${file.name}: file is larger than 10 MB after conversion.` };
    }
    filename = filename.replace(/\.(heic|heif)$/i, "") + ".jpg";
    mimeType = "image/jpeg";
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
