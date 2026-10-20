"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ScreenshotCard,
  type ScreenshotCardData,
  Spinner,
} from "@/components/screenshot-card";
import { ScreenshotModal } from "@/components/screenshot-modal";
import { useT } from "@/components/preferences";
import { Toaster } from "@/components/toast";
import { colorStyles, type UserCategory } from "@/lib/categories";
import { analyzeMultipleScreenshots, searchScreenshots } from "./actions";
import { ManageCategoriesDialog, openManageAlbums } from "./manage-categories";
import { GalleryHero } from "./gallery-hero";
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
  if (c.status === "new" || c.status === "failed" || c.stuck) return true;
  if (isProcessing(c)) return false;
  return c.categoryId === null;
}

function buildAlbums(
  cards: ScreenshotCardData[],
  categories: UserCategory[],
  labels: { all: string; unsorted: string },
): Album[] {
  const known = new Set(categories.map((c) => c.id));
  const byKey = new Map<AlbumKey, ScreenshotCardData[]>();
  for (const card of cards) {
    const key = card.categoryId && known.has(card.categoryId) ? card.categoryId : "unsorted";
    byKey.set(key, [...(byKey.get(key) ?? []), card]);
  }

  const albums: Album[] = [
    {
      key: "all",
      label: labels.all,
      dot: "bg-linear-to-br from-brand to-blush",
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
    albums.push({ key: "unsorted", label: labels.unsorted, dot: "bg-mute", cards: unsorted });
  }
  return albums;
}

// Up to 4 photos sharing tags (weighted higher) or the category.
function relatedTo(card: ScreenshotCardData, cards: ScreenshotCardData[]) {
  const tags = new Set(card.tags);
  return cards
    .filter((c) => c.id !== card.id)
    .map((c) => ({
      card: c,
      score:
        c.tags.filter((t) => tags.has(t)).length * 2 +
        (card.categoryId && c.categoryId === card.categoryId ? 1 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((r) => r.card);
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
  firstName,
}: {
  cards: ScreenshotCardData[];
  categories: UserCategory[];
  firstName: string;
}) {
  const t = useT();
  const searchParams = useSearchParams();
  const openKey = searchParams.get("album");
  const query = (searchParams.get("q") ?? "").trim();
  const searching = query !== "";

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  // Size of the latest "Sort" run, for the banner's progress bar.
  const [runTotal, setRunTotal] = useState<number | null>(null);
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

  const albums = buildAlbums(matched, categories, {
    all: t("albums.allPhotos"),
    unsorted: t("albums.unsorted"),
  });
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
      }
      if (queued > 0) setRunTotal(queued);
      setNotice(
        queued === 0 ? t("notice.nothing") : t("notice.analyzing", { count: queued }),
      );
      setSelectedIds(new Set());
    });
  }

  function reanalyze(list: ScreenshotCardData[], label: string) {
    const ok = window.confirm(
      t("notice.confirmReanalyze", { count: list.length, album: label }),
    );
    if (ok) analyze(list.map((c) => c.id), true);
  }

  // --- Detail modal (?photo=<id>) ---------------------------------------
  const openPhotoId = searchParams.get("photo");
  const openPhoto = openPhotoId ? (byId.get(openPhotoId) ?? null) : null;
  // True when we pushed the ?photo= entry ourselves, so closing can just go
  // Back; false when the page was opened directly on a photo link.
  const pushedPhoto = useRef(false);

  function setPhotoParam(id: string | null, mode: "push" | "replace") {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("photo", id);
    else params.delete("photo");
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  function showPhoto(id: string) {
    pushedPhoto.current = true;
    setPhotoParam(id, "push");
  }

  function closePhoto() {
    if (pushedPhoto.current) {
      pushedPhoto.current = false;
      window.history.back();
    } else {
      setPhotoParam(null, "replace");
    }
  }

  // ←/→ in the modal walk through whatever list is on screen.
  const visibleList = searching
    ? openKey && openKey !== "all"
      ? (openAlbum?.cards ?? [])
      : matched
    : (openAlbum?.cards ?? cards);
  const index = openPhoto ? visibleList.findIndex((c) => c.id === openPhoto.id) : -1;
  const prevId = index > 0 ? visibleList[index - 1].id : null;
  const nextId =
    index >= 0 && index < visibleList.length - 1 ? visibleList[index + 1].id : null;

  const cardProps = {
    categories,
    selectedIds,
    selectionMode,
    onToggle: toggle,
    onOpen: showPhoto,
  };

  return (
    <>
      <Toaster />
      {/* Home only: inside an album or a search the photos come first. */}
      {!searching && !openAlbum && (
        <GalleryHero
          cards={cards}
          albumCount={categories.length}
          firstName={firstName}
          toSort={cards.filter(needsAnalysis)}
          processing={cards.filter(isProcessing)}
          runTotal={runTotal}
          sorting={isAnalyzing}
          onSort={() => analyze(cards.filter(needsAnalysis).map((c) => c.id), false)}
          onOpenPhoto={showPhoto}
        />
      )}
      <ProcessingPoller active={cards.some(isProcessing)} />
      <ScreenshotModal
        screenshot={openPhoto}
        categories={categories}
        related={openPhoto ? relatedTo(openPhoto, cards) : []}
        onClose={closePhoto}
        onNavigate={(id) => setPhotoParam(id, "replace")}
        prevId={prevId}
        nextId={nextId}
      />

      <ManageCategoriesDialog categories={categories} counts={counts} />

      {notice && (
        <p
          role="status"
          className="mb-6 flex items-center gap-3 rounded-3xl bg-card px-5 py-3 text-sm text-ink/80 shadow-soft ring-1 ring-line"
        >
          <span aria-hidden className="font-hand text-2xl leading-none text-brand">✿</span>
          {notice}
        </p>
      )}

      {cards.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          body={t("empty.body")}
        />
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
          onReanalyzeAll={() => reanalyze(cards, t("albums.allPhotos"))}
        />
      )}

      {selectionMode && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-6">
          <div
            role="toolbar"
            aria-label="Selection actions"
            className="animate-rise flex flex-wrap items-center gap-2 rounded-full bg-card/95 py-2 pr-2 pl-5 shadow-lift ring-1 ring-line backdrop-blur-xl"
          >
            <span className="pr-2 text-sm font-semibold text-ink">
              <span className="font-hand text-2xl text-brand-deep">{selected.length}</span> {t("action.picked")}
            </span>
            <button
              type="button"
              onClick={() => analyze(selected.map((c) => c.id), false)}
              disabled={isAnalyzing || eligibleSelected === 0}
              title={
                eligibleSelected === 0
                  ? t("notice.nothing")
                  : undefined
              }
              className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase shadow-soft transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing && <Spinner />}
              {t("action.analyzeSelected")}
              {eligibleSelected > 0 && (
                <span className="text-white/75">({eligibleSelected})</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => analyze(selected.map((c) => c.id), true)}
              disabled={isAnalyzing}
              className="rounded-full bg-brand-soft px-4 py-2 text-xs font-semibold tracking-wide text-brand-deep uppercase transition hover:bg-brand/20 disabled:opacity-50"
            >
              {t("action.reanalyze")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              aria-label={t("action.clearSelection")}
              className="grid h-9 w-9 place-items-center rounded-full text-mute transition hover:bg-paper hover:text-ink"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SectionHeader({
  title,
  note,
  children,
}: {
  title: React.ReactNode;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {note && <p className="font-hand text-xl leading-none text-brand-deep">{note}</p>}
        <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink sm:text-xl">{title}</h2>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const PILL =
  "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold tracking-wide uppercase transition disabled:opacity-50";
const PILL_GHOST = `${PILL} bg-card text-ink/70 shadow-soft ring-1 ring-line hover:text-brand-deep`;

function DownloadZipLink({ albumKey, count }: { albumKey: AlbumKey; count: number }) {
  return (
    <a
      href={`/dashboard/download?album=${encodeURIComponent(albumKey)}`}
      download
      title={`Download ${count} photo${count === 1 ? "" : "s"} as a ZIP`}
      className={PILL_GHOST}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
      </svg>
      ZIP
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
  const t = useT();
  // Albums with photos first; empty categories at the end so new custom
  // ones are still visible.
  const filled = albums.filter((a) => a.cards.length > 0);
  const empty = albums.filter((a) => a.cards.length === 0);
  const all = albums.find((a) => a.key === "all");
  const albumCount = filled.length - 1;

  return (
    <>
      <SectionHeader
        note={t("albums.yourWalls")}
        title={albumCount === 1 ? t("albums.countOne") : t("albums.count", { count: albumCount })}
      >
        <button
          type="button"
          onClick={() => openManageAlbums("new")}
          className={`${PILL} bg-brand text-white shadow-lift hover:bg-brand-deep`}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          {t("albums.create")}
        </button>
        <button type="button" onClick={() => openManageAlbums()} className={PILL_GHOST}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h10M4 17h6m4 0h6M18 7h2M14 4v6m-4 4v6" />
          </svg>
          {t("albums.manageAlbums")}
        </button>
        {all && <DownloadZipLink albumKey="all" count={all.cards.length} />}
        <button type="button" onClick={onReanalyzeAll} disabled={isAnalyzing} className={PILL_GHOST}>
          {isAnalyzing && <Spinner />}
          {t("action.reanalyzeAll")}
        </button>
      </SectionHeader>

      <ul className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
        {[...filled, ...empty].map((album, i) => (
          <li key={album.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
            <AlbumCard album={album} onOpen={() => onOpen(album.key)} />
          </li>
        ))}
      </ul>
    </>
  );
}

// Up to three photos stacked like prints on a table; they fan out on hover.
const STACK = [
  "rotate-[-7deg] group-hover:-translate-x-[14%] group-hover:rotate-[-13deg]",
  "rotate-[5deg] group-hover:translate-x-[14%] group-hover:rotate-[11deg]",
  "rotate-0 group-hover:-translate-y-[6%] group-hover:scale-[1.03]",
];

function AlbumCard({ album, onOpen }: { album: Album; onOpen: () => void }) {
  const t = useT();
  // Last one drawn ends up on top, so the newest photo is the cover.
  const covers = album.cards.slice(0, 3).reverse();
  const analyzing = album.cards.filter(isProcessing).length;
  const isEmpty = album.cards.length === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isEmpty}
      className="group block w-full text-left outline-none disabled:cursor-default"
    >
      <div className="relative aspect-square">
        {isEmpty ? (
          <div
            className="sketch-border grid h-full place-items-center rounded-3xl bg-card/50 px-4 text-center"
            style={{ ["--c" as string]: "var(--color-line)" }}
          >
            <p className="font-hand text-xl text-mute">{t("albums.empty")}</p>
          </div>
        ) : (
          covers.map((c, i) => {
            const slot = STACK[i + (3 - covers.length)];
            return (
              <div
                key={c.id}
                className={`absolute inset-[7%] rounded-2xl bg-white p-1.5 pb-5 shadow-lift ring-1 ring-line/60 transition duration-500 ease-out ${slot}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full rounded-xl object-cover"
                />
              </div>
            );
          })
        )}
        {album.cards.length > 3 && (
          <span className="absolute right-1 bottom-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-brand-deep shadow-soft ring-1 ring-line">
            +{album.cards.length - 3}
          </span>
        )}
        {analyzing > 0 && (
          <span className="absolute top-1 left-1 flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-brand-deep shadow-soft">
            <Spinner />
            {analyzing}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 px-1">
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${album.dot}`} />
        <p
          className={`truncate font-semibold transition group-hover:text-brand-deep ${
            isEmpty ? "text-mute" : "text-ink"
          }`}
        >
          {album.label}
        </p>
      </div>
      <p className="mt-0.5 px-1 text-xs text-mute">
        {album.cards.length === 1
          ? t("albums.photosOne")
          : t("albums.photos", { count: album.cards.length })}
      </p>
    </button>
  );
}

type CardListProps = {
  categories: UserCategory[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
};

function CardGrid({
  cards,
  categories,
  selectedIds,
  selectionMode,
  onToggle,
  onOpen,
  dimmed = false,
}: CardListProps & { cards: ScreenshotCardData[]; dimmed?: boolean }) {
  return (
    <div
      className={`columns-2 gap-4 transition-opacity md:columns-3 lg:columns-4 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      {cards.map((card, i) => (
        <ScreenshotCard
          key={card.id}
          index={i}
          screenshot={card}
          categories={categories}
          selected={selectedIds.has(card.id)}
          selectionMode={selectionMode}
          onToggleSelect={onToggle}
          onOpen={onOpen}
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
  const t = useT();
  const allSelected =
    album.cards.length > 0 && album.cards.every((c) => cardProps.selectedIds.has(c.id));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("albums.back")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-ink/70 shadow-soft ring-1 ring-line transition hover:-translate-x-0.5 hover:text-brand-deep"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="font-hand text-xl leading-none text-brand-deep">
              {album.key === "unsorted" ? t("albums.findingHome") : t("albums.onThisWall")}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${album.dot}`} />
              <span className="truncate">{album.label}</span>
              <span className="text-base font-normal text-mute">{album.cards.length}</span>
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(album.cards.map((c) => c.id), !allSelected)}
            className={PILL_GHOST}
          >
            {allSelected ? t("action.deselectAll") : t("action.selectAll")}
          </button>
          <DownloadZipLink albumKey={album.key} count={album.cards.length} />
          <button type="button" onClick={onReanalyze} disabled={isAnalyzing} className={PILL_GHOST}>
            {isAnalyzing && !cardProps.selectionMode && <Spinner />}
            {t("action.reanalyze")}
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
  const t = useT();
  const allSelected =
    results.length > 0 && results.every((c) => cardProps.selectedIds.has(c.id));

  return (
    <>
      <SectionHeader
        note={loading ? t("search.looking") : t("search.found", { count: results.length })}
        title={
          <>
            “{query}”
            {albumLabel && <span className="font-normal text-mute"> {t("search.in", { album: albumLabel })}</span>}
          </>
        }
      >
        {albumLabel && !loading && (
          <button type="button" onClick={onClearAlbum} className={PILL_GHOST}>
            {t("action.searchAll")}
          </button>
        )}
        {results.length > 0 && !loading && (
          <button
            type="button"
            onClick={() => onSelectAll(results.map((c) => c.id), !allSelected)}
            className={PILL_GHOST}
          >
            {allSelected ? t("action.deselectAll") : t("action.selectAll")}
          </button>
        )}
      </SectionHeader>

      {error ? (
        <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      ) : !loading && results.length === 0 ? (
        <EmptyState
          title={t("search.noneTitle")}
          body={t("search.noneBody")}
        />
      ) : (
        <CardGrid {...cardProps} cards={results} dimmed={loading} />
      )}
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="sketch-border rounded-4xl bg-card/60 px-6 py-16 text-center backdrop-blur"
      style={{ ["--c" as string]: "#c9d6e4" }}
    >
      <div className="mx-auto mb-4 grid h-16 w-16 rotate-[-6deg] place-items-center rounded-2xl bg-card shadow-soft">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7 text-brand">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
        </svg>
      </div>
      <p className="font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-mute">{body}</p>
    </div>
  );
}
