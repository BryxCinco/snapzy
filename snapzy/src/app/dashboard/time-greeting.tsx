"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/preferences";
import type { MessageKey } from "@/lib/i18n";

function partOfDay(): MessageKey {
  const h = new Date().getHours();
  if (h < 5) return "greet.late";
  if (h < 12) return "greet.morning";
  if (h < 18) return "greet.afternoon";
  return "greet.evening";
}

// The server can't know the viewer's local time, so it renders a neutral
// "hello" and the browser swaps in the time of day after hydration.
const subscribe = () => () => {};

export function TimeGreeting({ name }: { name: string }) {
  const t = useT();
  const key = useSyncExternalStore<MessageKey>(subscribe, partOfDay, () => "greet.hello");
  const greeting = t(key);
  return (
    <p className="font-hand text-2xl leading-tight text-white/95 sm:text-3xl">
      {greeting}, {name} ✿
    </p>
  );
}
