"use client";

import { useState, useTransition } from "react";
import { deleteScreenshot, retryProcessing } from "@/app/dashboard/actions";
import type { Category, ProcessingStatus } from "@/lib/categories";

export type ScreenshotCardData = {
  id: string;
  url: string;
  filename: string;
  createdAt: string;
  status: ProcessingStatus;
  // Pending/processing for too long — the background job likely died.
  stuck: boolean;
  summary: string | null;
  category: Category | null;
  tags: string[];
};

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const categoryStyles: Record<Category, string> = {
  Code: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Receipt: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Schedule: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  SocialMedia: "bg-pink-500/15 text-pink-300 ring-pink-500/30",
  Meme: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  Document: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Other: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
};

const categoryLabels: Record<Category, string> = {
  Code: "Code",
  Receipt: "Receipt",
  Schedule: "Schedule",
  SocialMedia: "Social media",
  Meme: "Meme",
  Document: "Document",
  Other: "Other",
};

export function ScreenshotCard({ screenshot }: { screenshot: ScreenshotCardData }) {
  const [isDeleting, startDelete] = useTransition();
  const [isRetrying, startRetry] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const processing =
    !screenshot.stuck &&
    (screenshot.status === "pending" || screenshot.status === "processing");
  const canRetry =
    screenshot.status === "failed" || (screenshot.stuck && screenshot.status !== "done");

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
      className={`group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition ${
        isDeleting ? "pointer-events-none scale-95 opacity-40" : ""
      }`}
    >
      <div className="relative overflow-hidden">
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
          onClick={handleDelete}
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
          {screenshot.category && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${categoryStyles[screenshot.category]}`}
            >
              {categoryLabels[screenshot.category]}
            </span>
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
          {canRetry && (
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
                {screenshot.summary ? "Retry" : "Run AI"}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </figcaption>
      )}
    </figure>
  );
}

function Spinner() {
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
