"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteScreenshot, retryProcessing } from "@/app/dashboard/actions";
import { updateScreenshotCategory } from "@/app/dashboard/category-actions";
import { toast } from "@/components/toast";
import { copyToClipboard, downloadUrl } from "@/lib/clipboard";
import {
  colorStyles,
  type ProcessingStatus,
  type UserCategory,
} from "@/lib/categories";
import type { ScreenshotMetadata } from "@/lib/metadata";

export type ScreenshotCardData = {
  id: string;
  url: string;
  filename: string;
  createdAt: string;
  status: ProcessingStatus;
  // Pending/processing for too long — the background job likely died.
  stuck: boolean;
  summary: string | null;
  ocrText: string | null;
  // null = not categorized yet (still analyzing, or analysis failed).
  categoryId: string | null;
  // Structured data the AI found (WiFi, flight, payment), if any.
  metadata: ScreenshotMetadata | null;
  tags: string[];
};

type Props = {
  screenshot: ScreenshotCardData;
  categories: UserCategory[];
  selected: boolean;
  // True while anything is selected: checkboxes stay visible and clicking
  // the image toggles selection instead of doing nothing.
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
  // Opens the detail modal (ignored while selecting).
  onOpen: (id: string) => void;
};

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Hover-only controls stay visible on touch screens, which have no hover.
const HOVER_REVEAL =
  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

const ICON_BUTTON =
  "grid h-8 w-8 place-items-center rounded-lg bg-zinc-950/70 text-zinc-300 ring-1 ring-white/10 backdrop-blur transition hover:text-white";

export function ScreenshotCard({
  screenshot,
  categories,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
}: Props) {
  const [isDeleting, startDelete] = useTransition();
  const [isRetrying, startRetry] = useTransition();
  const [isMoving, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const category = categories.find((c) => c.id === screenshot.categoryId) ?? null;
  const smartLabels = [
    screenshot.metadata?.wifi && "WiFi",
    screenshot.metadata?.flight && "Flight",
    screenshot.metadata?.payment && "Payment",
  ].filter((label): label is string => Boolean(label));
  const processing =
    !screenshot.stuck &&
    (screenshot.status === "pending" || screenshot.status === "processing");
  const canRetry =
    screenshot.status === "failed" ||
    (screenshot.stuck && screenshot.status !== "done");

  // Close the "Move to" menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      // The toggle button handles its own clicks.
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this screenshot?")) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteScreenshot(screenshot.id);
      if (!result.ok) setError(result.error);
    });
  }

  async function handleCopy() {
    if (!screenshot.ocrText) return;
    try {
      await copyToClipboard(screenshot.ocrText);
      toast("Text copied!");
    } catch {
      setError("Couldn't copy. Your browser blocked clipboard access.");
    }
  }

  function handleMove(target: UserCategory) {
    setMenuOpen(false);
    if (target.id === screenshot.categoryId) return;
    setError(null);
    startMove(async () => {
      const result = await updateScreenshotCategory(screenshot.id, target.id);
      if (result.ok) toast(`Moved to ${target.name}`);
      else setError(result.error);
    });
  }

  function handleRetry() {
    setError(null);
    startRetry(async () => {
      const result = await retryProcessing(screenshot.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    // No overflow-hidden here: the "Move to" menu has to escape the card.
    <figure
      className={`group relative mb-4 break-inside-avoid rounded-xl border bg-zinc-900 transition ${
        selected
          ? "border-violet-500 ring-2 ring-violet-500/40"
          : "border-zinc-800"
      } ${isDeleting ? "pointer-events-none scale-95 opacity-40" : ""} ${
        menuOpen ? "z-30" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-t-xl ${
          category || screenshot.summary || canRetry || error ? "" : "rounded-b-xl"
        } cursor-pointer`}
        onClick={() =>
          selectionMode ? onToggleSelect(screenshot.id) : onOpen(screenshot.id)
        }
      >
        {/* Plain <img>: signed URLs change on every render, so next/image's
            optimizer cache would never hit. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshot.url}
          alt={screenshot.summary ?? screenshot.filename}
          loading="lazy"
          decoding="async"
          className={`block h-auto w-full transition duration-300 ease-out group-hover:scale-[1.03] ${
            processing || isMoving ? "opacity-50" : ""
          }`}
        />

        {processing && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-950/40">
            <div className="flex items-center gap-2 rounded-full bg-zinc-950/80 px-3 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-zinc-700">
              <Spinner />
              Analyzing…
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/80 via-black/10 to-transparent p-3 opacity-0 transition duration-300 group-hover:opacity-100">
          <p className="truncate text-sm font-medium text-white">
            {screenshot.filename}
          </p>
          <p className="text-xs text-zinc-300">
            {dateFormat.format(new Date(screenshot.createdAt))}
          </p>
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${screenshot.filename}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(screenshot.id);
          }}
          className={`absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-md ring-1 backdrop-blur transition focus-visible:opacity-100 ${
            selected
              ? "bg-violet-600 text-white ring-violet-400"
              : "bg-zinc-950/70 text-transparent ring-white/20 hover:ring-white/50"
          } ${selected || selectionMode ? "opacity-100" : HOVER_REVEAL}`}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5 9-10" />
          </svg>
        </button>

        <div
          className={`absolute top-2 right-2 flex gap-1 transition ${
            menuOpen ? "opacity-100" : HOVER_REVEAL
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {screenshot.ocrText && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy text from ${screenshot.filename}`}
              title="Copy text"
              className={`${ICON_BUTTON} hover:bg-violet-600`}
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path strokeLinecap="round" d="M5 15V6a2 2 0 0 1 2-2h8" />
              </svg>
            </button>
          )}
          <a
            href={downloadUrl(screenshot.url, screenshot.filename)}
            download={screenshot.filename}
            aria-label={`Download ${screenshot.filename}`}
            title="Download image"
            className={`${ICON_BUTTON} hover:bg-sky-600`}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
            </svg>
          </a>
          <button
            type="button"
            ref={menuButtonRef}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Move ${screenshot.filename} to another album`}
            title="Move to…"
            className={`${ICON_BUTTON} hover:bg-emerald-600 ${menuOpen ? "bg-emerald-600 text-white" : ""}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm9 3v6m0 0-2.5-2.5M12 16l2.5-2.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Delete ${screenshot.filename}`}
            title="Delete"
            className={`${ICON_BUTTON} hover:bg-red-500/90`}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
              />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Move to album"
          className="absolute top-12 right-2 z-30 max-h-72 w-52 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl shadow-black/60"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Move to
          </p>
          {categories.map((c) => {
            const current = c.id === screenshot.categoryId;
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => handleMove(c)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                  current ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${colorStyles[c.color].dot}`} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {current && (
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5 text-violet-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {(category || screenshot.summary || canRetry || error) && (
        <figcaption className="space-y-2 p-3">
          {(category || smartLabels.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {category && (
                <span
                  className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${colorStyles[category.color].badge}`}
                >
                  {category.name}
                </span>
              )}
              {smartLabels.map((label) => (
                <span
                  key={label}
                  title="Smart details found. Open the photo to see them."
                  className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-violet-500/20 to-cyan-400/20 px-2 py-0.5 text-[11px] font-medium text-violet-200 ring-1 ring-violet-400/30"
                >
                  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
                    <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
                  </svg>
                  {label}
                </span>
              ))}
            </div>
          )}
          {screenshot.summary && (
            <p className="line-clamp-3 text-sm text-zinc-300">
              {screenshot.summary}
            </p>
          )}
          {screenshot.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {screenshot.tags.map((tag) => (
                <li key={tag} className="text-xs text-zinc-500">
                  #{tag}
                </li>
              ))}
            </ul>
          )}
          {canRetry && !processing && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-red-300">
                {screenshot.stuck ? "Analysis timed out." : "AI analysis failed."}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-60"
              >
                {isRetrying && <Spinner />}
                {screenshot.summary ? "Re-analyze" : "Run AI"}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </figcaption>
      )}
    </figure>
  );
}

export function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={3}
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
