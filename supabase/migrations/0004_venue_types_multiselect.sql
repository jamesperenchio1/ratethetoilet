-- Multi-select venue/access types + user-defined custom venue types.
-- Builds on 0001_init, 0002_raise_rate_limit, 0003_floor_and_venues. Apply in order.

-- 1. Venue type catalog: base types are seeded; users add custom ones via the
--    "Other" input in the wizard (find_or_create_venue_type below).
create table public.venue_types (
  key text primary key,
  label text not null,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.venue_types (key, label, is_custom) values
  ('mall', 'Mall', false),
  ('gas', 'Gas station', false),
  ('temple', 'Temple', false),
  ('transit', 'Transit', false),
  ('public', 'Public', false),
  ('cafe', 'Café', false),
  ('hotel', 'Hotel', false),
  ('street', 'Street', false);

-- 2. Replace the single enums with arrays (a toilet can be e.g. "mall + cafe",
--    "paid + ask for key").
alter table public.toilets add column venue_types text[] not null default '{}';
alter table public.toilets add column access_types text[] not null default '{}';

-- Backfill existing rows. 'other' was the old catch-all with no real type —
-- it doesn't map to any concrete type, so it becomes empty.
update public.toilets
  set venue_types = case when venue_type = 'other' then '{}' else array[venue_type::text] end;
update public.toilets
  set access_types = case when access_type is null then '{}' else array[access_type::text] end;

alter table public.toilets drop column venue_type;
alter table public.toilets drop column access_type;

drop type public.venue_type_enum;
drop type public.access_type_enum;

-- 3. Normalize a free-text label into a stable key ("Coworking Space" ->
--    "coworking-space") so custom types dedup cleanly.
create function public.normalize_venue_type_key(p_label text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(p_label, '[^a-zA-Z0-9]+', '-', 'g')));
$$;

-- 4. Get-or-create a custom venue type, returning its key.
create function public.find_or_create_venue_type(p_label text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := public.normalize_venue_type_key(p_label);
  existing public.venue_types;
begin
  if k = '' then
    raise exception 'empty venue type';
  end if;
  if auth.uid() is null or public.is_banned_self() then
    raise exception 'not allowed';
  end if;

  select * into existing from public.venue_types where key = k;
  if found then
    return existing.key;
  end if;

  insert into public.venue_types (key, label, is_custom)
  values (k, trim(p_label), true)
  on conflict (key) do nothing;
  return k;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.venue_types enable row level security;

-- Catalog is public reference data; authenticated, non-banned users can add
-- custom entries.
create policy venue_types_select on public.venue_types for select using (true);
create policy venue_types_insert on public.venue_types for insert
  with check (auth.uid() is not null and is_custom = true and not public.is_banned_self());

-- ============================================================================
-- Grants
-- ============================================================================

grant select on public.venue_types to anon, authenticated;
grant insert on public.venue_types to authenticated;
grant execute on function public.normalize_venue_type_key(text) to anon, authenticated;
grant execute on function public.find_or_create_venue_type(text) to authenticated;
