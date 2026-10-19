"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  categoryLabels,
  categoryStyles,
  ScreenshotCard,
  type ScreenshotCardData,
  Spinner,
} from "@/components/screenshot-card";
import { CATEGORIES, type Category, isCategory } from "@/lib/categories";
import { analyzeMultipleScreenshots } from "./actions";
import { ProcessingPoller } from "./processing-poller";

// "all" = every photo; "unsorted" = not analyzed yet, or still carrying a
// category from an older category list.
type AlbumKey = "all" | "unsorted" | Category;

type Album = {
  key: AlbumKey;
  label: string;
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
  return c.category !== null && !isCategory(c.category);
}

function albumKeyOf(c: ScreenshotCardData): AlbumKey {
  return isCategory(c.category) ? c.category : "unsorted";
}

function parseAlbumKey(value: string | null): AlbumKey | null {
  if (value === "all" || value === "unsorted" || isCategory(value)) return value;
  return null;
}

function buildAlbums(cards: ScreenshotCardData[]): Album[] {
  const byKey = new Map<AlbumKey, ScreenshotCardData[]>();
  for (const c of cards) {
    const key = albumKeyOf(c);
    byKey.set(key, [...(byKey.get(key) ?? []), c]);
  }
  const albums: Album[] = [{ key: "all", label: "All photos", cards }];
  for (const category of CATEGORIES) {
    const list = byKey.get(category);
    if (list) albums.push({ key: category, label: categoryLabels[category], cards: list });
  }
  const unsorted = byKey.get("unsorted");
  if (unsorted) albums.push({ key: "unsorted", label: "Unsorted", cards: unsorted });
  return albums;
}

export function GalleryView({ cards }: { cards: ScreenshotCardData[] }) {
  const searchParams = useSearchParams();
  const openKey = parseAlbumKey(searchParams.get("album"));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [isAnalyzing, startAnalyze] = useTransition();

  const albums = buildAlbums(cards);
  const openAlbum = openKey ? albums.find((a) => a.key === openKey) : undefined;

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

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
        <p className="font-medium text-zinc-200">No photos yet</p>
        <p className="mt-1 text-sm text-zinc-500">
          Drop one above or press Ctrl + V to paste from your clipboard.
        </p>
      </div>
    );
  }

  return (
    <>
      <ProcessingPoller active={cards.some(isProcessing)} />

      <AlbumSwitcher albums={albums} openKey={openAlbum?.key ?? null} onOpen={openAlbumKey} />

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300"
        >
          {notice}
        </p>
      )}

      {openAlbum ? (
        <AlbumDetail
          album={openAlbum}
          selectedIds={selectedIds}
          selectionMode={selectionMode}
          isAnalyzing={isAnalyzing}
          onBack={() => openAlbumKey(null)}
          onToggle={toggle}
          onSelectAll={(ids, select) =>
            setSelectedIds((prev) => {
              const next = new Set([...prev].filter((x) => cardIds.has(x)));
              ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
              return next;
            })
          }
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

// Sticky chip bar under the header: "Albums" home plus a chip per album.
function AlbumSwitcher({
  albums,
  openKey,
  onOpen,
}: {
  albums: Album[];
  openKey: AlbumKey | null;
  onOpen: (key: AlbumKey | null) => void;
}) {
  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-zinc-100 text-zinc-950"
        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
    }`;

  return (
    <nav
      aria-label="Albums"
      className="sticky top-16 z-20 -mx-4 mb-6 border-b border-zinc-800 bg-zinc-950/85 px-4 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
        <button
          type="button"
          aria-current={openKey === null ? "page" : undefined}
          onClick={() => onOpen(null)}
          className={chip(openKey === null)}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          Albums
        </button>
        <span aria-hidden className="mx-1 my-2 w-px shrink-0 bg-zinc-800" />
        {albums.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-current={openKey === a.key ? "page" : undefined}
            onClick={() => onOpen(a.key)}
            className={chip(openKey === a.key)}
          >
            {a.label}
            <span className={`text-xs tabular-nums ${openKey === a.key ? "text-zinc-500" : "text-zinc-600"}`}>
              {a.cards.length}
            </span>
          </button>
        ))}
      </div>
    </nav>
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
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {albums.length - 1} album{albums.length - 1 === 1 ? "" : "s"}
        </p>
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

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((album) => (
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
  const dot =
    album.key === "all"
      ? "bg-linear-to-br from-violet-400 to-cyan-300"
      : album.key === "unsorted"
        ? "bg-zinc-600"
        : categoryStyles[album.key].split(" ")[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full text-left outline-none"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition group-hover:border-zinc-600 group-focus-visible:ring-2 group-focus-visible:ring-violet-500/60">
        <Collage cards={covers} />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
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
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <p className="truncate font-medium text-zinc-100">{album.label}</p>
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

function AlbumDetail({
  album,
  selectedIds,
  selectionMode,
  isAnalyzing,
  onBack,
  onToggle,
  onSelectAll,
  onReanalyze,
}: {
  album: Album;
  selectedIds: Set<string>;
  selectionMode: boolean;
  isAnalyzing: boolean;
  onBack: () => void;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], select: boolean) => void;
  onReanalyze: () => void;
}) {
  const allSelected =
    album.cards.length > 0 && album.cards.every((c) => selectedIds.has(c.id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to albums"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
              {album.label}
            </h2>
            <p className="text-sm text-zinc-500">
              {album.cards.length} photo{album.cards.length === 1 ? "" : "s"}
              {album.key === "unsorted" && " · still analyzing or need re-analysis"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(album.cards.map((c) => c.id), !allSelected)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={onReanalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-60"
          >
            {isAnalyzing && !selectionMode && <Spinner />}
            Re-analyze album
          </button>
        </div>
      </div>

      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {album.cards.map((card) => (
          <ScreenshotCard
            key={card.id}
            screenshot={card}
            selected={selectedIds.has(card.id)}
            selectionMode={selectionMode}
            onToggleSelect={onToggle}
          />
        ))}
      </div>
    </>
  );
}
