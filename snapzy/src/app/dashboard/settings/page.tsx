import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { WatercolorBackdrop } from "@/components/watercolor";
import { getAvatarUrl } from "@/lib/avatar-server";
import { createClient } from "@/lib/supabase/server";
import { SettingsHeader, SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings · Snapzy" };

export default function SettingsPage() {
  return (
    <div className="paper-grain relative flex flex-1 flex-col">
      <WatercolorBackdrop />
      <SettingsHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <Suspense fallback={<SettingsSkeleton />}>
          <AccountSettings />
        </Suspense>
      </main>
    </div>
  );
}

async function AccountSettings() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // head: true → counts only, no rows. RLS scopes both to this user.
  const [photos, albums, avatarUrl] = await Promise.all([
    supabase.from("screenshots").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    getAvatarUrl(supabase, user),
  ]);

  return (
    <SettingsView
      email={user.email ?? ""}
      avatarUrl={avatarUrl}
      joinedAt={user.created_at}
      photoCount={photos.count ?? 0}
      albumCount={albums.count ?? 0}
      logout={logout}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      {["md:col-span-4 h-56", "md:col-span-2 h-56", "md:col-span-3 h-44", "md:col-span-3 h-44", "md:col-span-6 h-40"].map(
        (c, i) => (
          <div key={i} className={`animate-pulse rounded-4xl bg-card/70 shadow-soft ${c}`} />
        ),
      )}
    </div>
  );
}
