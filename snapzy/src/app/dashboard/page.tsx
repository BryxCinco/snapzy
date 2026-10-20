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
import { Logo, WatercolorBackdrop } from "@/components/watercolor";
import { GalleryView } from "./gallery-view";
import { MobileNav } from "./mobile-nav";
import { TimeGreeting } from "./time-greeting";
import { SearchBar, SearchBarFallback } from "./search-bar";
import { UploadZone } from "./upload-zone";

export const metadata: Metadata = { title: "Dashboard · Snapzy" };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// With cacheComponents on, the page shell is static and anything that reads
// the session (cookies) streams in behind <Suspense>.
export default function DashboardPage() {
  return (
    <div className="paper-grain relative flex flex-1 flex-col">
      <WatercolorBackdrop />

      {/* Fixed h-16 so the sticky album bar can sit right under it (top-16). */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/70 bg-white/75 px-4 backdrop-blur-xl sm:gap-6 sm:px-6">
        <div className="shrink-0">
          <Logo href="/dashboard" />
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          {/* useSearchParams needs a Suspense boundary under cacheComponents. */}
          <Suspense fallback={<SearchBarFallback />}>
            <SearchBar />
          </Suspense>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <Suspense fallback={<span className="h-9 w-9 animate-pulse rounded-full bg-line" />}>
            <CurrentUser />
          </Suspense>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-32 sm:px-6 sm:pt-8 sm:pb-16">
        <section className="relative overflow-hidden rounded-4xl bg-linear-to-br from-brand via-[#8cbcf0] to-blush p-6 text-white shadow-lift sm:p-8">
          <div aria-hidden className="wash animate-drift -top-16 -right-10 h-72 w-72 bg-white/50" />
          <div aria-hidden className="wash animate-drift -bottom-24 left-1/3 h-64 w-96 bg-lilac" style={{ animationDelay: "-8s" }} />
          <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_minmax(0,26rem)]">
            <div>
              <Suspense fallback={<p className="font-hand text-3xl text-white/90">hello there,</p>}>
                <HeroGreeting />
              </Suspense>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Your gallery</h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
                Drop in screenshots and photos. AI reads them, writes a caption and
                hangs each one in the right album.
              </p>
            </div>
            <UploadZone />
          </div>
        </section>

        <div className="mt-8">
          <Suspense fallback={<GallerySkeleton />}>
            <Gallery />
          </Suspense>
        </div>
      </main>

      <MobileNav logout={<LogoutButton compact />} />
    </div>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        aria-label="Log out"
        title="Log out"
        className={
          compact
            ? "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-mute"
            : "flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-mute ring-1 ring-line transition hover:bg-white hover:text-ink"
        }
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={compact ? "h-5 w-5" : "h-4 w-4"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
        </svg>
        {compact ? "Log out" : <span className="hidden md:inline">Log out</span>}
      </button>
    </form>
  );
}

async function getSessionUser() {
  // Supabase reads the clock (Date.now()) to check token expiry. Opt out of
  // prerendering here, inside <Suspense>, so only this part waits for the request.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The proxy already guards this route; this is a second line of defense.
  if (!user) redirect("/login");
  return user;
}

// "brian.francisco1003@…" → "Brian"
function firstNameFrom(email: string | undefined) {
  const local = (email ?? "").split("@")[0].split(/[._+\-\d]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1).toLowerCase() : "there";
}

async function CurrentUser() {
  const user = await getSessionUser();
  const name = firstNameFrom(user.email);
  return (
    <span className="flex items-center gap-2.5">
      <span className="hidden max-w-44 truncate text-sm text-mute lg:inline">{user.email}</span>
      <span
        title={user.email}
        className="grid h-9 w-9 place-items-center rounded-full bg-linear-to-br from-brand to-lilac text-sm font-semibold text-white shadow-soft"
      >
        {name[0]}
      </span>
    </span>
  );
}

async function HeroGreeting() {
  const user = await getSessionUser();
  return <TimeGreeting name={firstNameFrom(user.email)} />;
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
  const user = await getSessionUser();
  const supabase = await createClient();

  // RLS limits both queries to the logged-in user's rows.
  const [{ data: rows, error }, categories] = await Promise.all([
    loadScreenshots(supabase),
    getUserCategories(supabase, user.id).catch((err: { message?: string }) => ({
      error: err?.message ?? "Unknown error",
    })),
  ]);

  if ("error" in categories) {
    return (
      <div className="rounded-3xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200">
        <p>
          Couldn&apos;t load your categories:{" "}
          <span className="font-mono">{categories.error}</span>
        </p>
        <p className="mt-1 text-amber-700/80">
          Make sure migrations 005 and 006 in{" "}
          <code className="font-mono">supabase/migrations/</code> have been run in
          the Supabase SQL Editor, then refresh.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
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

const skeletonHeights = ["h-48", "h-72", "h-60", "h-80", "h-52", "h-64", "h-56", "h-48"];

function GallerySkeleton() {
  return (
    <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
      {skeletonHeights.map((h, i) => (
        <div key={i} className="mb-4 break-inside-avoid rounded-3xl bg-white p-2.5 shadow-soft">
          <div className={`animate-pulse rounded-2xl bg-brand-soft ${h}`} />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-line" />
          <div className="mt-2 mb-1 h-2.5 w-1/3 animate-pulse rounded-full bg-line/70" />
        </div>
      ))}
    </div>
  );
}
