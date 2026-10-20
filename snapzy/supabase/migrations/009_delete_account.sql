-- =============================================================================
-- Snapzy — let a user delete their own account
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- The app verifies the password and removes the user's files from Storage
-- first (Storage objects must be deleted through the Storage API), then
-- calls this. Deleting the auth.users row cascades to screenshots, tags,
-- screenshot_tags and categories (all reference auth.users ON DELETE CASCADE).
--
-- SECURITY DEFINER is needed to touch auth.users; it only ever deletes the
-- caller's own row (auth.uid()), and only signed-in users may call it.
-- =============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
