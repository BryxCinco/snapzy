"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { AVATAR_BUCKET, avatarPathOf } from "@/lib/avatar-server";
import {
  fallbackCategory,
  getUserCategories,
  seedDefaultCategories,
} from "@/lib/categories-server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedImageType } from "@/lib/uploads";

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

// Checks a password without touching the user's session cookies: a
// throwaway client that keeps nothing.
async function passwordMatches(email: string, password: string) {
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Permanently deletes the account after re-checking the password:
 * 1. removes every file under the user's Storage folder,
 * 2. calls delete_my_account() (migration 009), which deletes the auth user;
 *    their rows cascade away,
 * 3. clears the session cookies and sends them to the landing page.
 */
export async function deleteAccount(password: string): Promise<SettingsResult> {
  const { supabase, user } = await requireUser();
  if (!user?.email) return { ok: false, error: "You are not logged in." };
  if (!password) return { ok: false, error: "Enter your password." };
  if (!(await passwordMatches(user.email, String(password)))) {
    return { ok: false, error: "That password isn't right." };
  }

  // List the folder rather than trusting DB rows, so stray files go too.
  // Each round re-lists from the start (removed files drop out); the cap
  // stops a loop if removal ever silently fails.
  const PAGE = 1000;
  for (let round = 0; round < 50; round++) {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(user.id, { limit: PAGE });
    if (error) return { ok: false, error: error.message };
    if (!files || files.length === 0) break;
    const paths = files.map((f) => `${user.id}/${f.name}`);
    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove(paths.slice(i, i + REMOVE_BATCH));
      if (removeError) return { ok: false, error: removeError.message };
    }
    if (files.length < PAGE) break;
  }

  const { error: deleteError } = await supabase.rpc("delete_my_account");
  if (deleteError) {
    // PGRST202 = function not found.
    return {
      ok: false,
      error:
        deleteError.code === "PGRST202"
          ? "Account deletion isn't set up yet. Run supabase/migrations/009_delete_account.sql."
          : deleteError.message,
    };
  }

  // The user no longer exists; drop the now-useless session cookies.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/?account=deleted");
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;

/** Uploads a new profile photo (cropped to a 256px square WebP). */
export async function uploadAvatar(formData: FormData): Promise<SettingsResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image received." };
  }
  if (!isAllowedImageType(file.type)) {
    return { ok: false, error: "Use a PNG, JPG, WEBP or GIF image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Profile photos can be up to 5 MB." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // honor EXIF orientation from phone photos
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return { ok: false, error: "That image couldn't be read." };
  }

  const path = `${user.id}/avatar-${Date.now()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, webp, { contentType: "image/webp", upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const previous = avatarPathOf(user);
  const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_path: path } });
  if (metaError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { ok: false, error: metaError.message };
  }
  if (previous) await supabase.storage.from(AVATAR_BUCKET).remove([previous]);

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<SettingsResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You are not logged in." };

  const previous = avatarPathOf(user);
  const { error } = await supabase.auth.updateUser({ data: { avatar_path: null } });
  if (error) return { ok: false, error: error.message };
  if (previous) await supabase.storage.from(AVATAR_BUCKET).remove([previous]);

  revalidatePath("/dashboard", "layout");
  return { ok: true };
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
