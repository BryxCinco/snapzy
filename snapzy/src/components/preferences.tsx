"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isLang, type Lang, type MessageKey, translate } from "@/lib/i18n";
import { LANG_KEY, THEME_KEY } from "@/lib/theme-boot";

// Per-device preferences, kept in localStorage. Same-tab updates go through a
// custom event because the `storage` event only fires in *other* tabs.

export type ThemeChoice = "light" | "dark" | "system";

const CHANGE_EVENT = "snapzy:prefs";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode / blocked storage
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not persisted, but the event below still updates this tab.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// --- Theme ------------------------------------------------------------------

function readTheme(): ThemeChoice {
  const v = readStorage(THEME_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as ThemeChoice);
  const setTheme = useCallback((next: ThemeChoice) => {
    writeStorage(THEME_KEY, next);
    applyTheme(next);
  }, []);
  return { theme, setTheme };
}

/** Keeps <html data-theme> in sync, including OS changes in "system" mode. */
export function ThemeSync() {
  const { theme } = useTheme();
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}

// --- Language ---------------------------------------------------------------

function readLang(): Lang {
  const v = readStorage(LANG_KEY);
  return isLang(v) ? v : "en";
}

export function useLang() {
  // The server always renders English; the saved language applies right
  // after hydration.
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);
  const setLang = useCallback((next: Lang) => {
    writeStorage(LANG_KEY, next);
    document.documentElement.lang = next;
  }, []);
  return { lang, setLang };
}

export function useT() {
  const { lang } = useLang();
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
}

/** Translated text for use inside Server Components. */
export function T({ k, vars }: { k: MessageKey; vars?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, vars)}</>;
}
