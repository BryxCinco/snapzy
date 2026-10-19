-- =============================================================================
-- Snapzy — Phase 7: per-user custom categories
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- 1. Creates `categories` (one list per user) with RLS.
-- 2. Seeds the 13 built-in categories for every existing user.
-- 3. Adds screenshots.category_id, copies the old text `category` over,
--    then drops the text column.
-- Safe to re-run: every step checks before it acts.
-- =============================================================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  color       text not null default 'zinc',
  -- Optional hint that tells the AI what belongs here, e.g. "Wifi names and passwords".
  description text check (description is null or length(description) <= 200),
  -- The catch-all ("Other"): can't be deleted; AI and deletes fall back to it.
  is_fallback boolean not null default false,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  constraint categories_user_name_unique unique (user_id, name)
);

create index if not exists categories_user_idx on public.categories (user_id, sort_order);
-- At most one fallback category per user.
create unique index if not exists categories_one_fallback_idx
  on public.categories (user_id) where is_fallback;

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()) and not is_fallback);

-- -----------------------------------------------------------------------------
-- Seed built-in categories for every existing user.
-- `legacy` is the old text value in screenshots.category it replaces.
-- New users get the same list from the app on first visit.
-- -----------------------------------------------------------------------------
drop table if exists snapzy_default_categories;
create temporary table snapzy_default_categories as
select * from (values
  ( 0, 'People',         'Person',   'pink',    'One or more people are the main subject: portraits, selfies, group photos.', false),
  ( 1, 'Places',         'Place',    'amber',   'Buildings, landmarks, rooms, streets, landscapes, nature, maps.', false),
  ( 2, 'Food',           'Food',     'orange',  'Dishes, drinks, ingredients, restaurant menus.', false),
  ( 3, 'Animals',        'Animal',   'lime',    'Pets, wildlife, any animal as the main subject.', false),
  ( 4, 'Products',       'Product',  'fuchsia', 'Items for sale, shopping pages, gadgets, clothes, product photos.', false),
  ( 5, 'Logos',          'Logo',     'sky',     'A brand mark, app icon, emblem or wordmark is the main subject.', false),
  ( 6, 'QR codes',       'QR',       'emerald', 'A QR code or barcode is the main subject.', false),
  ( 7, 'Receipts',       'Receipt',  'teal',    'Receipts, invoices, bills, payment or order confirmations.', false),
  ( 8, 'Documents',      'Document', 'violet',  'Articles, notes, forms, slides, emails, IDs, other text-heavy pages.', false),
  ( 9, 'Chats & social', 'Chat',     'blue',    'Messaging apps, social media posts, comments, DMs.', false),
  (10, 'Code',           'Code',     'cyan',    'Source code, terminals, IDEs, error messages, stack traces.', false),
  (11, 'Memes',          'Meme',     'yellow',  'Jokes and humorous images with captions.', false),
  (999, 'Other',         'Other',    'zinc',    'Anything that fits none of the other categories.', true)
) as d(sort_order, name, legacy, color, description, is_fallback);

insert into public.categories (user_id, name, color, description, is_fallback, sort_order)
select u.id, d.name, d.color, d.description, d.is_fallback, d.sort_order
from auth.users u
cross join snapzy_default_categories d
on conflict (user_id, name) do nothing;

-- -----------------------------------------------------------------------------
-- screenshots.category (text) → screenshots.category_id (FK)
-- -----------------------------------------------------------------------------
alter table public.screenshots
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists screenshots_user_category_id_idx
  on public.screenshots (user_id, category_id);

do $$
begin
  -- Only if the old text column is still there (i.e. first run).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'screenshots' and column_name = 'category'
  ) then
    -- Older category lists: map their values onto today's built-ins.
    update public.screenshots s
    set category_id = c.id
    from public.categories c
    join snapzy_default_categories d on d.name = c.name
    where c.user_id = s.user_id
      and s.category_id is null
      and d.legacy = case s.category
                       when 'SocialMedia' then 'Chat'
                       when 'Schedule'    then 'Document'
                       else s.category
                     end;

    -- Anything left over that had a category goes to the user's "Other".
    update public.screenshots s
    set category_id = c.id
    from public.categories c
    where c.user_id = s.user_id
      and c.is_fallback
      and s.category_id is null
      and s.category is not null;

    alter table public.screenshots drop column category;
  end if;
end $$;

-- A screenshot may only point at one of its owner's own categories.
create or replace function public.check_screenshot_category_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'category does not belong to this user';
  end if;
  return new;
end;
$$;

drop trigger if exists screenshots_category_owner on public.screenshots;
create trigger screenshots_category_owner
  before insert or update of category_id on public.screenshots
  for each row execute function public.check_screenshot_category_owner();

drop table if exists snapzy_default_categories;
