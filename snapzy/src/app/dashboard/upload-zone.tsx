"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { uploadScreenshot } from "./actions";

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
        className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
          isDragging
            ? "border-violet-400 bg-violet-500/10"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/70"
        } ${uploading ? "cursor-wait" : ""}`}
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-violet-500/20 to-cyan-400/20 text-violet-300 transition group-hover:scale-105">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            />
          </svg>
        </div>

        {uploading && progress ? (
          <div className="mt-4 w-full max-w-xs">
            <p className="text-sm font-medium text-zinc-200">
              Uploading {Math.min(progress.done + 1, progress.total)} of{" "}
              {progress.total}…
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-violet-500 to-cyan-400 transition-[width] duration-300"
                style={{ width: `${Math.max(percent, 8)}%` }}
              />
              <div className="absolute inset-0 animate-pulse bg-white/5" />
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium text-zinc-200">
              Drop screenshots here, or{" "}
              <span className="text-violet-400">browse</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Or paste with{" "}
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                V
              </kbd>{" "}
              · PNG, JPG, WEBP, GIF up to 10 MB
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
          className="mt-3 space-y-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
