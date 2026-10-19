"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 3000;

// While any card is still being analyzed, re-fetch the server components
// every few seconds so finished results replace the spinners.
export function ProcessingPoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
