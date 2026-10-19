"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ScreenshotCard,
  type ScreenshotCardData,
  Spinner,
} from "@/components/screenshot-card";
import { Toaster } from "@/components/toast";
import { colorStyles, type UserCategory } from "@/lib/categories";
import { analyzeMultipleScreenshots, searchScreenshots } from "./actions";
import { ManageCategoriesButton } from "./manage-categories";
import { ProcessingPoller } from "./processing-poller";

// "all" = every photo; "unsorted" = no category yet (still analyzing or
// analysis failed); anything else is a category id.
type AlbumKey = string;

type Album = {
  key: AlbumKey;
  label: string;
  dot: string;
  cards: ScreenshotCardData[];
};

// Must match MAX_BULK_IDS in actions.ts.
const BULK_CHUNK = 100;

function isProcessing(c: ScreenshotCardData) {
  return !c.stuck && (c.status === "pending" || c.status === "processing");
}

// Mirrors needsAnalysis() on the server, which has the final say.
function needsAnalysis(c: ScreenshotCardData) {
  if (c.status === "failed" || c.stuck) return true;
  if (isProcessing(c)) return false;
  return c.categoryId === null;
}

function buildAlbums(cards: ScreenshotCardData[], categories: UserCategory[]): Album[] {
  const known = new Set(categories.map((c) => c.id));
  const byKey = new Map<AlbumKey, ScreenshotCardData[]>();
  for (const card of cards) {
    const key = card.categoryId && known.has(card.categoryId) ? card.categoryId : "unsorted";
    byKey.set(key, [...(byKey.get(key) ?? []), card]);
  }

  const albums: Album[] = [
    {
      key: "all",
      label: "All photos",
      dot: "bg-linear-to-br from-violet-400 to-cyan-300",
      cards,
    },
    ...categories.map((c) => ({
      key: c.id,
      label: c.name,
      dot: colorStyles[c.color].dot,
      cards: byKey.get(c.id) ?? [],
    })),
  ];
  const unsorted = byKey.get("unsorted");
  if (unsorted) {
    albums.push({ key: "unsorted", label: "Unsorted", dot: "bg-zinc-600", cards: unsorted });
  }
  return albums;
}

type SearchState = {
  query: string;
  ids: string[];
  error: string | null;
};

// Runs the server search whenever ?q= changes (SearchBar debounces it).
// Also re-runs as photos finish analyzing, so fresh OCR text is searchable.
function useSearch(query: string, doneCount: number) {
  const [state, setState] = useState<SearchState>({ query: "", ids: [], error: null });

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    searchScreenshots(query)
      .then((result) => {
        if (cancelled) return;
        setState(
          result.ok
            ? { query, ids: result.ids, error: null }
            : { query, ids: [], error: result.error },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ query, ids: [], error: "Search failed. Try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [query, doneCount]);

  const loading = query !== "" && state.query !== query;
  return { ...state, loading };
}

export function GalleryView({
  cards,
  categories,
}: {
  cards: ScreenshotCardData[];
  categories: UserCategory[];
}) {
  const searchParams = useSearchParams();
  const openKey = searchParams.get("album");
  const query = (searchParams.get("q") ?? "").trim();
  const searching = query !== "";

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [isAnalyzing, startAnalyze] = useTransition();

  const search = useSearch(query, cards.filter((c) => c.status === "done").length);

  // While searching, everything below works on the matches only, in rank
  // order, so the album chips and the open album filter the results.
  const byId = new Map(cards.map((c) => [c.id, c]));
  const matched = searching
    ? search.ids.flatMap((id) => {
        const card = byId.get(id);
        return card ? [card] : [];
      })
    : cards;

  const albums = buildAlbums(matched, categories);
  const openAlbum = openKey ? albums.find((a) => a.key === openKey) : undefined;

  // Photo counts per category over the whole library (for the manage dialog).
  const counts = new Map<string, number>();
  for (const c of cards) {
    if (c.categoryId) counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
  }

  // Drop ids of cards that no longer exist (e.g. deleted).
  const cardIds = new Set(cards.map((c) => c.id));
  const selected = cards.filter((c) => selectedIds.has(c.id));
  const selectionMode = selected.length > 0;
  const eligibleSelected = selected.filter(needsAnalysis).length;

  // pushState keeps it a client-side change but gives each album its own URL,
  // so the browser Back button returns to the album list.
  function openAlbumKey(key: AlbumKey | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (key) params.set("album", key);
    else params.delete("album");
    const qs = params.toString();
    window.history.pushState(null, "", qs ? `?${qs}` : window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((x) => cardIds.has(x)));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectMany = (ids: string[], select: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((x) => cardIds.has(x)));
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });

  function analyze(ids: string[], includeDone: boolean) {
    setNotice(null);
    startAnalyze(async () => {
      let queued = 0;
      let skipped = 0;
      for (let i = 0; i < ids.length; i += BULK_CHUNK) {
        const result = await analyzeMultipleScreenshots(
          ids.slice(i, i + BULK_CHUNK),
          { includeDone },
        );
        if (!result.ok) {
          setNotice(result.error);
          return;
        }
        queued += result.queued;
        skipped += result.skipped;
      }
      setNotice(
        queued === 0
          ? "Nothing to analyze. These are already up to date."
          : `Analyzing ${queued} photo${queued === 1 ? "" : "s"}${
              skipped ? ` · ${skipped} already up to date` : ""
            }. They'll move into the right albums when done.`,
      );
      setSelectedIds(new Set());
    });
  }

  function reanalyze(list: ScreenshotCardData[], label: string) {
    const ok = window.confirm(
      `Re-analyze ${list.length} photo${list.length === 1 ? "" : "s"} in "${label}"? Every image is sent to the AI again, which may take a few minutes.`,
    );
    if (ok) analyze(list.map((c) => c.id), true);
  }

  const cardProps = {
    categories,
    selectedIds,
    selectionMode,
    onToggle: toggle,
  };

  return (
    <>
      <Toaster />
      <ProcessingPoller active={cards.some(isProcessing)} />

      <AlbumSwitcher
        albums={albums}
        openKey={searching ? openKey : (openAlbum?.key ?? null)}
        searching={searching}
        onOpen={openAlbumKey}
        manage={<ManageCategoriesButton categories={categories} counts={counts} />}
      />

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300"
        >
          {notice}
        </p>
      )}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
          <p className="font-medium text-zinc-200">No photos yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Drop one above or press Ctrl + V to paste from your clipboard.
          </p>
        </div>
      ) : searching ? (
        <SearchResults
          {...cardProps}
          query={query}
          loading={search.loading}
          error={search.error}
          albumLabel={openKey && openKey !== "all" ? (openAlbum?.label ?? null) : null}
          results={openKey && openKey !== "all" ? (openAlbum?.cards ?? []) : matched}
          onSelectAll={selectMany}
          onClearAlbum={() => openAlbumKey(null)}
        />
      ) : openAlbum ? (
        <AlbumDetail
          {...cardProps}
          album={openAlbum}
          isAnalyzing={isAnalyzing}
          onBack={() => openAlbumKey(null)}
          onSelectAll={selectMany}
          onReanalyze={() => reanalyze(openAlbum.cards, openAlbum.label)}
        />
      ) : (
        <AlbumGrid
          albums={albums}
          isAnalyzing={isAnalyzing}
          onOpen={openAlbumKey}
          onReanalyzeAll={() => reanalyze(cards, "All photos")}
        />
      )}

      {selectionMode && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div
            role="toolbar"
            aria-label="Selection actions"
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur"
          >
            <span className="pr-2 text-sm font-medium text-zinc-100">
              {selected.length} selected
            </span>
            <button
              type="button"
              onClick={() => analyze(selected.map((c) => c.id), false)}
              disabled={isAnalyzing || eligibleSelected === 0}
              title={
                eligibleSelected === 0
                  ? "All selected photos are already analyzed. Use Re-analyze."
                  : undefined
              }
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing && <Spinner />}
              Analyze selected
              {eligibleSelected > 0 && (
                <span className="text-xs text-violet-200">({eligibleSelected})</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => analyze(selected.map((c) => c.id), true)}
              disabled={isAnalyzing}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
            >
              Re-analyze
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Sticky chip bar under the header: "Albums" home, a chip per non-empty
// album, and "Manage" for editing categories.
function AlbumSwitcher({
  albums,
  openKey,
  searching,
  onOpen,
  manage,
}: {
  albums: Album[];
  openKey: AlbumKey | null;
  searching: boolean;
  onOpen: (key: AlbumKey | null) => void;
  manage: React.ReactNode;
}) {
  // While searching, the first chip means "all results" and the per-album
  // chips narrow the results, so the separate "All photos" chip is redundant.
  const chips = albums.filter(
    (a) => a.cards.length > 0 && !(searching && a.key === "all"),
  );
  const homeActive = openKey === null || (searching && openKey === "all");

  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-zinc-100 text-zinc-950"
        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
    }`;

  return (
    <nav
      aria-label="Albums"
      className="sticky top-16 z-20 -mx-4 mb-6 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/85 px-4 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 scrollbar-none">
        <button
          type="button"
          aria-current={homeActive ? "page" : undefined}
          onClick={() => onOpen(null)}
          className={chip(homeActive)}
        >
          {searching ? (
            <>
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
              All results
            </>
          ) : (
            <>
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              Albums
            </>
          )}
        </button>
        <span aria-hidden className="mx-1 my-2 w-px shrink-0 bg-zinc-800" />
        {chips.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-current={openKey === a.key ? "page" : undefined}
            onClick={() => onOpen(a.key)}
            className={chip(openKey === a.key)}
          >
            <span className="max-w-40 truncate">{a.label}</span>
            <span className={`text-xs tabular-nums ${openKey === a.key ? "text-zinc-500" : "text-zinc-600"}`}>
              {a.cards.length}
            </span>
          </button>
        ))}
      </div>
      <span aria-hidden className="my-2 w-px self-stretch bg-zinc-800" />
      {manage}
    </nav>
  );
}

function DownloadZipLink({ albumKey, count }: { albumKey: AlbumKey; count: number }) {
  return (
    <a
      href={`/dashboard/download?album=${encodeURIComponent(albumKey)}`}
      download
      title={`Download ${count} photo${count === 1 ? "" : "s"} as a ZIP`}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
      </svg>
      <span className="hidden sm:inline">Download</span> ZIP
    </a>
  );
}

function AlbumGrid({
  albums,
  isAnalyzing,
  onOpen,
  onReanalyzeAll,
}: {
  albums: Album[];
  isAnalyzing: boolean;
  onOpen: (key: AlbumKey) => void;
  onReanalyzeAll: () => void;
}) {
  // Albums with photos first; empty categories at the end so new custom
  // ones are still visible.
  const filled = albums.filter((a) => a.cards.length > 0);
  const empty = albums.filter((a) => a.cards.length === 0);
  const all = albums.find((a) => a.key === "all");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {filled.length - 1} album{filled.length - 1 === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          {all && <DownloadZipLink albumKey="all" count={all.cards.length} />}
          <button
            type="button"
            onClick={onReanalyzeAll}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-60"
          >
            {isAnalyzing && <Spinner />}
            Re-analyze all
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {[...filled, ...empty].map((album) => (
          <li key={album.key}>
            <AlbumCard album={album} onOpen={() => onOpen(album.key)} />
          </li>
        ))}
      </ul>
    </>
  );
}

function AlbumCard({ album, onOpen }: { album: Album; onOpen: () => void }) {
  const covers = album.cards.slice(0, 4);
  const analyzing = album.cards.filter(isProcessing).length;
  const isEmpty = album.cards.length === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isEmpty}
      className="group block w-full text-left outline-none disabled:cursor-default"
    >
      <div
        className={`relative aspect-square overflow-hidden rounded-2xl border transition group-focus-visible:ring-2 group-focus-visible:ring-violet-500/60 ${
          isEmpty
            ? "border-dashed border-zinc-800 bg-zinc-950"
            : "border-zinc-800 bg-zinc-900 group-hover:border-zinc-600"
        }`}
      >
        {isEmpty ? (
          <div className="grid h-full place-items-center px-4 text-center text-xs text-zinc-600">
            No photos yet
          </div>
        ) : (
          <>
            <Collage cards={covers} />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          </>
        )}
        {album.cards.length > covers.length && (
          <span className="absolute right-2 bottom-2 rounded-full bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur">
            +{album.cards.length - covers.length}
          </span>
        )}
        {analyzing > 0 && (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur">
            <Spinner />
            {analyzing}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${album.dot}`} />
        <p className={`truncate font-medium ${isEmpty ? "text-zinc-500" : "text-zinc-100"}`}>
          {album.label}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">
        {album.cards.length} photo{album.cards.length === 1 ? "" : "s"}
      </p>
    </button>
  );
}

// 1 → full, 2 → side by side, 3 → one tall + two stacked, 4 → 2×2.
function Collage({ cards }: { cards: ScreenshotCardData[] }) {
  const layout =
    cards.length === 1
      ? "grid-cols-1 grid-rows-1"
      : cards.length === 2
        ? "grid-cols-2 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return (
    <div className={`grid h-full w-full gap-0.5 ${layout}`}>
      {cards.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c.id}
          src={c.url}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105 ${
            cards.length === 3 && i === 0 ? "row-span-2" : ""
          }`}
        />
      ))}
    </div>
  );
}

type CardListProps = {
  categories: UserCategory[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  onToggle: (id: string) => void;
};

function CardGrid({
  cards,
  categories,
  selectedIds,
  selectionMode,
  onToggle,
  dimmed = false,
}: CardListProps & { cards: ScreenshotCardData[]; dimmed?: boolean }) {
  return (
    <div
      className={`columns-2 gap-4 transition-opacity md:columns-3 lg:columns-4 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      {cards.map((card) => (
        <ScreenshotCard
          key={card.id}
          screenshot={card}
          categories={categories}
          selected={selectedIds.has(card.id)}
          selectionMode={selectionMode}
          onToggleSelect={onToggle}
        />
      ))}
    </div>
  );
}

function AlbumDetail({
  album,
  isAnalyzing,
  onBack,
  onSelectAll,
  onReanalyze,
  ...cardProps
}: CardListProps & {
  album: Album;
  isAnalyzing: boolean;
  onBack: () => void;
  onSelectAll: (ids: string[], select: boolean) => void;
  onReanalyze: () => void;
}) {
  const allSelected =
    album.cards.length > 0 && album.cards.every((c) => cardProps.selectedIds.has(c.id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to albums"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-100">
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${album.dot}`} />
              <span className="truncate">{album.label}</span>
            </h2>
            <p className="text-sm text-zinc-500">
              {album.cards.length} photo{album.cards.length === 1 ? "" : "s"}
              {album.key === "unsorted" && " · still analyzing or need re-analysis"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(album.cards.map((c) => c.id), !allSelected)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <DownloadZipLink albumKey={album.key} count={album.cards.length} />
          <button
            type="button"
            onClick={onReanalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-60"
          >
            {isAnalyzing && !cardProps.selectionMode && <Spinner />}
            Re-analyze
          </button>
        </div>
      </div>

      <CardGrid {...cardProps} cards={album.cards} />
    </>
  );
}

function SearchResults({
  query,
  loading,
  error,
  albumLabel,
  results,
  onSelectAll,
  onClearAlbum,
  ...cardProps
}: CardListProps & {
  query: string;
  loading: boolean;
  error: string | null;
  // Set when an album chip narrows the results.
  albumLabel: string | null;
  results: ScreenshotCardData[];
  onSelectAll: (ids: string[], select: boolean) => void;
  onClearAlbum: () => void;
}) {
  const allSelected =
    results.length > 0 && results.every((c) => cardProps.selectedIds.has(c.id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {loading && <Spinner />}
          <p className="min-w-0 truncate text-sm text-zinc-400">
            {loading ? (
              "Searching…"
            ) : (
              <>
                <span className="font-medium text-zinc-100">{results.length}</span>{" "}
                result{results.length === 1 ? "" : "s"} for{" "}
                <span className="font-medium text-zinc-100">“{query}”</span>
                {albumLabel && <> in {albumLabel}</>}
              </>
            )}
          </p>
          {albumLabel && !loading && (
            <button
              type="button"
              onClick={onClearAlbum}
              className="shrink-0 text-sm font-medium text-violet-400 hover:text-violet-300"
            >
              Search all albums
            </button>
          )}
        </div>
        {results.length > 0 && !loading && (
          <button
            type="button"
            onClick={() => onSelectAll(results.map((c) => c.id), !allSelected)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : !loading && results.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <p className="font-medium text-zinc-200">No matches</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
            Search looks at the text inside your photos and their AI summaries.
            Try another word, or a phrase in quotes like “order total”.
          </p>
        </div>
      ) : (
        <CardGrid {...cardProps} cards={results} dimmed={loading} />
      )}
    </>
  );
}
