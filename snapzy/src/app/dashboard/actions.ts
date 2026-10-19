"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { processScreenshot } from "./process-screenshot";

export type ActionResult = { ok: true } | { ok: false; error: string };

const BUCKET = "screenshots";

// Keep storage keys URL-safe; the original name is stored separately.
function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+/, "");
  return (cleaned || "screenshot").slice(-100);
}

export async function uploadScreenshot(
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file received." };
  }
  if (!isAllowedImageType(file.type)) {
    return { ok: false, error: `${file.name}: only PNG, JPG, WEBP or GIF.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `${file.name}: file is larger than 10 MB.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not logged in." };
  }

  // RLS on storage requires the first folder to be the user's id.
  const storagePath = `${user.id}/${Date.now()}_${sanitizeFilename(file.name)}`;
  const image = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, image, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { ok: false, error: `${file.name}: ${uploadError.message}` };
  }

  // Store the path, not a URL: the bucket is private and signed URLs expire.
  // They are generated fresh each time the gallery renders.
  const { data: row, error: insertError } = await supabase
    .from("screenshots")
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    // Don't leave an orphaned file behind if the row couldn't be saved.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: `${file.name}: ${insertError.message}` };
  }

  // Run the slow AI call after the response is sent, so the card appears
  // right away with a "processing" spinner. We already have the bytes, so
  // there's no need to download the file again.
  after(() =>
    processScreenshot(supabase, {
      screenshotId: row.id,
      userId: user.id,
      image,
      mediaType: file.type,
    }),
  );

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function retryProcessing(
  screenshotId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not logged in." };
  }

  // RLS makes this return nothing for someone else's screenshot.
  const { data: row } = await supabase
    .from("screenshots")
    .select("id, storage_path, mime_type")
    .eq("id", screenshotId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "Screenshot not found." };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path);
  if (downloadError || !blob) {
    return { ok: false, error: downloadError?.message ?? "Download failed." };
  }

  await supabase
    .from("screenshots")
    .update({
      status: "pending",
      processing_error: null,
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  const image = new Uint8Array(await blob.arrayBuffer());
  after(() =>
    processScreenshot(supabase, {
      screenshotId: row.id,
      userId: user.id,
      image,
      mediaType: row.mime_type || blob.type || "image/png",
    }),
  );

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteScreenshot(
  screenshotId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("screenshots")
    .select("id, storage_path")
    .eq("id", screenshotId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "Screenshot not found." };
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([row.storage_path]);
  if (storageError) {
    return { ok: false, error: storageError.message };
  }

  // screenshot_tags rows go with it via ON DELETE CASCADE.
  const { error: deleteError } = await supabase
    .from("screenshots")
    .delete()
    .eq("id", row.id);
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
