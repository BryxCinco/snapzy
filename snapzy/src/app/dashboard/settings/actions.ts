"use server";

import { revalidatePath } from "next/cache";
import {
  fallbackCategory,
  getUserCategories,
  seedDefaultCategories,
} from "@/lib/categories-server";
import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

const BUCKET = "screenshots";
const CONFIRM_WORD = "DELETE";
// Storage .remove() takes a list; keep each request small.
const REMOVE_BATCH = 100;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function updatePassword(newPassword: string): Promise<SettingsResult> {
  const password = String(newPassword ?? "");
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Deletes every photo the user owns: storage files first, then the rows
 * (tag links go with them via ON DELETE CASCADE), then the unused tags.
 * Albums are kept.
 */
export async function deleteAllPhotos(confirmation: string): Promise<SettingsResult> {
  if (confirmation !== CONFIRM_WORD) {
    return { ok: false, error: `Type ${CONFIRM_WORD} to confirm.` };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  // RLS limits this to the user's own rows.
  const { data: rows, error } = await supabase.from("screenshots").select("storage_path");
  if (error) return { ok: false, error: error.message };

  const paths = rows.map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(paths.slice(i, i + REMOVE_BATCH));
    if (removeError) return { ok: false, error: removeError.message };
  }

  const { error: deleteError } = await supabase
    .from("screenshots")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) return { ok: false, error: deleteError.message };

  const { error: tagsError } = await supabase.from("tags").delete().eq("user_id", user.id);
  if (tagsError) return { ok: false, error: tagsError.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Removes every album the user made and restores the built-in ones.
 * Photos move to the fallback ("Other") first so none are left without one.
 */
export async function resetCategories(confirmation: string): Promise<SettingsResult> {
  if (confirmation !== CONFIRM_WORD) {
    return { ok: false, error: `Type ${CONFIRM_WORD} to confirm.` };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const categories = await getUserCategories(supabase, user.id);
  const fallback = fallbackCategory(categories);
  if (!fallback) return { ok: false, error: "No fallback category found." };

  const { error: moveError } = await supabase
    .from("screenshots")
    .update({ category_id: fallback.id })
    .eq("user_id", user.id)
    .neq("category_id", fallback.id);
  if (moveError) return { ok: false, error: moveError.message };

  // RLS refuses to delete the fallback, so "Other" survives this.
  const { error: deleteError } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", user.id)
    .eq("is_fallback", false);
  if (deleteError) return { ok: false, error: deleteError.message };

  try {
    await seedDefaultCategories(supabase, user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not restore albums." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
