"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/preferences";
import { NAV_EVENTS } from "./mobile-nav";

const DEBOUNCE_MS = 300;

// Lives in the sticky header and writes the query to `?q=`. GalleryView
// reads the same param, so the two stay in sync without shared state, and
// a search keeps its own URL (shareable, survives refresh).
export function SearchBar() {
  const t = useT();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce: only push to the URL once typing pauses.
  useEffect(() => {
    if (value.trim() === urlQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, urlQuery]);

  // "/" focuses search, like most web apps.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    const focus = () => inputRef.current?.focus();
    window.addEventListener("keydown", onKey);
    window.addEventListener(NAV_EVENTS.search, focus);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(NAV_EVENTS.search, focus);
    };
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="relative w-full max-w-md"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-brand"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            inputRef.current?.blur();
          }
        }}
        placeholder={t("nav.search")}
        aria-label="Search screenshots"
        enterKeyHint="search"
        className="h-11 w-full rounded-full bg-paper pr-11 pl-11 text-sm text-ink ring-1 ring-line placeholder:text-mute/80 outline-none transition focus:bg-card focus:shadow-soft focus:ring-2 focus:ring-brand [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-3 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-mute transition hover:bg-brand-soft hover:text-brand-deep"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-3.5 hidden -translate-y-1/2 rounded-md bg-card px-1.5 font-mono text-[10px] text-mute ring-1 ring-line sm:block">
          /
        </kbd>
      )}
    </form>
  );
}

export function SearchBarFallback() {
  return <div className="h-11 w-full max-w-md rounded-full bg-paper ring-1 ring-line" />;
}
