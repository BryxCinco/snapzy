"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { isCategory, STUCK_AFTER_MS } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { processScreenshot } from "./process-screenshot";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BulkAnalyzeResult =
  | { ok: true; queued: number; skipped: number }
  | { ok: false; error: string };

const BUCKET = "screenshots";
// Caps one bulk request so a single click can't fire hundreds of AI calls.
const MAX_BULK_IDS = 100;
// Parallel AI calls during a bulk run; higher trips Gemini rate limits.
const BULK_CONCURRENCY = 3;

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
  const result = await analyzeMultipleScreenshots([screenshotId], {
    includeDone: true,
  });
  if (!result.ok) return result;
  if (result.queued === 0) return { ok: false, error: "Screenshot not found." };
  return { ok: true };
}

type QueueRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  status: string;
  category: string | null;
  processing_started_at: string | null;
};

// Failed items, items stuck mid-run, and items still carrying a category
// from the old category list. Fresh pending/processing rows are skipped:
// a background job is already working on them.
function needsAnalysis(row: QueueRow, now: number) {
  if (row.status === "failed") return true;
  if (row.status === "pending" || row.status === "processing") {
    const started = row.processing_started_at
      ? new Date(row.processing_started_at).getTime()
      : 0;
    return now - started > STUCK_AFTER_MS;
  }
  return row.category !== null && !isCategory(row.category);
}

/**
 * Runs AI analysis for several screenshots in the background.
 * By default only failed, stuck or old-category items are queued;
 * pass `includeDone` to re-analyze everything (e.g. "Re-analyze all").
 */
export async function analyzeMultipleScreenshots(
  ids: string[],
  options: { includeDone?: boolean } = {},
): Promise<BulkAnalyzeResult> {
  const uniqueIds = [...new Set(ids)].filter((id) => typeof id === "string");
  if (uniqueIds.length === 0) return { ok: true, queued: 0, skipped: 0 };
  if (uniqueIds.length > MAX_BULK_IDS) {
    return {
      ok: false,
      error: `Select at most ${MAX_BULK_IDS} screenshots at a time.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not logged in." };
  }

  // RLS drops any ids that belong to someone else.
  const { data: rows, error } = await supabase
    .from("screenshots")
    .select("id, storage_path, mime_type, status, category, processing_started_at")
    .in("id", uniqueIds);
  if (error) {
    return { ok: false, error: error.message };
  }

  const now = Date.now();
  const toQueue = (rows as QueueRow[]).filter(
    (r) => options.includeDone || needsAnalysis(r, now),
  );
  if (toQueue.length === 0) {
    return { ok: true, queued: 0, skipped: uniqueIds.length };
  }

  // Flip them to pending now so the cards show spinners on the next render.
  const { error: markError } = await supabase
    .from("screenshots")
    .update({
      status: "pending",
      processing_error: null,
      processing_started_at: new Date(now).toISOString(),
    })
    .in(
      "id",
      toQueue.map((r) => r.id),
    );
  if (markError) {
    return { ok: false, error: markError.message };
  }

  after(() => runQueue(supabase, user.id, toQueue));

  revalidatePath("/dashboard");
  return {
    ok: true,
    queued: toQueue.length,
    skipped: uniqueIds.length - toQueue.length,
  };
}

async function runQueue(
  supabase: SupabaseClient,
  userId: string,
  rows: QueueRow[],
) {
  const queue = [...rows];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const { data: blob, error } = await supabase.storage
        .from(BUCKET)
        .download(row.storage_path);
      if (error || !blob) {
        await supabase
          .from("screenshots")
          .update({
            status: "failed",
            processing_error: error?.message ?? "Could not download the image.",
          })
          .eq("id", row.id);
        continue;
      }
      await processScreenshot(supabase, {
        screenshotId: row.id,
        userId,
        image: new Uint8Array(await blob.arrayBuffer()),
        mediaType: row.mime_type || blob.type || "image/png",
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(BULK_CONCURRENCY, rows.length) }, worker),
  );
}

export type SearchResult =
  | { ok: true; ids: string[]; ranked: boolean }
  | { ok: false; error: string };

const MAX_QUERY_LENGTH = 200;

/**
 * Full-text search over summary + OCR text (the `search_vector` column).
 * Returns matching ids, best match first. Uses the ranked
 * `search_screenshots` RPC (supabase/migrations/004_search.sql) and falls
 * back to an unranked `textSearch` if that migration hasn't been run.
 */
export async function searchScreenshots(query: string): Promise<SearchResult> {
  const q = String(query ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!q) return { ok: true, ids: [], ranked: true };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_screenshots", { q });
  if (!error) {
    return {
      ok: true,
      ids: (data as { id: string }[]).map((r) => r.id),
      ranked: true,
    };
  }

  // PGRST202 = function not found (migration 004 not applied yet).
  if (error.code !== "PGRST202") {
    return { ok: false, error: error.message };
  }

  const { data: rows, error: fallbackError } = await supabase
    .from("screenshots")
    .select("id")
    .eq("is_archived", false)
    .textSearch("search_vector", q, { type: "websearch", config: "english" })
    .order("created_at", { ascending: false })
    .limit(200);
  if (fallbackError) {
    return { ok: false, error: fallbackError.message };
  }
  return { ok: true, ids: rows.map((r) => r.id), ranked: false };
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
