"use client";

import { useState, useSyncExternalStore } from "react";
import { useT } from "@/components/preferences";
import { type ScreenshotCardData, Spinner } from "@/components/screenshot-card";
import { BULK_CONCURRENCY, SECONDS_PER_PHOTO } from "@/lib/categories";
import type { MessageKey } from "@/lib/i18n";
import { TimeGreeting } from "./time-greeting";
import { UploadZone } from "./upload-zone";

// Picked once per page load in the browser, so the banner shows a different
// trio each visit. The server (and the first client render) use 0, which
// keeps hydration consistent.
const SESSION_SEED = typeof window === "undefined" ? 0 : Math.random();
const noop = () => () => {};

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickRandom(cards: ScreenshotCardData[], seed: number, count: number) {
  return [...cards]
    .sort((a, b) => hash(`${a.id}:${seed}`) - hash(`${b.id}:${seed}`))
    .slice(0, count);
}

/** "about 20 sec" / "about 2 min" for n photos, at BULK_CONCURRENCY at a time. */
export function useEstimate() {
  const t = useT();
  return (photos: number) => {
    const seconds = Math.ceil(photos / BULK_CONCURRENCY) * SECONDS_PER_PHOTO;
    const time =
      seconds < 60
        ? t("time.sec", { n: Math.max(5, Math.round(seconds / 5) * 5) })
        : t("time.min", { n: Math.round(seconds / 60) });
    return t("hero.about", { time });
  };
}

const PRINT_SLOTS = [
  "left-0 top-3 -rotate-8 group-hover:-translate-x-3 group-hover:-rotate-14",
  "left-1/2 top-0 -translate-x-1/2 rotate-3 z-10 group-hover:-translate-y-2 group-hover:rotate-0",
  "right-0 top-4 rotate-10 group-hover:translate-x-3 group-hover:rotate-16",
];

export function GalleryHero({
  cards,
  albumCount,
  firstName,
  toSort,
  processingCount,
  runTotal,
  sorting,
  onSort,
  onOpenPhoto,
}: {
  cards: ScreenshotCardData[];
  albumCount: number;
  firstName: string;
  // Photos waiting for analysis (new, failed, stuck, uncategorized).
  toSort: ScreenshotCardData[];
  processingCount: number;
  // How many photos the current "Sort" run started with (for the bar).
  runTotal: number | null;
  sorting: boolean;
  onSort: () => void;
  onOpenPhoto: (id: string) => void;
}) {
  const t = useT();
  const estimate = useEstimate();
  const sessionSeed = useSyncExternalStore(noop, () => SESSION_SEED, () => 0);
  const [shuffles, setShuffles] = useState(0);
  const prints = pickRandom(cards, sessionSeed + shuffles, 3);

  const busy = processingCount > 0;
  const total = Math.max(runTotal ?? processingCount, processingCount);
  const progress = busy && total > 0 ? (total - processingCount) / total : 0;

  return (
    <section className="hero-wash text-shadow-soft relative mb-6 overflow-hidden rounded-4xl px-5 py-5 text-white shadow-lift sm:px-7 sm:py-6">
      <div aria-hidden className="wash animate-drift -top-20 -right-16 h-72 w-72 bg-white opacity-15" />
      <div
        aria-hidden
        className="wash animate-drift -bottom-24 left-1/4 h-64 w-96 bg-[#c47596] opacity-35"
        style={{ animationDelay: "-8s" }}
      />

      <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <TimeGreeting name={firstName} />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("hero.title")}</h1>
            <p className="mt-1 hidden max-w-md text-sm leading-relaxed text-white/90 md:block">
              {t("hero.subtitle")}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
              {t("settings.libraryValue", { photos: cards.length, albums: albumCount })}
            </p>
          </div>

          {/* Three random photos from the library, as a little pile of prints. */}
          {prints.length > 0 && (
            <div className="group relative h-24 w-32 shrink-0 sm:h-32 sm:w-44">
              {prints.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenPhoto(p.id)}
                  title={p.summary ?? p.filename}
                  className={`absolute h-20 w-16 rounded-md bg-white p-1 pb-3.5 shadow-lift transition duration-500 ease-out hover:z-20 hover:scale-110 sm:h-28 sm:w-22 sm:pb-5 ${
                    PRINT_SLOTS[i]
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full rounded-sm object-cover" />
                </button>
              ))}
              {cards.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShuffles((n) => n + 1)}
                  aria-label={t("hero.shuffle")}
                  title={t("hero.shuffle")}
                  className="absolute -right-2 -bottom-2 z-30 grid h-8 w-8 place-items-center rounded-full bg-white text-[#5b74d3] shadow-lift transition hover:rotate-180"
                >
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h3a5 5 0 0 1 4 2l2 3a5 5 0 0 0 4 2h3m0 0-3-3m3 3-3 3M4 17h3a5 5 0 0 0 3-1M20 7h-3a5 5 0 0 0-3 1m6-1-3-3m3 3-3 3" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Phones upload with the big + in the bottom bar instead. */}
          <div className="hidden sm:block">
            <UploadZone />
          </div>

          <SortTile
            toSortCount={toSort.length}
            busy={busy}
            processingCount={processingCount}
            progress={progress}
            sorting={sorting}
            estimate={estimate}
            onSort={onSort}
            t={t}
          />
        </div>
      </div>
    </section>
  );
}

function SortTile({
  toSortCount,
  busy,
  processingCount,
  progress,
  sorting,
  estimate,
  onSort,
  t,
}: {
  toSortCount: number;
  busy: boolean;
  processingCount: number;
  progress: number;
  sorting: boolean;
  estimate: (n: number) => string;
  onSort: () => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-3xl bg-white/15 p-4 ring-1 ring-white/35 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#5b74d3] shadow-soft">
          {busy ? (
            <Spinner />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 2l2.2 6.1L20 10l-5.8 1.9L12 18l-2.2-6.1L4 10l5.8-1.9L12 2zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
            </svg>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {busy ? t("hero.sorting", { count: processingCount }) : t("hero.sort")}
          </p>
          <p className="mt-0.5 font-hand text-lg leading-tight text-white/90">
            {busy
              ? t("hero.left", { time: estimate(processingCount) })
              : toSortCount > 0
                ? `${t("hero.waiting", { count: toSortCount })} · ${estimate(toSortCount)}`
                : t("hero.allSorted")}
          </p>
        </div>
      </div>

      {busy ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="relative h-2 overflow-hidden rounded-full bg-white/25"
        >
          <div
            className="h-full rounded-full bg-white transition-[width] duration-700"
            style={{ width: `${Math.max(progress * 100, 6)}%` }}
          />
          <div className="absolute inset-0 animate-pulse bg-white/15" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSort}
          disabled={sorting || toSortCount === 0}
          className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-[#3f5fc4] uppercase shadow-soft transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
          style={{ textShadow: "none" }}
        >
          {sorting && <Spinner />}
          {toSortCount > 0 ? t("hero.sortCount", { count: toSortCount }) : t("hero.allSorted")}
        </button>
      )}
    </div>
  );
}
