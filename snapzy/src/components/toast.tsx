"use client";

import { useEffect, useState } from "react";

const EVENT = "snapzy:toast";
const DURATION_MS = 2200;

type ToastDetail = { id: number; message: string };

let nextId = 0;

// Fire-and-forget: any client component can call toast("…") without a
// context provider. <Toaster /> picks it up via a window event.
export function toast(message: string) {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(EVENT, { detail: { id: ++nextId, message } }),
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastDetail[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      setToasts((prev) => [...prev.slice(-2), detail]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, DURATION_MS);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 shadow-xl shadow-black/40"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5 9-10" />
          </svg>
          {t.message}
        </div>
      ))}
    </div>
  );
}
