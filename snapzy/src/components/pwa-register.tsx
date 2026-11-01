"use client";

import { useEffect } from "react";

// Registers /sw.js (static-asset caching + offline page). Production only:
// a caching service worker in `next dev` just gets in the way.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the app works the same without it.
    });
  }, []);

  return null;
}
