-- =============================================================================
-- Snapzy — Phase 3: upload metadata
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================================

alter table public.screenshots
  add column if not exists original_filename text,
  add column if not exists file_size         bigint,
  add column if not exists mime_type         text;

-- Enforce limits at the storage layer too (matches the app's 10 MB check).
update storage.buckets
set file_size_limit    = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'screenshots';
