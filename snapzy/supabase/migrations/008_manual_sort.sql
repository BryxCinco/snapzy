-- =============================================================================
-- Snapzy — uploads wait for "Sort photos" instead of auto-analyzing
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- Adds the status 'new' = uploaded, not analyzed yet.
-- =============================================================================

alter table public.screenshots
  drop constraint if exists screenshots_status_check;
alter table public.screenshots
  add constraint screenshots_status_check
  check (status in ('new', 'pending', 'processing', 'done', 'failed'));
