-- Audit hardening: storage bucket limits, loose length caps on free-text
-- fields, review edit/delete, and bounding-box pre-filters for the "near"
-- searches (no PostGIS dependency, just makes the new lat/lng index useful).
-- Apply as supabase_admin (storage.buckets columns need elevated privileges
-- on some self-hosted installs):
--   docker exec -i -e PGPASSWORD=... supabase-db psql -U supabase_admin -d postgres < 0006_audit_hardening.sql

-- 1. Storage bucket: cap file size and restrict to actual image types. 15MB
-- is loose on purpose — compression already brings normal photos well under
-- 1MB, this just stops multi-hundred-MB or non-image uploads.
update storage.buckets
set file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'toilet-photos';

-- 2. Loose length caps on free-text fields that had none. Generous enough to
-- never bother a real user, tight enough to stop unbounded storage abuse.
alter table public.toilets
  add constraint hint_note_length check (char_length(hint_note) <= 2000),
  add constraint venue_name_length check (char_length(venue_name) <= 200);

alter table public.venues
  add constraint venue_name_length check (char_length(name) <= 200);

-- 3. Review edit/delete, author-only. Reviews are simple free text with no
-- derived/generated columns, so direct RLS (same shape as
-- toilet_photos_delete_own) is enough — no RPC needed.
create policy reviews_update_own on public.reviews for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy reviews_delete_own on public.reviews for delete
  using (author_id = auth.uid());

grant update, delete on public.reviews to authenticated;

-- 4. Bounding-box pre-filter for the "near" searches. Postgres can't use an
-- index on the haversine expression, but it can use a plain btree index on
-- (lat, lng) once the query also has simple range conditions — so compute a
-- generous bounding box from the radius first, then apply the exact
-- haversine filter/order only within that (already small) row set.
create index if not exists toilets_lat_lng_idx on public.toilets (lat, lng);
create index if not exists venues_lat_lng_idx on public.venues (lat, lng);

create or replace function public.toilets_near(p_lat double precision, p_lng double precision, p_radius_m double precision default 3000)
returns setof public.toilets
language sql
stable
as $$
  with box as (
    select
      p_lat - (p_radius_m / 111320.0) as lat_min,
      p_lat + (p_radius_m / 111320.0) as lat_max,
      p_lng - (p_radius_m / (111320.0 * greatest(cos(radians(p_lat)), 0.01))) as lng_min,
      p_lng + (p_radius_m / (111320.0 * greatest(cos(radians(p_lat)), 0.01))) as lng_max
  )
  select t.*
  from public.toilets t, box
  where t.hidden = false
    and t.lat between box.lat_min and box.lat_max
    and t.lng between box.lng_min and box.lng_max
    and (
      6371000 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(t.lat)) * cos(radians(t.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(t.lat))
        ))
      )
    ) <= p_radius_m
  order by (
    6371000 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(t.lat)) * cos(radians(t.lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(t.lat))
      ))
    )
  ) asc
  limit 200;
$$;

create or replace function public.venues_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 500
)
returns setof public.venues
language sql
stable
as $$
  with box as (
    select
      p_lat - (p_radius_m / 111320.0) as lat_min,
      p_lat + (p_radius_m / 111320.0) as lat_max,
      p_lng - (p_radius_m / (111320.0 * greatest(cos(radians(p_lat)), 0.01))) as lng_min,
      p_lng + (p_radius_m / (111320.0 * greatest(cos(radians(p_lat)), 0.01))) as lng_max
  )
  select v.*
  from public.venues v, box
  where v.lat between box.lat_min and box.lat_max
    and v.lng between box.lng_min and box.lng_max
    and (
      6371000 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(v.lat))
        ))
      )
    ) <= p_radius_m
  order by (
    6371000 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(v.lat))
      ))
    )
  ) asc
  limit 50;
$$;
