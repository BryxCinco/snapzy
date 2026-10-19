-- =============================================================================
-- Snapzy — fix: expose `categories` to the Data API
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Newer Supabase projects don't auto-grant tables created in SQL to the
-- API roles, so the app got "permission denied for table categories".
-- RLS (migration 005) still limits every row to its owner.
-- =============================================================================

grant select, insert, update, delete on table public.categories to authenticated;
