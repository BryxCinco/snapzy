"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_CATEGORIES,
  MAX_CATEGORY_DESCRIPTION,
  MAX_CATEGORY_NAME,
  toCategoryColor,
} from "@/lib/categories";
import { fallbackCategory, getUserCategories } from "@/lib/categories-server";
import { createClient } from "@/lib/supabase/server";

export type CategoryActionResult = { ok: true } | { ok: false; error: string };

type CategoryInput = {
  name: string;
  color: string;
  description?: string | null;
};

function cleanInput(input: CategoryInput) {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  const description = String(input.description ?? "").trim();
  return {
    name,
    color: toCategoryColor(input.color),
    description: description ? description.slice(0, MAX_CATEGORY_DESCRIPTION) : null,
  };
}

function validateName(name: string): string | null {
  if (!name) return "Give the category a name.";
  if (name.length > MAX_CATEGORY_NAME) {
    return `Keep the name under ${MAX_CATEGORY_NAME} characters.`;
  }
  return null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createCategory(
  input: CategoryInput,
): Promise<CategoryActionResult> {
  const { name, color, description } = cleanInput(input);
  const invalid = validateName(name);
  if (invalid) return { ok: false, error: invalid };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const existing = await getUserCategories(supabase, user.id);
  if (existing.length >= MAX_CATEGORIES) {
    return { ok: false, error: `You can have up to ${MAX_CATEGORIES} categories.` };
  }
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `"${name}" already exists.` };
  }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name,
    color,
    description,
    // After the built-ins (0–12), before "Other" (999).
    sort_order: 100,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCategory(
  categoryId: string,
  input: CategoryInput,
): Promise<CategoryActionResult> {
  const { name, color, description } = cleanInput(input);
  const invalid = validateName(name);
  if (invalid) return { ok: false, error: invalid };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const existing = await getUserCategories(supabase, user.id);
  if (!existing.some((c) => c.id === categoryId)) {
    return { ok: false, error: "Category not found." };
  }
  if (
    existing.some(
      (c) => c.id !== categoryId && c.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { ok: false, error: `"${name}" already exists.` };
  }

  const { error } = await supabase
    .from("categories")
    .update({ name, color, description })
    .eq("id", categoryId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Deletes a category; its photos move to the fallback ("Other"). */
export async function deleteCategory(
  categoryId: string,
): Promise<CategoryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const categories = await getUserCategories(supabase, user.id);
  const target = categories.find((c) => c.id === categoryId);
  if (!target) return { ok: false, error: "Category not found." };
  if (target.isFallback) {
    return { ok: false, error: `"${target.name}" is the catch-all and can't be deleted.` };
  }
  const fallback = fallbackCategory(categories);
  if (!fallback || fallback.id === target.id) {
    return { ok: false, error: "No fallback category to move photos into." };
  }

  const { error: moveError } = await supabase
    .from("screenshots")
    .update({ category_id: fallback.id })
    .eq("category_id", target.id);
  if (moveError) return { ok: false, error: moveError.message };

  const { error } = await supabase.from("categories").delete().eq("id", target.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Manually moves one screenshot into another category. */
export async function updateScreenshotCategory(
  screenshotId: string,
  newCategoryId: string,
): Promise<CategoryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const categories = await getUserCategories(supabase, user.id);
  if (!categories.some((c) => c.id === newCategoryId)) {
    return { ok: false, error: "Category not found." };
  }

  // RLS limits the update to the user's own screenshot; select() tells us
  // whether a row actually matched.
  const { data, error } = await supabase
    .from("screenshots")
    .update({ category_id: newCategoryId })
    .eq("id", screenshotId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Screenshot not found." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
