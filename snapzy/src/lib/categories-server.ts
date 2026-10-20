import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_CATEGORIES,
  toCategoryColor,
  type UserCategory,
} from "@/lib/categories";

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_fallback: boolean;
};

function toUserCategory(row: CategoryRow): UserCategory {
  return {
    id: row.id,
    name: row.name,
    color: toCategoryColor(row.color),
    description: row.description,
    isFallback: row.is_fallback,
  };
}

async function selectCategories(supabase: SupabaseClient) {
  return supabase
    .from("categories")
    .select("id, name, color, description, is_fallback")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

/**
 * The user's categories in display order, fallback ("Other") last.
 * Users created after migration 005 have none yet, so the built-ins are
 * seeded on first call. RLS scopes everything to the logged-in user.
 */
export async function getUserCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserCategory[]> {
  const { data, error } = await selectCategories(supabase);
  if (error) throw error;
  if (data.length > 0) return data.map(toUserCategory);

  await seedDefaultCategories(supabase, userId);

  const { data: seeded, error: reloadError } = await selectCategories(supabase);
  if (reloadError) throw reloadError;
  return seeded.map(toUserCategory);
}

/** Adds any missing built-in categories. Existing ones are left alone. */
export async function seedDefaultCategories(supabase: SupabaseClient, userId: string) {
  // ignoreDuplicates makes two concurrent first visits harmless.
  const { error } = await supabase.from("categories").upsert(
    DEFAULT_CATEGORIES.map((c, i) => ({
      user_id: userId,
      name: c.name,
      color: c.color,
      description: c.description,
      is_fallback: c.isFallback ?? false,
      sort_order: c.isFallback ? 999 : i,
    })),
    { onConflict: "user_id,name", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export function fallbackCategory(categories: UserCategory[]) {
  return categories.find((c) => c.isFallback) ?? categories.at(-1);
}
