import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeScreenshot } from "@/lib/ai/analyze-screenshot";

// Not a Server Action (no "use server"): only called from actions.ts, so it
// can't be invoked directly from the browser.
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

  await supabase
    .from("screenshots")
    .update({
      status: "processing",
      processing_error: null,
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", screenshotId);

  try {
    const analysis = await analyzeScreenshot(image, mediaType);

    const { error: updateError } = await supabase
      .from("screenshots")
      .update({
        ocr_text: analysis.ocr_text,
        summary: analysis.summary,
        category: analysis.category,
        status: "done",
        processing_error: null,
      })
      .eq("id", screenshotId);
    if (updateError) throw updateError;

    await saveTags(supabase, screenshotId, userId, analysis.tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[snapzy] AI processing failed for ${screenshotId}:`, message);
    await supabase
      .from("screenshots")
      .update({ status: "failed", processing_error: message.slice(0, 500) })
      .eq("id", screenshotId);
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
