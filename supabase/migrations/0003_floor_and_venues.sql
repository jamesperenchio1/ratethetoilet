-- Multi-floor support (free-text floor label) + a canonical venues table so a
-- multi-floor place collapses to one pin instead of N overlapping pins.
-- Builds on 0001_init.sql and 0002_raise_rate_limit.sql. Apply in order.

-- 1. Free-text floor label ("G", "1", "B2", "Mezzanine", "2A"...). Nullable —
--    single-floor toilets leave it null. No format constraint: floors aren't
--    reliably numeric.
alter table public.toilets add column floor text;

-- 2. Venues: the canonical place a toilet belongs to. Reused across floors and
--    across separate submissions by name + proximity (see find_or_create_venue).
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  author_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index venues_name_lower_idx on public.venues (lower(trim(name)));

alter table public.toilets add column venue_id uuid references public.venues(id) on delete set null;
create index toilets_venue_idx on public.toilets (venue_id);

-- 3. Nearby-venue lookup for the wizard's "attach to an existing place" search.
--    Plain-Postgres haversine, mirrors toilets_near() in 0001_init.sql.
create function public.venues_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 500
)
returns setof public.venues
language sql
stable
as $$
  select *
  from public.venues
  where (
    6371000 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(lat))
      ))
    )
  ) <= p_radius_m
  order by (
    6371000 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(lat))
      ))
    )
  ) asc
  limit 50;
$$;

-- 4. Reuse a venue by normalized name + proximity (100 m), else create it.
--    SECURITY DEFINER so the insert works for any authenticated, non-banned
--    user without exposing direct write access to the venues table.
create function public.find_or_create_venue(
  p_name text,
  p_lat double precision,
  p_lng double precision
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.venues;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v
  from public.venues
  where lower(trim(name)) = lower(trim(p_name))
    and (
      6371000 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(lat))
        ))
      )
    ) <= 100
  order by created_at asc
  limit 1;

  if found then
    return v;
  end if;

  insert into public.venues (name, lat, lng, author_id)
  values (trim(p_name), p_lat, p_lng, auth.uid())
  returning * into v;
  return v;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.venues enable row level security;

-- Venues are public reference data: anyone can read them; authenticated,
-- non-banned users can insert their own.
create policy venues_select on public.venues for select using (true);
create policy venues_insert on public.venues for insert
  with check (author_id = auth.uid() and not public.is_banned_self());

-- ============================================================================
-- Grants
-- ============================================================================

grant select on public.venues to anon, authenticated;
grant insert on public.venues to authenticated;
grant execute on function public.venues_near(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.find_or_create_venue(text, double precision, double precision) to authenticated;
