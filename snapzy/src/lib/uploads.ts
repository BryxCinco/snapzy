// Shared by the upload zone (client-side pre-check) and the upload action
// (authoritative server-side check). Keep in sync with the bucket settings
// in supabase/migrations/002_upload_metadata.sql.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export function isAllowedImageType(type: string) {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

// iPhone photos. Browsers often leave `type` empty for these (Windows,
// Chrome), so the extension counts too. They are converted to JPEG on upload,
// so the bucket only ever sees the types above.
const HEIC_TYPES = ["image/heic", "image/heif"];

export function isHeicFile(file: { name: string; type: string }) {
  return HEIC_TYPES.includes(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name);
}

export function isAllowedUpload(file: { name: string; type: string }) {
  return isAllowedImageType(file.type) || isHeicFile(file);
}
