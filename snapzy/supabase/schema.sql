-- =============================================================================
-- Snapzy — Phase 1 database schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where possible.
-- =============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

create table if not exists public.screenshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path  text not null,
  original_filename text,
  file_size     bigint,
  mime_type     text,
  ocr_text      text,
  summary       text,
  category      text,
  is_archived   boolean not null default false,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'done', 'failed')),
  processing_error text,
  processing_started_at timestamptz default now(),
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),

  -- Full-text search vector, kept in sync automatically from ocr_text + summary.
  -- Summary is weighted higher (A) than raw OCR text (B) so it ranks first.
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(ocr_text, '')), 'B')
  ) stored
);

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint tags_user_name_unique unique (user_id, name)
);

create table if not exists public.screenshot_tags (
  screenshot_id uuid not null references public.screenshots (id) on delete cascade,
  tag_id        uuid not null references public.tags (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (screenshot_id, tag_id)
);

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- -----------------------------------------------------------------------------

-- Full-text search on screenshots(ocr_text, summary)
create index if not exists screenshots_search_idx
  on public.screenshots using gin (search_vector);

-- Common lookups: a user's gallery, newest first / by category / expiring items
create index if not exists screenshots_user_created_idx
  on public.screenshots (user_id, created_at desc);
create index if not exists screenshots_user_category_idx
  on public.screenshots (user_id, category);
create index if not exists screenshots_expires_at_idx
  on public.screenshots (expires_at) where expires_at is not null;

create index if not exists tags_user_idx on public.tags (user_id);
create index if not exists screenshot_tags_tag_idx on public.screenshot_tags (tag_id);

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- (select auth.uid()) is wrapped in a subquery so Postgres evaluates it once
-- per query instead of once per row.
-- -----------------------------------------------------------------------------

alter table public.screenshots     enable row level security;
alter table public.tags            enable row level security;
alter table public.screenshot_tags enable row level security;

-- screenshots ---------------------------------------------------------------
drop policy if exists "screenshots_select_own" on public.screenshots;
create policy "screenshots_select_own" on public.screenshots
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "screenshots_insert_own" on public.screenshots;
create policy "screenshots_insert_own" on public.screenshots
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "screenshots_update_own" on public.screenshots;
create policy "screenshots_update_own" on public.screenshots
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "screenshots_delete_own" on public.screenshots;
create policy "screenshots_delete_own" on public.screenshots
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- tags ----------------------------------------------------------------------
drop policy if exists "tags_select_own" on public.tags;
create policy "tags_select_own" on public.tags
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "tags_insert_own" on public.tags;
create policy "tags_insert_own" on public.tags
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "tags_update_own" on public.tags;
create policy "tags_update_own" on public.tags
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_delete_own" on public.tags
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- screenshot_tags -----------------------------------------------------------
-- A link row is visible/editable only if the user owns BOTH the screenshot
-- and the tag (prevents attaching your screenshot to someone else's tag).
drop policy if exists "screenshot_tags_select_own" on public.screenshot_tags;
create policy "screenshot_tags_select_own" on public.screenshot_tags
  for select to authenticated
  using (
    exists (select 1 from public.screenshots s
            where s.id = screenshot_id and s.user_id = (select auth.uid()))
  );

drop policy if exists "screenshot_tags_insert_own" on public.screenshot_tags;
create policy "screenshot_tags_insert_own" on public.screenshot_tags
  for insert to authenticated
  with check (
    exists (select 1 from public.screenshots s
            where s.id = screenshot_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t
                where t.id = tag_id and t.user_id = (select auth.uid()))
  );

drop policy if exists "screenshot_tags_update_own" on public.screenshot_tags;
create policy "screenshot_tags_update_own" on public.screenshot_tags
  for update to authenticated
  using (
    exists (select 1 from public.screenshots s
            where s.id = screenshot_id and s.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.screenshots s
            where s.id = screenshot_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t
                where t.id = tag_id and t.user_id = (select auth.uid()))
  );

drop policy if exists "screenshot_tags_delete_own" on public.screenshot_tags;
create policy "screenshot_tags_delete_own" on public.screenshot_tags
  for delete to authenticated
  using (
    exists (select 1 from public.screenshots s
            where s.id = screenshot_id and s.user_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 4. STORAGE — private "screenshots" bucket
-- Files must be uploaded under a folder named after the user's id:
--   screenshots/<user_id>/<filename>.png
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "screenshots_storage_select_own" on storage.objects;
create policy "screenshots_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "screenshots_storage_insert_own" on storage.objects;
create policy "screenshots_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'screenshots'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "screenshots_storage_update_own" on storage.objects;
create policy "screenshots_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "screenshots_storage_delete_own" on storage.objects;
create policy "screenshots_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
