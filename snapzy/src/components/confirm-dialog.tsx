"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/preferences";

const EVENT = "snapzy:confirm";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button for things that can't be undone.
  danger?: boolean;
  // The user must type this exact text before the confirm button unlocks.
  requireText?: string;
  requireTextLabel?: string;
};

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

// Replacement for window.confirm: `if (!(await confirmDialog({...}))) return;`
// Any client component can call it; <ConfirmHost /> (mounted once in the root
// layout) shows the dialog and answers the promise.
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { ...options, resolve } }));
  });
}

export function ConfirmHost() {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The latest open request, read by the dialog's close handlers so a
  // dismissal (Esc, backdrop) can't answer the same request twice.
  const requestRef = useRef<Request | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    function onRequest(e: Event) {
      // A new request while one is open cancels the old one.
      requestRef.current?.resolve(false);
      const next = (e as CustomEvent<Request>).detail;
      requestRef.current = next;
      setTyped("");
      setRequest(next);
    }
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (request && dialog && !dialog.open) dialog.showModal();
  }, [request]);

  function settle(ok: boolean) {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    dialogRef.current?.close();
    current?.resolve(ok);
  }

  const locked = Boolean(request?.requireText) && typed !== request?.requireText;

  return (
    // Native <dialog>: focus trap and Esc come for free.
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      onClose={() => requestRef.current && settle(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) settle(false);
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-4xl border-0 bg-card p-0 text-ink shadow-lift backdrop:bg-ink/30 backdrop:backdrop-blur-sm"
    >
      {request && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked) settle(true);
          }}
          className="p-7"
        >
          <h2 id="confirm-title" className="text-lg font-semibold tracking-tight">
            {request.title}
          </h2>
          {request.message && <p className="mt-2 text-sm leading-relaxed text-mute">{request.message}</p>}

          {request.requireText && (
            <label className="mt-4 block">
              <span className="text-xs font-medium text-mute">
                {request.requireTextLabel ?? `Type ${request.requireText} to confirm`}
              </span>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="mt-1.5 h-10 w-full rounded-full bg-paper px-4 font-mono text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-red-400"
              />
            </label>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              autoFocus={!request.requireText}
              onClick={() => settle(false)}
              className="h-10 rounded-full px-4 text-sm font-medium text-mute transition hover:text-ink"
            >
              {request.cancelLabel ?? t("confirm.cancel")}
            </button>
            <button
              type="submit"
              disabled={locked}
              className={`h-10 rounded-full px-5 text-sm font-semibold text-white transition disabled:opacity-40 ${
                request.danger ? "bg-red-500 hover:bg-red-600" : "bg-brand hover:bg-brand-deep"
              }`}
            >
              {request.confirmLabel ?? t("confirm.ok")}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
