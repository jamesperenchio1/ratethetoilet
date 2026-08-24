-- Denormalized Google-Maps-style address on each toilet, captured from the
-- wizard's location step (reverse-geocode of the pin or the picked search
-- result). Flat address_* columns match the existing venue_name pattern — no
-- joins needed for cards/detail pages. Builds on 0001-0007. Apply in order.

-- 1. Address columns on toilets (all nullable; old rows simply have none).
alter table public.toilets
  add column if not exists address_road text,
  add column if not exists address_house_number text,
  add column if not exists address_suburb text,
  add column if not exists address_city text,
  add column if not exists address_postcode text,
  add column if not exists address_country text;

-- 2. Extend the own-listing edit RPC to persist the address fields too.
create or replace function public.update_own_toilet(p_id uuid, p_patch jsonb)
returns public.toilets
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.toilets;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.toilets where id = p_id;
  if not found then
    raise exception 'toilet not found';
  end if;
  if t.author_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  update public.toilets set
    venue_name     = nullif(p_patch->>'venue_name', ''),
    venue_types    = public.jsonb_text_array(p_patch->'venue_types'),
    access_types   = public.jsonb_text_array(p_patch->'access_types'),
    supplies       = public.jsonb_text_array(p_patch->'supplies'),
    wheelchair     = nullif(p_patch->>'wheelchair', '')::tri_state_enum,
    hint_chips     = public.jsonb_text_array(p_patch->'hint_chips'),
    hint_note      = nullif(p_patch->>'hint_note', ''),
    cleanliness    = (p_patch->>'cleanliness')::smallint,
    smell          = (p_patch->>'smell')::smallint,
    privacy        = (p_patch->>'privacy')::smallint,
    floor          = nullif(p_patch->>'floor', ''),
    lat            = (p_patch->>'lat')::double precision,
    lng            = (p_patch->>'lng')::double precision,
    location_source = nullif(p_patch->>'location_source', ''),
    venue_id       = nullif(p_patch->>'venue_id', '')::uuid,
    address_road   = nullif(p_patch->>'address_road', ''),
    address_house_number = nullif(p_patch->>'address_house_number', ''),
    address_suburb = nullif(p_patch->>'address_suburb', ''),
    address_city   = nullif(p_patch->>'address_city', ''),
    address_postcode = nullif(p_patch->>'address_postcode', ''),
    address_country = nullif(p_patch->>'address_country', '')
  where id = p_id
  returning * into t;
  return t;
end;
$$;