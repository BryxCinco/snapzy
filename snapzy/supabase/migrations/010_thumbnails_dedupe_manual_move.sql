-- =============================================================================
-- Snapzy — Phase 9: thumbnails, duplicate detection, manual-move protection
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================================

alter table public.screenshots
  -- 400px WebP preview stored next to the original (<user_id>/thumb_*.webp).
  add column if not exists thumbnail_path    text,
  -- SHA-256 (hex) of the uploaded file, to refuse duplicate uploads.
  add column if not exists file_hash         text,
  -- True once the user picked the album themselves; re-analyze leaves it alone.
  add column if not exists is_manually_moved boolean not null default false;

-- One copy of each file per user. Older rows have no hash, so they are skipped.
create unique index if not exists screenshots_user_file_hash_uidx
  on public.screenshots (user_id, file_hash)
  where file_hash is not null;

-- Photo count per album over the whole library (the gallery only loads 50 at a
-- time). category_id is null for photos that are not sorted yet.
-- SECURITY INVOKER keeps RLS in force; the user_id filter is a second guard.
create or replace function public.screenshot_counts()
returns table (category_id uuid, n bigint)
language sql
stable
set search_path = public
as $$
  select s.category_id, count(*)
  from public.screenshots s
  where s.user_id = auth.uid()
    and s.is_archived = false
  group by s.category_id;
$$;

revoke all on function public.screenshot_counts() from public, anon;
grant execute on function public.screenshot_counts() to authenticated;
