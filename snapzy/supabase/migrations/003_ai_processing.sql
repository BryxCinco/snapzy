-- =============================================================================
-- Snapzy — Phase 4: AI processing status
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================================

alter table public.screenshots
  add column if not exists status text not null default 'pending',
  add column if not exists processing_error text,
  add column if not exists processing_started_at timestamptz default now();

alter table public.screenshots
  drop constraint if exists screenshots_status_check;
alter table public.screenshots
  add constraint screenshots_status_check
  check (status in ('pending', 'processing', 'done', 'failed'));

-- Screenshots uploaded before this phase were never analyzed. Mark them as
-- failed so the gallery shows a "Run AI" button instead of an endless spinner.
update public.screenshots
set status = 'failed',
    processing_error = 'Uploaded before AI processing was enabled.'
where status = 'pending'
  and summary is null
  and created_at < now() - interval '1 minute';

-- screenshot_tags had no UPDATE policy; upserts on link rows need one.
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
