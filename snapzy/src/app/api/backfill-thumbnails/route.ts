import { connection } from "next/server";
import { makeThumbnail } from "@/lib/save-upload";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "screenshots";
// Photos handled per request. Small on purpose: every one is downloaded,
// resized and uploaded, and a single request must finish within the host's
// function time limit. The Settings button calls this again until done.
const BATCH = 12;
const CONCURRENCY = 3;

type Row = { id: string; storage_path: string; created_at: string };

/**
 * POST /api/backfill-thumbnails[?cursor=<created_at>]
 *
 * One-time fix for photos uploaded before thumbnails existed. For the signed-in
 * user's photos with no thumbnail_path: download the original, make a 400px
 * WebP, upload it next to the original, and save its path.
 *
 * Returns { processed, failed, remaining, nextCursor }. Call again with
 * ?cursor=<nextCursor> until nextCursor is null. The cursor skips photos that
 * failed, so one bad file can't block the rest. Safe to run again: photos that
 * already have a thumbnail are never touched.
 */
export async function POST(request: Request) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are not logged in." }, { status: 401 });
  }

  const cursor = new URL(request.url).searchParams.get("cursor");

  // RLS already limits this to the user's rows; user_id is a second guard.
  let query = supabase
    .from("screenshots")
    .select("id, storage_path, created_at")
    .eq("user_id", user.id)
    .is("thumbnail_path", null)
    .order("created_at", { ascending: false })
    .limit(BATCH);
  if (cursor) query = query.lt("created_at", cursor);

  const { data: rows, error } = await query.overrideTypes<Row[], { merge: false }>();
  if (error) {
    // 42703 = undefined column: migration 010 hasn't been run yet.
    return Response.json(
      {
        error:
          error.code === "42703"
            ? "Run supabase/migrations/010_thumbnails_dedupe_manual_move.sql first."
            : error.message,
      },
      { status: 500 },
    );
  }

  let processed = 0;
  let failed = 0;
  const queue = [...rows];

  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      try {
        const { data: blob, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(row.storage_path);
        if (downloadError || !blob) throw downloadError ?? new Error("download failed");

        const thumb = await makeThumbnail(new Uint8Array(await blob.arrayBuffer()));
        // Same folder as the original (the storage policy needs <user_id>/
        // first), named by row id so it can't collide with another file.
        const path = `${user.id}/thumb_${row.id}.webp`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, thumb, { contentType: "image/webp", upsert: true });
        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase
          .from("screenshots")
          .update({ thumbnail_path: path })
          .eq("id", row.id)
          .eq("user_id", user.id);
        if (updateError) {
          // Don't leave an unreferenced file behind.
          await supabase.storage.from(BUCKET).remove([path]);
          throw updateError;
        }
        processed++;
      } catch (err) {
        failed++;
        console.error(`[snapzy] thumbnail backfill failed for ${row.id}:`, err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  const { count } = await supabase
    .from("screenshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("thumbnail_path", null);

  return Response.json({
    processed,
    failed,
    remaining: count ?? 0,
    // A full batch means there may be more older photos; a short one means we
    // reached the end of the list.
    nextCursor: rows.length === BATCH ? rows[rows.length - 1].created_at : null,
  });
}
