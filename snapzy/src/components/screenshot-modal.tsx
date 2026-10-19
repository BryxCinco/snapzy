"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { ScreenshotCardData } from "@/components/screenshot-card";
import { SmartCards } from "@/components/smart-cards";
import { toast } from "@/components/toast";
import { colorStyles, type UserCategory } from "@/lib/categories";
import { copyToClipboard, downloadUrl } from "@/lib/clipboard";

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Props = {
  // null = closed. Keeping the component mounted lets AnimatePresence
  // play the exit animation.
  screenshot: ScreenshotCardData | null;
  categories: UserCategory[];
  related: ScreenshotCardData[];
  onClose: () => void;
  onNavigate: (id: string) => void;
  prevId: string | null;
  nextId: string | null;
};

export function ScreenshotModal(props: Props) {
  return (
    <AnimatePresence>
      {props.screenshot && <ModalContent key="modal" {...props} screenshot={props.screenshot} />}
    </AnimatePresence>
  );
}

function ModalContent({
  screenshot,
  categories,
  related,
  onClose,
  onNavigate,
  prevId,
  nextId,
}: Props & { screenshot: ScreenshotCardData }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const category = categories.find((c) => c.id === screenshot.categoryId) ?? null;

  // Lock page scroll, focus the dialog, and restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Esc closes; ←/→ step through the photos in the current view.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prevId) onNavigate(prevId);
      else if (e.key === "ArrowRight" && nextId) onNavigate(nextId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prevId, nextId]);

  async function copyText() {
    if (!screenshot.ocrText) return;
    try {
      await copyToClipboard(screenshot.ocrText);
      toast("Text copied!");
    } catch {
      toast("Couldn't copy. Clipboard access was blocked.");
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={screenshot.filename}
        className="relative flex h-full w-full max-w-6xl flex-col overflow-y-auto bg-zinc-950 shadow-2xl shadow-black/60 sm:h-auto sm:max-h-full sm:rounded-2xl sm:border sm:border-zinc-800 lg:flex-row lg:overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        {/* Image side */}
        <div className="relative flex min-h-[45vh] shrink-0 items-center justify-center bg-black lg:min-h-0 lg:flex-1">
          <motion.img
            key={screenshot.id}
            src={screenshot.url}
            alt={screenshot.summary ?? screenshot.filename}
            className="max-h-[60vh] w-full object-contain lg:max-h-[calc(100vh-3rem)]"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          />

          {prevId && (
            <NavButton side="left" label="Previous photo" onClick={() => onNavigate(prevId)} />
          )}
          {nextId && (
            <NavButton side="right" label="Next photo" onClick={() => onNavigate(nextId)} />
          )}

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-zinc-950/70 text-zinc-200 ring-1 ring-white/15 backdrop-blur transition hover:bg-zinc-800 lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Info side */}
        <aside className="flex w-full flex-col lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-zinc-800">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-5">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-zinc-100" title={screenshot.filename}>
                {screenshot.filename}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {dateFormat.format(new Date(screenshot.createdAt))}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={downloadUrl(screenshot.url, screenshot.filename)}
                download={screenshot.filename}
                aria-label="Download image"
                title="Download image"
                className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
                </svg>
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="hidden h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 lg:grid"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="space-y-6 p-5">
            {category && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${colorStyles[category.color].badge}`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${colorStyles[category.color].dot}`} />
                {category.name}
              </span>
            )}

            {screenshot.metadata && <SmartCards metadata={screenshot.metadata} />}

            <Section title="Summary">
              {screenshot.summary ? (
                <p className="text-sm leading-relaxed text-zinc-300">{screenshot.summary}</p>
              ) : (
                <p className="text-sm text-zinc-500">
                  {screenshot.status === "done" ? "No summary." : "Still analyzing…"}
                </p>
              )}
            </Section>

            <Section
              title="Text in image"
              action={
                screenshot.ocrText && (
                  <button
                    type="button"
                    onClick={copyText}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-violet-300 transition hover:bg-violet-500/10 hover:text-violet-200"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path strokeLinecap="round" d="M5 15V6a2 2 0 0 1 2-2h8" />
                    </svg>
                    Copy text
                  </button>
                )
              }
            >
              {screenshot.ocrText ? (
                <pre className="max-h-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-300">
                  {screenshot.ocrText}
                </pre>
              ) : (
                <p className="text-sm text-zinc-500">No text found.</p>
              )}
            </Section>

            {screenshot.tags.length > 0 && (
              <Section title="Tags">
                <ul className="flex flex-wrap gap-1.5">
                  {screenshot.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-zinc-800"
                    >
                      #{tag}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {related.length > 0 && (
              <Section title="Related photos">
                <ul className="grid grid-cols-4 gap-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(r.id)}
                        title={r.summary ?? r.filename}
                        className="group block aspect-square w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition hover:border-zinc-600"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.url}
                          alt={r.summary ?? r.filename}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </aside>
      </motion.div>
    </motion.div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function NavButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-zinc-950/70 text-zinc-200 ring-1 ring-white/15 backdrop-blur transition hover:bg-zinc-800 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={side === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"}
        />
      </svg>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
