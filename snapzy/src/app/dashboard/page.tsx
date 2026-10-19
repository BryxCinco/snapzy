import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import type { ScreenshotCardData } from "@/components/screenshot-card";
import { type ProcessingStatus, STUCK_AFTER_MS } from "@/lib/categories";
import { getUserCategories } from "@/lib/categories-server";
import { parseMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/supabase/server";
import { GalleryView } from "./gallery-view";
import { SearchBar, SearchBarFallback } from "./search-bar";
import { UploadZone } from "./upload-zone";

export const metadata: Metadata = { title: "Dashboard · Snapzy" };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// With cacheComponents on, the page shell is static and anything that reads
// the session (cookies) streams in behind <Suspense>.
export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      {/* Fixed h-16 so the sticky album bar can sit right under it (top-16). */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur sm:gap-6 sm:px-6">
        <div className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-linear-to-br from-violet-500 to-cyan-400 text-xs font-bold text-zinc-950">
            S
          </span>
          <span className="hidden sm:inline">Snapzy</span>
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          {/* useSearchParams needs a Suspense boundary under cacheComponents. */}
          <Suspense fallback={<SearchBarFallback />}>
            <SearchBar />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Suspense
            fallback={
              <span className="hidden h-4 w-40 animate-pulse rounded bg-zinc-800 lg:inline-block" />
            }
          >
            <CurrentUser />
          </Suspense>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Log out"
              title="Log out"
              className="flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 sm:px-3"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 sm:hidden">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
              </svg>
              <span className="hidden sm:inline">Log out</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Your library</h1>
        <p className="mt-1 text-sm text-zinc-400">
          AI sorts every photo into albums. Search finds the text inside them.
        </p>

        <div className="mt-6">
          <UploadZone />
        </div>

        <div className="mt-10">
          <Suspense fallback={<GallerySkeleton />}>
            <Gallery />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function CurrentUser() {
  // Supabase reads the clock (Date.now()) to check token expiry. Opt out of
  // prerendering here, inside <Suspense>, so only this part waits for the request.
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already guards this route; this is a second line of defense.
  if (!user) {
    redirect("/login");
  }

  return (
    <span className="hidden max-w-48 truncate text-sm text-zinc-400 lg:inline">
      {user.email}
    </span>
  );
}

const SCREENSHOT_COLUMNS =
  "id, storage_path, original_filename, created_at, summary, ocr_text, category_id, status, processing_started_at, screenshot_tags(tags(name))";

async function loadScreenshots(supabase: Awaited<ReturnType<typeof createClient>>) {
  const query = (columns: string) =>
    supabase
      .from("screenshots")
      .select(columns)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .overrideTypes<ScreenshotRow[], { merge: false }>();

  const result = await query(`${SCREENSHOT_COLUMNS}, metadata`);
  // 42703 = undefined column: migration 007 (metadata) not applied yet.
  // The gallery still works, just without smart cards.
  if (result.error?.code === "42703") return query(SCREENSHOT_COLUMNS);
  return result;
}

type ScreenshotRow = {
  id: string;
  storage_path: string;
  original_filename: string | null;
  created_at: string;
  summary: string | null;
  ocr_text: string | null;
  category_id: string | null;
  status: string | null;
  processing_started_at: string | null;
  metadata?: unknown;
  screenshot_tags: unknown;
};

async function Gallery() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS limits both queries to the logged-in user's rows.
  const [{ data: rows, error }, categories] = await Promise.all([
    loadScreenshots(supabase),
    getUserCategories(supabase, user.id).catch((err: { message?: string }) => ({
      error: err?.message ?? "Unknown error",
    })),
  ]);

  if ("error" in categories) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        <p>
          Couldn&apos;t load your categories:{" "}
          <span className="font-mono">{categories.error}</span>
        </p>
        <p className="mt-1 text-amber-200/70">
          Make sure migrations 005 and 006 in{" "}
          <code className="font-mono">supabase/migrations/</code> have been run in
          the Supabase SQL Editor, then refresh.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        Couldn&apos;t load your screenshots: {error.message}
      </p>
    );
  }

  if (!rows || rows.length === 0) {
    return <GalleryView cards={[]} categories={categories} />;
  }

  // The bucket is private, so sign every path in one round trip.
  const { data: signed } = await supabase.storage
    .from("screenshots")
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );
  const urlByPath = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl)
      .map((s) => [s.path, s.signedUrl]),
  );

  const now = requestTime();
  const cards: ScreenshotCardData[] = rows.flatMap((r) => {
    const url = urlByPath.get(r.storage_path);
    if (!url) return [];
    const status = (r.status ?? "done") as ProcessingStatus;
    const startedAt = new Date(r.processing_started_at ?? r.created_at).getTime();
    return [
      {
        id: r.id,
        url,
        filename: r.original_filename ?? r.storage_path.split("/").pop() ?? "",
        createdAt: r.created_at,
        status,
        stuck:
          (status === "pending" || status === "processing") &&
          now - startedAt > STUCK_AFTER_MS,
        summary: r.summary,
        ocrText: r.ocr_text ?? null,
        categoryId: r.category_id ?? null,
        metadata: parseMetadata(r.metadata),
        tags: extractTagNames(r.screenshot_tags),
      },
    ];
  });

  return <GalleryView cards={cards} categories={categories} />;
}

// Only called after `await connection()`, so this is per-request time, not a
// value baked into a prerender.
function requestTime() {
  return Date.now();
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

const skeletonHeights =["h-40", "h-64", "h-52", "h-72", "h-44", "h-60", "h-56", "h-48"];

function GallerySkeleton() {
  return (
    <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
      {skeletonHeights.map((h, i) => (
        <div
          key={i}
          className={`mb-4 break-inside-avoid animate-pulse rounded-xl bg-zinc-900 ${h}`}
        />
      ))}
    </div>
  );
}
