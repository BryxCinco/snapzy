"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteScreenshot, retryProcessing } from "@/app/dashboard/actions";
import { updateScreenshotCategory } from "@/app/dashboard/category-actions";
import { useT } from "@/components/preferences";
import { toast } from "@/components/toast";
import { copyToClipboard, downloadUrl } from "@/lib/clipboard";
import {
  colorStyles,
  type ProcessingStatus,
  type UserCategory,
} from "@/lib/categories";
import {
  maskSecrets,
  metadataLabels,
  type ScreenshotMetadata,
  secretsOf,
} from "@/lib/metadata";

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
  // Position in the grid, used to stagger the entrance animation.
  index?: number;
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
  "grid h-8 w-8 place-items-center rounded-full bg-card/90 text-ink/70 shadow-soft backdrop-blur transition hover:scale-110 hover:text-white";

// Each print hangs a little crooked, like it was pinned up by hand. Derived
// from the id so it stays the same across renders.
function crookedness(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 13) - 6) / 10; // -0.6deg … +0.6deg
}

// Shared with the detail modal so the photo grows out of its card.
export const photoLayoutId = (id: string) => `photo-${id}`;

export function ScreenshotCard({
  screenshot,
  categories,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
  index = 0,
}: Props) {
  const t = useT();
  const [isDeleting, startDelete] = useTransition();
  const [isRetrying, startRetry] = useTransition();
  const [isMoving, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const category = categories.find((c) => c.id === screenshot.categoryId) ?? null;
  const smartLabels = metadataLabels(screenshot.metadata);
  // Never show a scanned password in the grid; the modal has a reveal toggle.
  const summary = screenshot.summary
    ? maskSecrets(screenshot.summary, secretsOf(screenshot.metadata))
    : null;
  const processing =
    !screenshot.stuck &&
    (screenshot.status === "pending" || screenshot.status === "processing");
  // Uploaded but not analyzed yet: waits for "Sort photos" (or the button below).
  const isNew = screenshot.status === "new";
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
    if (!window.confirm(t("card.confirmDelete"))) return;
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
      toast(t("card.copied"));
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
      if (result.ok) toast(t("card.moved", { name: target.name }));
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

  const title = summary ?? screenshot.filename;

  return (
    // No overflow-hidden here: the "Move to" menu has to escape the card.
    <figure
      style={{
        ["--tilt" as string]: `${crookedness(screenshot.id)}deg`,
        animationDelay: `${Math.min(index, 12) * 45}ms`,
      }}
      className={`group animate-rise relative mb-4 break-inside-avoid rounded-3xl bg-card p-2.5 shadow-soft transition-[box-shadow,opacity] duration-300 hover:z-10 hover:shadow-lift ${
        selected ? "ring-[3px] ring-brand" : "ring-1 ring-line/70"
      } ${isDeleting ? "pointer-events-none opacity-40" : ""} ${menuOpen ? "z-30" : ""}`}
    >
      <div
        className="relative cursor-pointer overflow-hidden rounded-2xl bg-brand-soft transition-transform duration-200 ease-out [transform:perspective(900px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
        onClick={() =>
          selectionMode ? onToggleSelect(screenshot.id) : onOpen(screenshot.id)
        }
        // 3D tilt + glare that follow the pointer (CSS vars, no re-render).
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          const el = e.currentTarget.style;
          el.setProperty("--ry", `${(px - 0.5) * 9}deg`);
          el.setProperty("--rx", `${(0.5 - py) * 9}deg`);
          el.setProperty("--gx", `${px * 100}%`);
          el.setProperty("--gy", `${py * 100}%`);
        }}
        onPointerLeave={(e) => {
          const el = e.currentTarget.style;
          el.setProperty("--rx", "0deg");
          el.setProperty("--ry", "0deg");
        }}
      >
        {/* Plain <img> (via motion): signed URLs change on every render, so
            next/image's optimizer cache would never hit. */}
        <motion.img
          layoutId={photoLayoutId(screenshot.id)}
          src={screenshot.url}
          alt={summary ?? screenshot.filename}
          loading="lazy"
          decoding="async"
          className={`block h-auto w-full transition-[scale,opacity] duration-500 ease-out group-hover:scale-[1.04] ${
            processing || isMoving ? "opacity-60" : ""
          }`}
        />

        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.45), transparent 55%)",
          }}
        />

        {processing && (
          <div className="absolute inset-0 grid place-items-center bg-card/45 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-brand-deep shadow-soft">
              <Spinner />
              <span className="font-hand text-lg leading-none">{t("card.reading")}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${screenshot.filename}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(screenshot.id);
          }}
          className={`absolute top-2.5 left-2.5 grid h-7 w-7 place-items-center rounded-full shadow-soft transition focus-visible:opacity-100 ${
            selected
              ? "scale-110 bg-brand text-white"
              : "bg-card/90 text-transparent ring-1 ring-line hover:text-brand"
          } ${selected || selectionMode ? "opacity-100" : HOVER_REVEAL}`}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5 9-10" />
          </svg>
        </button>

        <div
          className={`absolute top-2.5 right-2.5 flex gap-1.5 transition ${
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
              className={`${ICON_BUTTON} hover:bg-brand`}
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
            className={`${ICON_BUTTON} hover:bg-sky-500`}
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
            className={`${ICON_BUTTON} hover:bg-emerald-500 ${menuOpen ? "bg-emerald-500 text-white" : ""}`}
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
            className={`${ICON_BUTTON} hover:bg-red-500`}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Move to album"
          className="absolute top-13 right-3 z-30 max-h-72 w-56 overflow-y-auto rounded-2xl bg-card p-1.5 shadow-lift ring-1 ring-line"
        >
          <p className="px-3 pt-1.5 pb-1 font-hand text-lg text-mute">{t("card.moveTo")}</p>
          {categories.map((c) => {
            const current = c.id === screenshot.categoryId;
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => handleMove(c)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                  current ? "bg-brand-soft font-medium text-brand-deep" : "text-ink/80 hover:bg-paper"
                }`}
              >
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorStyles[c.color].dot}`} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {current && (
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      <figcaption className="px-1.5 pt-3 pb-1">
        <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink" title={title}>
          {title}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-mute">
            {category ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${colorStyles[category.color].dot}`} />
                {category.name}
              </span>
            ) : processing ? (
              t("card.sorting")
            ) : (
              t("albums.unsorted")
            )}
            <span className="text-mute/60"> · {dateFormat.format(new Date(screenshot.createdAt))}</span>
          </p>
          {!selectionMode && (
            <button
              type="button"
              onClick={() => onOpen(screenshot.id)}
              className="shrink-0 rounded-full bg-brand px-3 py-1 text-[10px] font-semibold tracking-wider text-white uppercase shadow-soft transition hover:bg-brand-deep [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            >
              {t("action.view")}
            </button>
          )}
        </div>

        {smartLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {smartLabels.map((label) => (
              <span
                key={label}
                title="Smart details found. Open the photo to see them."
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-deep"
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
                  <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        )}
        {screenshot.tags.length > 0 && (
          <p className="mt-1.5 truncate font-hand text-base text-mute">
            {screenshot.tags.map((t) => `#${t}`).join("  ")}
          </p>
        )}

        {(canRetry || isNew) && !processing && (
          <div
            className={`mt-2 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 ${
              isNew ? "bg-brand-soft" : "bg-red-50 dark:bg-red-500/10"
            }`}
          >
            <p className={`text-xs ${isNew ? "text-brand-deep" : "text-red-600"}`}>
              {isNew ? t("card.notSorted") : screenshot.stuck ? t("card.tooLong") : t("card.failed")}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className={`flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold shadow-soft transition disabled:opacity-60 ${
                isNew ? "text-brand-deep hover:bg-brand/10" : "text-red-600 hover:bg-red-100"
              }`}
            >
              {isRetrying && <Spinner />}
              {isNew ? t("action.sort") : screenshot.summary ? t("action.retry") : t("action.runAi")}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </figcaption>
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
