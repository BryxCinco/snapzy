"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { uploadScreenshot } from "./actions";
import { NAV_EVENTS } from "./mobile-nav";

type Progress = { done: number; total: number };

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const uploading = isPending || progress !== null;

  function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading) return;

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!isAllowedImageType(file.type)) {
        rejected.push(`${file.name}: only PNG, JPG, WEBP or GIF.`);
      } else if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push(`${file.name}: file is larger than 10 MB.`);
      } else {
        accepted.push(file);
      }
    }
    setErrors(rejected);
    if (accepted.length === 0) return;

    setProgress({ done: 0, total: accepted.length });
    startTransition(async () => {
      // One request per file keeps each body under the Server Action limit
      // and lets one bad file fail without losing the rest.
      for (const [i, file] of accepted.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const result = await uploadScreenshot(formData);
          if (!result.ok) {
            setErrors((prev) => [...prev, result.error]);
          }
        } catch {
          setErrors((prev) => [...prev, `${file.name}: upload failed.`]);
        }
        setProgress({ done: i + 1, total: accepted.length });
      }
      setProgress(null);
    });
  }

  // Ctrl+V / Cmd+V anywhere on the page.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) {
        event.preventDefault();
        uploadFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // The mobile nav's big "+" opens the file picker.
  useEffect(() => {
    const open = () => inputRef.current?.click();
    window.addEventListener(NAV_EVENTS.upload, open);
    return () => window.removeEventListener(NAV_EVENTS.upload, open);
  }, []);

  const percent = progress
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <section aria-label="Upload screenshots">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={uploading}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        // A watercolor spot follows the cursor (CSS vars, no re-render).
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        style={{ ["--c" as string]: "rgb(255 255 255 / 0.75)" }}
        className={`sketch-border group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-8 text-center text-white backdrop-blur-md transition duration-300 outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${
          isDragging ? "scale-[1.02] bg-white/35" : "bg-white/15 hover:bg-white/25"
        } ${uploading ? "cursor-wait" : ""}`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-2xl transition-[opacity,transform] duration-500 ${
            isDragging ? "scale-150 opacity-100" : "scale-100 opacity-0 group-hover:opacity-100"
          }`}
          style={{ left: "var(--x, 50%)", top: "var(--y, 50%)" }}
        />

        <div
          className={`relative grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-deep shadow-soft transition duration-300 ${
            isDragging ? "-translate-y-1 rotate-6" : "group-hover:-rotate-6"
          }`}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>

        {uploading && progress ? (
          <div className="relative mt-4 w-full max-w-xs">
            <p className="text-sm font-semibold">
              Hanging {Math.min(progress.done + 1, progress.total)} of {progress.total}…
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300"
                style={{ width: `${Math.max(percent, 8)}%` }}
              />
              <div className="absolute inset-0 animate-pulse bg-white/20" />
            </div>
          </div>
        ) : (
          <>
            <p className="relative mt-4 text-sm font-semibold">
              {isDragging ? "Let go to add them ✿" : "Drop photos here, or browse"}
            </p>
            <p className="relative mt-1 font-hand text-lg text-white/85">
              or paste with Ctrl + V
            </p>
            <p className="relative mt-1 text-[11px] tracking-wide text-white/70 uppercase">
              PNG · JPG · WEBP · GIF · up to 10 MB
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          className="mt-3 space-y-1 rounded-2xl bg-white/95 px-4 py-3 text-sm text-red-600 shadow-soft"
        >
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
