"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/screenshot-card";
import { toast } from "@/components/toast";
import {
  CATEGORY_COLORS,
  type CategoryColor,
  colorStyles,
  MAX_CATEGORY_DESCRIPTION,
  MAX_CATEGORY_NAME,
  type UserCategory,
} from "@/lib/categories";
import { createCategory, deleteCategory, updateCategory } from "./category-actions";
import { NAV_EVENTS } from "./mobile-nav";

type Draft = { name: string; color: CategoryColor; description: string };

const EMPTY_DRAFT: Draft = { name: "", color: "violet", description: "" };

export function ManageCategoriesButton({
  categories,
  counts,
}: {
  categories: UserCategory[];
  counts: Map<string, number>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The mobile nav's "Albums" tab opens this dialog too.
  useEffect(() => {
    const open = () => dialogRef.current?.showModal();
    window.addEventListener(NAV_EVENTS.manage, open);
    return () => window.removeEventListener(NAV_EVENTS.manage, open);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink/70 shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:text-brand-deep"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h10M4 17h6m4 0h6M18 7h2M14 4v6m-4 4v6" />
        </svg>
        <span className="hidden sm:inline">Manage</span>
      </button>

      {/* Native <dialog>: focus trap, Esc to close and backdrop for free. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="manage-categories-title"
        onClick={(e) => {
          // Clicking the backdrop (the dialog element itself) closes it.
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-4xl border-0 bg-white p-0 text-ink shadow-lift backdrop:bg-ink/30 backdrop:backdrop-blur-sm"
      >
        <ManageCategoriesPanel
          categories={categories}
          counts={counts}
          onClose={() => dialogRef.current?.close()}
        />
      </dialog>
    </>
  );
}

function ManageCategoriesPanel({
  categories,
  counts,
  onClose,
}: {
  categories: UserCategory[];
  counts: Map<string, number>;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fallback = categories.find((c) => c.isFallback);

  function startEdit(category: UserCategory | null) {
    setError(null);
    if (category) {
      setEditingId(category.id);
      setDraft({
        name: category.name,
        color: category.color,
        description: category.description ?? "",
      });
    } else {
      setEditingId("new");
      setDraft(EMPTY_DRAFT);
    }
  }

  function save() {
    const id = editingId;
    if (!id) return;
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result =
        id === "new" ? await createCategory(draft) : await updateCategory(id, draft);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(id === "new" ? `Added "${draft.name.trim()}"` : "Category saved");
      setEditingId(null);
    });
  }

  function remove(category: UserCategory) {
    const count = counts.get(category.id) ?? 0;
    const message =
      count > 0
        ? `Delete "${category.name}"? Its ${count} photo${count === 1 ? "" : "s"} will move to "${fallback?.name ?? "Other"}".`
        : `Delete "${category.name}"?`;
    if (!window.confirm(message)) return;
    setError(null);
    setPendingId(category.id);
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      setPendingId(null);
      if (!result.ok) setError(result.error);
      else toast(`Deleted "${category.name}"`);
    });
  }

  return (
    <div className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="manage-categories-title" className="text-lg font-semibold tracking-tight">
            Categories
          </h2>
          <p className="mt-0.5 text-sm text-mute">
            The AI sorts new uploads into these. Add your own, like
            &ldquo;Mobile Legends&rdquo; or &ldquo;Wifi&rdquo;.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-paper hover:text-brand-deep"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {editingId === "new" ? (
          <CategoryForm
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={() => setEditingId(null)}
            saving={isPending && pendingId === "new"}
            submitLabel="Add category"
          />
        ) : (
          <button
            type="button"
            onClick={() => startEdit(null)}
            className="mb-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-medium text-ink/80 transition hover:border-brand hover:text-brand-deep"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
            New category
          </button>
        )}

        {error && (
          <p role="alert" className="mx-1 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <ul className="space-y-1">
          {categories.map((c) =>
            editingId === c.id ? (
              <li key={c.id}>
                <CategoryForm
                  draft={draft}
                  onChange={setDraft}
                  onSave={save}
                  onCancel={() => setEditingId(null)}
                  saving={isPending && pendingId === c.id}
                  submitLabel="Save"
                />
              </li>
            ) : (
              <li
                key={c.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-paper ${
                  pendingId === c.id ? "opacity-50" : ""
                }`}
              >
                <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${colorStyles[c.color].dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.name}
                    {c.isFallback && (
                      <span className="ml-2 text-xs font-normal text-mute">catch-all</span>
                    )}
                  </p>
                  {c.description && (
                    <p className="truncate text-xs text-mute">{c.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-mute">
                  {counts.get(c.id) ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  disabled={isPending}
                  aria-label={`Edit ${c.name}`}
                  title="Edit"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-paper hover:text-brand-deep"
                >
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4 20 4-1 11-11-3-3L5 16l-1 4Zm10-13 3 3" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={isPending || c.isFallback}
                  aria-label={`Delete ${c.name}`}
                  title={c.isFallback ? "The catch-all category can't be deleted" : "Delete"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
                >
                  {pendingId === c.id ? (
                    <Spinner />
                  ) : (
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </svg>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      </div>

      <p className="border-t border-line px-5 py-3 text-xs text-mute">
        New categories apply to new uploads. Use &ldquo;Re-analyze&rdquo; to
        re-sort photos you already have.
      </p>
    </div>
  );
}

function CategoryForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  submitLabel,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="mb-2 space-y-3 rounded-xl border border-line bg-paper p-3"
    >
      <label className="block">
        <span className="text-xs font-medium text-mute">Name</span>
        <input
          autoFocus
          required
          maxLength={MAX_CATEGORY_NAME}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="e.g. Mobile Legends"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mute/70 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-mute">
          Hint for the AI <span className="text-mute/70">(optional)</span>
        </span>
        <input
          maxLength={MAX_CATEGORY_DESCRIPTION}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          placeholder="e.g. Match results, heroes and in-game screenshots"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mute/70 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </label>
      <fieldset>
        <legend className="text-xs font-medium text-mute">Color</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...draft, color })}
              aria-label={color}
              aria-pressed={draft.color === color}
              className={`h-6 w-6 rounded-full ${colorStyles[color].dot} ring-offset-2 ring-offset-white transition ${
                draft.color === color ? "ring-2 ring-ink" : "hover:scale-110"
              }`}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-mute hover:text-brand-deep"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !draft.name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-50"
        >
          {saving && <Spinner />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
