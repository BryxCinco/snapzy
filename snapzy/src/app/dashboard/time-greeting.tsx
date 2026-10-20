"use client";

import { useSyncExternalStore } from "react";

function partOfDay() {
  const h = new Date().getHours();
  if (h < 5) return "up late";
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

// The server can't know the viewer's local time, so it renders a neutral
// "hello" and the browser swaps in the time of day after hydration.
const subscribe = () => () => {};

export function TimeGreeting({ name }: { name: string }) {
  const greeting = useSyncExternalStore(subscribe, partOfDay, () => "hello");
  return (
    <p className="font-hand text-3xl text-white/95">
      {greeting}, {name} ✿
    </p>
  );
}
