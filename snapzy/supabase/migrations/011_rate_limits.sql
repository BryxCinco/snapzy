-- =============================================================================
-- Snapzy — Phase 10: per-user rate limiting (uploads and AI sorts)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================================

create table if not exists public.rate_limits (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  action     text not null,
  -- Uploads cost 1 each; an AI sort costs one unit per 10 photos.
  cost       int  not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_user_action_idx
  on public.rate_limits (user_id, action, created_at desc);

-- No policies and no grants: signed-in users cannot read, add or delete rows
-- themselves, so they can't reset their own counter. Only the function below
-- (SECURITY DEFINER) touches the table.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts what the caller did in the last p_window_seconds. If adding p_cost
-- would pass p_limit it answers allowed = false (and how long to wait);
-- otherwise it records the action and answers allowed = true.
-- The advisory lock makes two simultaneous requests count one after the other.
create or replace function public.check_rate_limit(
  p_action         text,
  p_limit          int,
  p_window_seconds int,
  p_cost           int default 1
)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  since  timestamptz := now() - make_interval(secs => p_window_seconds);
  used   bigint;
  oldest timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_cost < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_action, 0));

  -- Housekeeping uses a fixed day, never the caller's window, so a caller
  -- can't clear its own history by passing a tiny window.
  delete from public.rate_limits
  where user_id = uid and action = p_action and created_at < now() - interval '1 day';

  select coalesce(sum(r.cost), 0), min(r.created_at)
    into used, oldest
  from public.rate_limits r
  where r.user_id = uid and r.action = p_action and r.created_at >= since;

  if used + p_cost > p_limit then
    allowed := false;
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (oldest + make_interval(secs => p_window_seconds) - now())))::int
    );
    return next;
    return;
  end if;

  insert into public.rate_limits (user_id, action, cost) values (uid, p_action, p_cost);
  allowed := true;
  retry_after_seconds := 0;
  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int, int) from public, anon;
grant execute on function public.check_rate_limit(text, int, int, int) to authenticated;
