import type { SupabaseClient, User } from "@supabase/supabase-js";

// Profile photos live in the private screenshots bucket under the user's
// folder ("<uid>/avatar-<time>.webp"); the path is kept in user_metadata.
// They have no screenshots row, so they never show up in the gallery and
// "Delete all photos" leaves them alone; deleting the account removes them.
export const AVATAR_BUCKET = "screenshots";

export function avatarPathOf(user: User): string | null {
  const path = user.user_metadata?.avatar_path;
  return typeof path === "string" && path.startsWith(`${user.id}/`) ? path : null;
}

/** A short-lived signed URL for the user's profile photo, or null. */
export async function getAvatarUrl(supabase: SupabaseClient, user: User) {
  const path = avatarPathOf(user);
  if (!path) return null;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
