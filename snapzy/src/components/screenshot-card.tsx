"use client";

import { useState, useTransition } from "react";
import { deleteScreenshot, retryProcessing } from "@/app/dashboard/actions";
import { type Category, isCategory, type ProcessingStatus } from "@/lib/categories";

export type ScreenshotCardData = {
  id: string;
  url: string;
  filename: string;
  createdAt: string;
  status: ProcessingStatus;
  // Pending/processing for too long — the background job likely died.
  stuck: boolean;
  summary: string | null;
  // May still hold a value from the old category list until re-analyzed.
  category: string | null;
  tags: string[];
};

type Props = {
  screenshot: ScreenshotCardData;
  selected: boolean;
  // True while anything is selected: checkboxes stay visible and clicking
  // the image toggles selection instead of doing nothing.
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
};

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const categoryStyles: Record<Category, string> = {
  Person: "bg-pink-500/15 text-pink-300 ring-pink-500/30",
  Place: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Food: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  Animal: "bg-lime-500/15 text-lime-300 ring-lime-500/30",
  Product: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
  Logo: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  QR: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Receipt: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  Document: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Chat: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  Code: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  Meme: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
  Other: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
};

export const categoryLabels: Record<Category, string> = {
  Person: "People",
  Place: "Places",
  Food: "Food",
  Animal: "Animals",
  Product: "Products",
  Logo: "Logos",
  QR: "QR codes",
  Receipt: "Receipts",
  Document: "Documents",
  Chat: "Chats & social",
  Code: "Code",
  Meme: "Memes",
  Other: "Other",
};

export function ScreenshotCard({
  screenshot,
  selected,
  selectionMode,
  onToggleSelect,
}: Props) {
  const [isDeleting, startDelete] = useTransition();
  const [isRetrying, startRetry] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const processing =
    !screenshot.stuck &&
    (screenshot.status === "pending" || screenshot.status === "processing");
  const isLegacyCategory =
    screenshot.category !== null && !isCategory(screenshot.category);
  const canRetry =
    screenshot.status === "failed" ||
    (screenshot.stuck && screenshot.status !== "done");

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this screenshot?")) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteScreenshot(screenshot.id);
      if (!result.ok) setError(result.error);
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
    <figure
      className={`group mb-4 break-inside-avoid overflow-hidden rounded-xl border bg-zinc-900 transition ${
        selected
          ? "border-violet-500 ring-2 ring-violet-500/40"
          : "border-zinc-800"
      } ${isDeleting ? "pointer-events-none scale-95 opacity-40" : ""}`}
    >
      <div
        className={`relative overflow-hidden ${selectionMode ? "cursor-pointer" : ""}`}
        onClick={selectionMode ? () => onToggleSelect(screenshot.id) : undefined}
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
            processing ? "opacity-50" : ""
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
          } ${selected || selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5 9-10" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={isDeleting}
          aria-label={`Delete ${screenshot.filename}`}
          title="Delete"
          className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-lg bg-zinc-950/70 text-zinc-300 opacity-0 ring-1 ring-white/10 backdrop-blur transition group-hover:opacity-100 hover:bg-red-500/90 hover:text-white focus-visible:opacity-100"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
            />
          </svg>
        </button>
      </div>

      {(screenshot.category || screenshot.summary || canRetry || error) && (
        <figcaption className="space-y-2 p-3">
          {screenshot.category &&
            (isCategory(screenshot.category) ? (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${categoryStyles[screenshot.category]}`}
              >
                {categoryLabels[screenshot.category]}
              </span>
            ) : (
              <span
                title="From the old category list. Re-analyze to update it."
                className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium border border-dashed border-zinc-700 text-zinc-500"
              >
                {screenshot.category} · old
              </span>
            ))}
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
          {(canRetry || isLegacyCategory) && !processing && (
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs ${canRetry ? "text-red-300" : "text-zinc-500"}`}>
                {canRetry
                  ? screenshot.stuck
                    ? "Analysis timed out."
                    : "AI analysis failed."
                  : "Old category."}
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
