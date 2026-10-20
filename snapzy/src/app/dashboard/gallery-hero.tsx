"use client";

import { useEffect, useState } from "react";
import { type SortSpeed, useSortSpeed, useT } from "@/components/preferences";
import { type ScreenshotCardData, Spinner } from "@/components/screenshot-card";
import { BULK_CONCURRENCY, SECONDS_PER_PHOTO, SORT_BATCH } from "@/lib/categories";
import type { MessageKey } from "@/lib/i18n";
import { TimeGreeting } from "./time-greeting";
import { UploadZone } from "./upload-zone";

export type SortRun = { total: number; startedAt: number };

/** "20 sec" / "2 min" (exact seconds under a minute, for the live countdown). */
function useFormatTime() {
  const t = useT();
  return (seconds: number, round = false) =>
    seconds < 60
      ? t("time.sec", { n: round ? Math.max(5, Math.round(seconds / 5) * 5) : Math.max(1, Math.round(seconds)) })
      : t("time.min", { n: Math.round(seconds / 60) });
}

/** Seconds per photo before any are measured: the learned speed or a guess. */
function basePerPhoto(speed: SortSpeed | null) {
  return speed?.secondsPerPhoto ?? SECONDS_PER_PHOTO / BULK_CONCURRENCY;
}

/**
 * Time left in a run. Once a photo has finished, the run's own pace
 * (elapsed / finished) replaces the guess, so the number tracks reality.
 */
function secondsLeft(run: SortRun, remaining: number, now: number, speed: SortSpeed | null) {
  const elapsed = Math.max(0, (now - run.startedAt) / 1000);
  const done = run.total - remaining;
  const projected = done > 0 ? (elapsed / done) * run.total : run.total * basePerPhoto(speed);
  return Math.max(0, projected - elapsed);
}

// Re-renders every second while `active`, for the live countdown.
function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : null;
}

// Three slots of a fanned pile of prints; they spread out on hover.
const PRINT_SLOTS = [
  "left-[4%] top-4 -rotate-9 group-hover:-translate-x-3 group-hover:-rotate-14",
  "right-[4%] top-5 rotate-8 group-hover:translate-x-3 group-hover:rotate-13",
  "left-1/2 top-0 -translate-x-1/2 rotate-1 group-hover:-translate-y-1.5 group-hover:rotate-0",
];

export function GalleryHero({
  cards,
  albumCount,
  firstName,
  toSort,
  processing,
  run,
  sorting,
  cancelling,
  onSort,
  onCancel,
  onOpenPhoto,
}: {
  cards: ScreenshotCardData[];
  albumCount: number;
  firstName: string;
  // Photos waiting for analysis (new, failed, stuck, uncategorized).
  toSort: ScreenshotCardData[];
  // Photos the AI is working on right now.
  processing: ScreenshotCardData[];
  // The current "Sort" run (size + start time), for the bar and the ETA.
  run: SortRun | null;
  sorting: boolean;
  cancelling: boolean;
  onSort: () => void;
  onCancel: () => void;
  onOpenPhoto: (id: string) => void;
}) {
  const t = useT();

  return (
    <section className="hero-wash text-shadow-soft relative mb-6 overflow-hidden rounded-4xl px-5 py-5 text-white shadow-lift sm:px-7 sm:py-6">
      <div aria-hidden className="wash animate-drift -top-20 -right-16 h-72 w-72 bg-white opacity-15" />
      <div
        aria-hidden
        className="wash animate-drift -bottom-24 left-1/4 h-64 w-96 bg-[#c47596] opacity-35"
        style={{ animationDelay: "-8s" }}
      />

      <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
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

        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* Phones upload with the big + in the bottom bar instead. */}
          <div className="hidden sm:block">
            <UploadZone />
          </div>

          <SortTile
            toSort={toSort}
            processing={processing}
            run={run}
            sorting={sorting}
            cancelling={cancelling}
            onSort={onSort}
            onCancel={onCancel}
            onOpenPhoto={onOpenPhoto}
          />
        </div>
      </div>
    </section>
  );
}

function SortTile({
  toSort,
  processing,
  run,
  sorting,
  cancelling,
  onSort,
  onCancel,
  onOpenPhoto,
}: {
  toSort: ScreenshotCardData[];
  processing: ScreenshotCardData[];
  run: SortRun | null;
  sorting: boolean;
  cancelling: boolean;
  onSort: () => void;
  onCancel: () => void;
  onOpenPhoto: (id: string) => void;
}) {
  const t = useT();
  const formatTime = useFormatTime();
  const speed = useSortSpeed();

  const busy = processing.length > 0;
  const now = useNow(busy);
  const total = Math.max(run?.total ?? processing.length, processing.length);
  const progress = busy && total > 0 ? (total - processing.length) / total : 0;
  const nextBatch = Math.min(toSort.length, SORT_BATCH);

  // Live countdown while a run we started is going; otherwise a forecast.
  const left =
    busy && run && now !== null
      ? secondsLeft({ ...run, total }, processing.length, now, speed)
      : processing.length * basePerPhoto(speed);
  const forecast = nextBatch * basePerPhoto(speed);

  // The photos that just landed (or are being read) sit on the tile as a
  // little pile, newest on top.
  const pile = (busy ? processing : toSort).slice(0, 3);
  const extra = (busy ? processing : toSort).length - pile.length;

  return (
    <div className="flex h-full flex-col gap-3 rounded-3xl bg-white/15 p-4 ring-1 ring-white/35 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <Pile photos={pile} extra={extra} busy={busy} onOpenPhoto={onOpenPhoto} t={t} />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {busy ? <Spinner /> : <SparkleIcon />}
            {busy ? t("hero.sorting", { count: processing.length }) : t("hero.sort")}
          </p>
          <p className="mt-1 font-hand text-lg leading-tight text-white/90" aria-live="polite">
            {busy
              ? left < 3
                ? t("hero.almost")
                : t("hero.left", { time: formatTime(left) })
              : toSort.length > 0
                ? `${t("hero.waiting", { count: toSort.length })} · ${t("hero.about", { time: formatTime(forecast, true) })}`
                : t("hero.allSorted")}
          </p>
          {(busy || toSort.length > 0) && (
            <p className="mt-0.5 text-[11px] leading-snug text-white/70">
              {[
                busy && run ? t("hero.done", { done: total - processing.length, total }) : null,
                !busy && toSort.length > SORT_BATCH ? t("hero.batchNote", { count: SORT_BATCH }) : null,
                speed ? t("hero.learned", { count: speed.runs }) : t("hero.guess"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      {busy ? (
        <div className="mt-auto flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-700"
              style={{ width: `${Math.max(progress * 100, 6)}%` }}
            />
            <div className="absolute inset-0 animate-pulse bg-white/15" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-white/45 transition hover:bg-white hover:text-[#b4446c] disabled:opacity-60"
          >
            {cancelling ? <Spinner /> : <StopIcon />}
            {t("hero.cancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSort}
          disabled={sorting || toSort.length === 0}
          className="mt-auto flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-[#3f5fc4] uppercase shadow-soft transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
          style={{ textShadow: "none" }}
        >
          {sorting && <Spinner />}
          {toSort.length === 0
            ? t("hero.allSorted")
            : toSort.length > SORT_BATCH
              ? t("hero.sortBatch", { count: nextBatch })
              : t("hero.sortCount", { count: nextBatch })}
        </button>
      )}
    </div>
  );
}

function Pile({
  photos,
  extra,
  busy,
  onOpenPhoto,
  t,
}: {
  photos: ScreenshotCardData[];
  extra: number;
  busy: boolean;
  onOpenPhoto: (id: string) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  if (photos.length === 0) {
    // Nothing waiting: an empty frame, ready for the next drop.
    return (
      <div
        className="sketch-border grid h-28 w-28 shrink-0 place-items-center rounded-2xl sm:h-32 sm:w-32"
        style={{ ["--c" as string]: "rgb(255 255 255 / 0.6)" }}
      >
        <span className="font-hand text-xl text-white/85">✿</span>
      </div>
    );
  }

  // Draw back-to-front so the newest photo ends up on top.
  const slots = PRINT_SLOTS.slice(3 - photos.length);
  return (
    <div className="group relative h-28 w-28 shrink-0 sm:h-32 sm:w-36">
      {[...photos].reverse().map((p, i) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpenPhoto(p.id)}
          title={p.filename}
          className={`absolute h-24 w-[4.6rem] rounded-md bg-white p-1 pb-4 shadow-lift transition duration-500 ease-out hover:z-20 hover:scale-110 sm:h-28 sm:w-22 sm:pb-5 ${
            slots[i]
          } ${busy ? "animate-pulse" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="" className="h-full w-full rounded-sm object-cover" />
        </button>
      ))}
      {extra > 0 && (
        <span
          className="absolute -right-1 -bottom-1 z-30 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#3f5fc4] shadow-lift"
          style={{ textShadow: "none" }}
          title={t("hero.waiting", { count: photos.length + extra })}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2l2.2 6.1L20 10l-5.8 1.9L12 18l-2.2-6.1L4 10l5.8-1.9L12 2zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  );
}
