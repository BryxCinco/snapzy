import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeScreenshot } from "@/lib/ai/analyze-screenshot";
import { fallbackCategory, getUserCategories } from "@/lib/categories-server";

/**
 * Moves a queued (pending) row to processing. Returns false when the row is
 * no longer pending, e.g. the user pressed Cancel, so the worker skips it.
 */
export async function claimScreenshot(supabase: SupabaseClient, screenshotId: string) {
  const { data } = await supabase
    .from("screenshots")
    .update({
      status: "processing",
      processing_error: null,
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", screenshotId)
    .eq("status", "pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

// Not a Server Action (no "use server"): only called from actions.ts, so it
// can't be invoked directly from the browser. The row must already be
// claimed (status "processing"); every write below checks that it still is,
// so a cancel mid-analysis throws the result away instead of saving it.
export async function processScreenshot(
  supabase: SupabaseClient,
  params: {
    screenshotId: string;
    userId: string;
    image: Uint8Array;
    mediaType: string;
  },
) {
  const { screenshotId, userId, image, mediaType } = params;

  try {
    // Fetched per image so a category added mid-run is used right away.
    const categories = await getUserCategories(supabase, userId);
    const fallback = fallbackCategory(categories);
    if (!fallback) throw new Error("No categories found for this user.");

    const analysis = await analyzeScreenshot(
      image,
      mediaType,
      categories.map((c) => ({ name: c.name, description: c.description })),
      fallback.name,
    );
    const chosen =
      categories.find((c) => c.name === analysis.category) ??
      categories.find(
        (c) => c.name.toLowerCase() === analysis.category.toLowerCase(),
      ) ??
      fallback;

    const result = {
      ocr_text: analysis.ocr_text,
      summary: analysis.summary,
      category_id: chosen.id,
      status: "done",
      processing_error: null,
    };
    let { data: saved, error: updateError } = await supabase
      .from("screenshots")
      .update({ ...result, metadata: analysis.metadata })
      .eq("id", screenshotId)
      .eq("status", "processing")
      .select("id");
    // PGRST204 = unknown column: migration 007 (metadata) not applied yet.
    // Save everything else rather than failing the whole analysis.
    if (updateError?.code === "PGRST204") {
      ({ data: saved, error: updateError } = await supabase
        .from("screenshots")
        .update(result)
        .eq("id", screenshotId)
        .eq("status", "processing")
        .select("id"));
    }
    if (updateError) throw updateError;
    // Cancelled while the AI was reading it: leave it unsorted.
    if (!saved?.length) return;

    await saveTags(supabase, screenshotId, userId, analysis.tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[snapzy] AI processing failed for ${screenshotId}:`, message);
    await supabase
      .from("screenshots")
      .update({ status: "failed", processing_error: message.slice(0, 500) })
      .eq("id", screenshotId)
      .eq("status", "processing");
  }
}

async function saveTags(
  supabase: SupabaseClient,
  screenshotId: string,
  userId: string,
  names: string[],
) {
  // Replace any tags from a previous run (e.g. a retry).
  await supabase.from("screenshot_tags").delete().eq("screenshot_id", screenshotId);
  if (names.length === 0) return;

  const { data: tags, error } = await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name" },
    )
    .select("id");
  if (error) throw error;

  const { error: linkError } = await supabase.from("screenshot_tags").upsert(
    tags.map((t) => ({ screenshot_id: screenshotId, tag_id: t.id })),
    { onConflict: "screenshot_id,tag_id", ignoreDuplicates: true },
  );
  if (linkError) throw linkError;
}
