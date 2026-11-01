import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScreenshotCardData } from "@/components/screenshot-card";
import {
  NOT_ANALYZED_YET,
  type ProcessingStatus,
  QUOTA_ERROR_MESSAGE,
  STUCK_AFTER_MS,
} from "@/lib/categories";
import { parseMetadata } from "@/lib/metadata";

// How many photos the gallery loads per page.
export const PAGE_SIZE = 50;

const BUCKET = "screenshots";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const BASE_COLUMNS =
  "id, storage_path, original_filename, created_at, summary, ocr_text, category_id, status, processing_error, processing_started_at, screenshot_tags(tags(name))";

// Newest schema first. Postgres answers 42703 (undefined column) while a
// migration is still pending, so fall back to the previous column set and the
// gallery keeps working, just without the newer features.
const COLUMN_SETS = [
  `${BASE_COLUMNS}, metadata, thumbnail_path`, // migration 010
  `${BASE_COLUMNS}, metadata`, // migration 007
  BASE_COLUMNS,
];

type ScreenshotRow = {
  id: string;
  storage_path: string;
  thumbnail_path?: string | null;
  original_filename: string | null;
  created_at: string;
  summary: string | null;
  ocr_text: string | null;
  category_id: string | null;
  status: string | null;
  processing_error: string | null;
  processing_started_at: string | null;
  metadata?: unknown;
  screenshot_tags: unknown;
};

export type CardsResult =
  | { ok: true; cards: ScreenshotCardData[]; total: number | null }
  | { ok: false; error: string };

export type CardsQuery = {
  // Specific photos, newest first (search hits, an opened photo, a refresh).
  ids?: string[];
  // Otherwise a page of PAGE_SIZE, newest first, filtered by album:
  // "all", "unsorted" or a category id.
  album?: string;
  // Only photos older than this created_at (keyset paging).
  before?: string | null;
};

/**
 * Loads gallery cards with signed URLs for the full image and its thumbnail.
 * RLS limits every query to the signed-in user's rows.
 */
export async function loadScreenshotCards(
  supabase: SupabaseClient,
  query: CardsQuery = {},
): Promise<CardsResult> {
  const run = (columns: string) => {
    let q = supabase
      .from("screenshots")
      .select(columns, { count: "exact" })
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (query.ids) {
      q = q.in("id", query.ids);
    } else {
      const album = query.album ?? "all";
      if (album === "unsorted") q = q.is("category_id", null);
      else if (album !== "all") q = q.eq("category_id", album);
      if (query.before) q = q.lt("created_at", query.before);
      q = q.limit(PAGE_SIZE);
    }
    return q.overrideTypes<ScreenshotRow[], { merge: false }>();
  };

  let result = await run(COLUMN_SETS[0]);
  for (let i = 1; result.error?.code === "42703" && i < COLUMN_SETS.length; i++) {
    result = await run(COLUMN_SETS[i]);
  }
  if (result.error) return { ok: false, error: result.error.message };

  const rows = result.data ?? [];
  if (rows.length === 0) return { ok: true, cards: [], total: result.count };

  // The bucket is private, so sign every path in one round trip.
  const paths = rows.flatMap((r) =>
    r.thumbnail_path ? [r.storage_path, r.thumbnail_path] : [r.storage_path],
  );
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const urlByPath = new Map(
    (signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]),
  );

  const now = Date.now();
  const cards = rows.flatMap((r): ScreenshotCardData[] => {
    const url = urlByPath.get(r.storage_path);
    if (!url) return [];
    // Before migration 008, "new" uploads are stored as a marked "failed".
    const status = (
      r.status === "failed" && r.processing_error === NOT_ANALYZED_YET ? "new" : (r.status ?? "done")
    ) as ProcessingStatus;
    const startedAt = new Date(r.processing_started_at ?? r.created_at).getTime();
    return [
      {
        id: r.id,
        url,
        // Older photos have no thumbnail yet: show the original instead.
        thumbUrl: (r.thumbnail_path && urlByPath.get(r.thumbnail_path)) || url,
        filename: r.original_filename ?? r.storage_path.split("/").pop() ?? "",
        createdAt: r.created_at,
        status,
        stuck: (status === "pending" || status === "processing") && now - startedAt > STUCK_AFTER_MS,
        summary: r.summary,
        ocrText: r.ocr_text ?? null,
        categoryId: r.category_id ?? null,
        metadata: parseMetadata(r.metadata),
        tags: extractTagNames(r.screenshot_tags),
        error:
          r.status === "failed" && r.processing_error === QUOTA_ERROR_MESSAGE
            ? r.processing_error
            : null,
      },
    ];
  });
  return { ok: true, cards, total: result.count };
}

/**
 * Photos per album over the whole library, keyed by category id ("unsorted"
 * for photos without one). Null when migration 010 hasn't been run; the
 * gallery then counts what it has loaded.
 */
export async function loadAlbumCounts(
  supabase: SupabaseClient,
): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc("screenshot_counts");
  if (error || !Array.isArray(data)) return null;
  const counts: Record<string, number> = {};
  for (const row of data as { category_id: string | null; n: number | string }[]) {
    const key = row.category_id ?? "unsorted";
    counts[key] = (counts[key] ?? 0) + Number(row.n);
  }
  return counts;
}

// Supabase returns the nested join as an array (or a single object,
// depending on how it infers the relationship) — accept both.
function extractTagNames(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link: { tags?: { name: string } | { name: string }[] | null }) => {
    const t = link.tags;
    if (!t) return [];
    return Array.isArray(t) ? t.map((x) => x.name) : [t.name];
  });
}
