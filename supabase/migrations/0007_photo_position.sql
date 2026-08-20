-- Photo ordering: add a position column so contributors can arrange a
-- toilet's photos (and so list cards can show a stable "first" thumbnail).
-- The app treats the first photo (position 0) as the listing's hero image.
--
-- Apply on the server (runs as postgres / supabase_admin):
--   docker exec -i supabase-db psql -U postgres -d postgres < 0007_photo_position.sql

-- 1. Position column, defaulting to 0. New photos land at the front by
-- inserting with a position, or at the back when omitted — see the RPC below.
alter table public.toilet_photos
  add column if not exists position integer not null default 0;

-- 2. Index for fast "first photo per toilet" lookups and stable ordering.
create index if not exists toilet_photos_toilet_position_idx
  on public.toilet_photos (toilet_id, position, created_at desc);

-- 3. Backfill: existing photos keep their relative chronological order, with
-- the newest at the front (position 0), matching the "newest photo shows
-- first" behaviour the app already advertised. Ordering is stable because
-- created_at ties are rare; break ties by id for a deterministic result.
with ordered as (
  select
    id,
    row_number() over (
      partition by toilet_id
      order by created_at desc, id asc
    ) - 1 as pos
  from public.toilet_photos
)
update public.toilet_photos tp
set position = ordered.pos
from ordered
where tp.id = ordered.id
  and tp.position <> ordered.pos;

-- 4. Reorder RPC: author-only, transactional. Accepts the full ordered list
-- of photo ids for one toilet and rewrites their positions to match. Guards
-- that every id actually belongs to the calling author, so no one can bump
-- or hide someone else's photo order.
create or replace function public.reorder_toilet_photos(p_toilet_id uuid, p_photo_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos integer := 0;
  v_photo_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Every photo must belong to this toilet and the calling author.
  if exists (
    select 1
    from unnest(p_photo_ids) as pid
    where not exists (
      select 1 from public.toilet_photos tp
      where tp.id = pid
        and tp.toilet_id = p_toilet_id
        and tp.author_id = auth.uid()
    )
  ) then
    raise exception 'cannot reorder photos you do not own';
  end if;

  for v_photo_id in select unnest(p_photo_ids) loop
    update public.toilet_photos
    set position = v_pos
    where id = v_photo_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

grant execute on function public.reorder_toilet_photos(uuid, uuid[]) to authenticated;
