-- =============================================================================
-- Snapzy — Phase 6: ranked natural-language search
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- =============================================================================

-- Returns the caller's screenshots that match `q`, best match first.
--  * websearch_to_tsquery handles natural input: quotes, OR, -exclude.
--  * A prefix query (each word + :*) makes search-as-you-type work, so
--    "rece" already finds "receipt".
--  * Tag names and the original filename also match, with a smaller weight.
-- SECURITY INVOKER (the default) keeps RLS in force; the user_id filter is
-- a second guard.
create or replace function public.search_screenshots(q text)
returns table (id uuid, rank real)
language sql
stable
set search_path = public
as $$
  with input as (
    select
      websearch_to_tsquery('english', q) as ws,
      nullif(
        array_to_string(
          array(
            select t || ':*'
            from regexp_split_to_table(lower(q), '[^[:alnum:]]+') as t
            where t <> ''
          ),
          ' & '
        ),
        ''
      ) as prefix_text
  ),
  queries as (
    select
      ws,
      case when prefix_text is null then null
           else to_tsquery('english', prefix_text) end as prefix
    from input
  )
  select s.id,
         (
           ts_rank(s.search_vector, coalesce(qs.ws, ''::tsquery)) * 2
           + ts_rank(s.search_vector, coalesce(qs.prefix, ''::tsquery))
           + case when exists (
               select 1
               from public.screenshot_tags st
               join public.tags t on t.id = st.tag_id
               where st.screenshot_id = s.id
                 and t.name ilike trim(q) || '%'
             ) then 0.5 else 0 end
           + case when s.original_filename ilike '%' || trim(q) || '%' then 0.1 else 0 end
         )::real as rank
  from public.screenshots s, queries qs
  where s.user_id = (select auth.uid())
    and s.is_archived = false
    and length(trim(q)) > 0
    and (
      s.search_vector @@ qs.ws
      or (qs.prefix is not null and s.search_vector @@ qs.prefix)
      or exists (
        select 1
        from public.screenshot_tags st
        join public.tags t on t.id = st.tag_id
        where st.screenshot_id = s.id
          and t.name ilike trim(q) || '%'
      )
      or s.original_filename ilike '%' || trim(q) || '%'
    )
  order by rank desc, s.created_at desc
  limit 200;
$$;

grant execute on function public.search_screenshots(text) to authenticated;
