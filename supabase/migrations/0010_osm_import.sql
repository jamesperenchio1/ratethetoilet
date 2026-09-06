-- Imported public restroom data: allow OpenStreetMap-derived entries to live
-- in the same `toilets` table without colliding with user-created ones.
--
-- Adds a unique `osm_id` so an import can be re-run idempotently (upsert on
-- the OSM node id), plus `osm_tags` to keep the raw OSM tags for reference.
-- Also seeds the synthetic "author" profile that imported rows are attributed
-- to (the app reuses the `author_id -> profiles` FK).
--
-- Apply on the server (runs as supabase_admin so it can seed auth.users):
--   docker exec -i supabase-db psql -U postgres -d postgres < 0010_osm_import.sql

-- 1. OSM node id — unique so re-imports upsert instead of duplicating.
--    Nullable because user-created toilets have no OSM id.
alter table public.toilets add column if not exists osm_id bigint;
alter table public.toilets add column if not exists osm_tags jsonb;

create unique index if not exists toilets_osm_id_unique
  on public.toilets (osm_id)
  where osm_id is not null;

-- 2. Synthetic author profile for imported rows. `author_id` is NOT NULL on
--    toilets, so every imported row needs an author. This handle is chosen to
--    read like a normal community handle (it appears as the listing author in
--    the UI) and deliberately avoids any "osm"/"import" wording.
--    Idempotent: if the profile already exists, do nothing.
do $$
begin
  if not exists (select 1 from public.profiles where handle = 'toilet_guide') then
    -- auth.users row first (profiles.id references auth.users(id)).
    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'toilet_guide@ratethetoilet.local', now(),
      '{"provider":"email","providers":["email"]}', '{}', false, false, now(), now());

    insert into public.profiles (id, handle, is_admin, is_banned)
    values ('00000000-0000-0000-0000-00000000000b', 'toilet_guide', false, false);
  end if;
end;
$$;
