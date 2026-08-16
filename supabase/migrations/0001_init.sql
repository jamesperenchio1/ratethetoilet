-- Hongnam schema: handle-as-primary-key identity model (see wireframe thread 2a),
-- toilets/photos/reviews content, and a moderation report queue.
-- Applied to the self-hosted Supabase Postgres instance on 192.168.1.102.

create extension if not exists pgcrypto;

create type venue_type_enum as enum ('mall','gas','temple','transit','public','cafe','hotel','street','other');
create type access_type_enum as enum ('free','paid','customers_only','ask_for_key');
create type tri_state_enum as enum ('yes','no','unsure');
create type report_target_type_enum as enum ('photo','review','toilet','hint');
create type report_status_enum as enum ('queued','resolved','dismissed');

-- ============================================================================
-- Tables
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-zA-Z0-9_]{3,24}$')
);

create table public.toilets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  lat double precision not null,
  lng double precision not null,
  venue_type venue_type_enum not null,
  access_type access_type_enum not null,
  supplies text[] not null default '{}',
  wheelchair tri_state_enum,
  hint_chips text[] not null default '{}',
  hint_note text,
  cleanliness smallint check (cleanliness between 0 and 100),
  smell smallint check (smell between 0 and 100),
  privacy smallint check (privacy between 0 and 100),
  overall_score smallint generated always as (
    (
      case
        when cleanliness is null and smell is null and privacy is null then null
        else round(
          (coalesce(cleanliness, 0) + coalesce(smell, 0) + coalesce(privacy, 0))::numeric
          / nullif(
              (case when cleanliness is null then 0 else 1 end)
              + (case when smell is null then 0 else 1 end)
              + (case when privacy is null then 0 else 1 end),
              0
            )
        )
      end
    )::smallint
  ) stored,
  venue_name text,
  location_source text,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index toilets_author_idx on public.toilets (author_id);
create index toilets_hidden_idx on public.toilets (hidden);

create table public.toilet_photos (
  id uuid primary key default gen_random_uuid(),
  toilet_id uuid not null references public.toilets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  storage_path text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index toilet_photos_toilet_idx on public.toilet_photos (toilet_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  toilet_id uuid not null references public.toilets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_toilet_idx on public.reviews (toilet_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type report_target_type_enum not null,
  target_id uuid not null,
  reason text not null,
  note text,
  reporter_id uuid references public.profiles(id),
  status report_status_enum not null default 'queued',
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);
create index reports_status_idx on public.reports (status);

-- ============================================================================
-- Functions
-- ============================================================================

create sequence public.handle_seq start 1;

create function public.mint_handle()
returns text
language sql
security definer
set search_path = public
as $$
  select 'toilet_user' || nextval('public.handle_seq')::text;
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create function public.is_banned_self()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_banned from public.profiles where id = auth.uid()), false);
$$;

-- Mints a profile (and handle) for the current session the first time it's
-- called, and is a no-op afterwards. This is the "first post triggers ...
-- once, ever" moment from the flow map — never called just for browsing.
create function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_row public.profiles;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into profile_row from public.profiles where id = uid;
  if found then
    return profile_row;
  end if;

  insert into public.profiles (id, handle) values (uid, public.mint_handle())
  returning * into profile_row;
  return profile_row;
end;
$$;

-- 3 posts (toilets + reviews combined) per rolling hour, per user.
create function public.can_post()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  recent_count int;
  oldest_in_window timestamptz;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'retryAt', null);
  end if;

  select count(*), min(created_at) into recent_count, oldest_in_window
  from (
    select created_at from public.toilets where author_id = uid and created_at > now() - interval '1 hour'
    union all
    select created_at from public.reviews where author_id = uid and created_at > now() - interval '1 hour'
  ) recent;

  if recent_count < 3 then
    return jsonb_build_object('allowed', true, 'retryAt', null);
  end if;

  return jsonb_build_object('allowed', false, 'retryAt', oldest_in_window + interval '1 hour');
end;
$$;

-- Server-side enforcement of the same "3 posts/hour" rule can_post() reports
-- for the UI. can_post() is advisory only (lets the app show S17 before the
-- user fills out a whole form) — this trigger is what actually stops a
-- client that skips the RPC and posts straight to PostgREST.
create function public.enforce_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from (
    select created_at from public.toilets where author_id = new.author_id and created_at > now() - interval '1 hour'
    union all
    select created_at from public.reviews where author_id = new.author_id and created_at > now() - interval '1 hour'
  ) recent;

  if recent_count >= 3 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger toilets_rate_limit before insert on public.toilets
  for each row execute function public.enforce_post_rate_limit();
create trigger reviews_rate_limit before insert on public.reviews
  for each row execute function public.enforce_post_rate_limit();

-- Plain-Postgres haversine distance search (no PostGIS dependency).
create function public.toilets_near(p_lat double precision, p_lng double precision, p_radius_m double precision default 3000)
returns setof public.toilets
language sql
stable
as $$
  select *
  from public.toilets
  where hidden = false
    and (
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
  limit 200;
$$;

-- Self-service "delete my handle and posts" (Settings, S19). Soft: hides the
-- author everywhere via the same is_banned flag moderation uses, since
-- content belongs to the id, not the device, and is never actually erased.
create function public.self_delete()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles set is_banned = true where id = auth.uid();
end;
$$;

create function public.admin_hide_content(p_target_type text, p_target_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_target_type = 'photo' then
    update public.toilet_photos set hidden = p_hidden where id = p_target_id;
  elsif p_target_type = 'review' then
    update public.reviews set hidden = p_hidden where id = p_target_id;
  else
    update public.toilets set hidden = p_hidden where id = p_target_id;
  end if;
end;
$$;

create function public.admin_set_banned(p_target_id uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.profiles set is_banned = p_banned where id = p_target_id;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.toilets enable row level security;
alter table public.toilet_photos enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

-- profiles: readable by everyone (handles are public by design); writable
-- only via ensure_profile()/self_delete()/admin_* (SECURITY DEFINER), except
-- a self-service rename, which is restricted to the `handle` column below.
create policy profiles_select_all on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated, anon;
grant update (handle) on public.profiles to authenticated;

-- toilets / toilet_photos / reviews: public read of non-hidden rows (authors
-- and admins can also see their own hidden rows); insert as yourself; no
-- direct update/delete — moderation goes through admin_hide_content().
create policy toilets_select on public.toilets for select
  using (hidden = false or author_id = auth.uid() or public.is_admin());
create policy toilets_insert on public.toilets for insert
  with check (author_id = auth.uid() and not public.is_banned_self());

create policy toilet_photos_select on public.toilet_photos for select
  using (hidden = false or author_id = auth.uid() or public.is_admin());
create policy toilet_photos_insert on public.toilet_photos for insert
  with check (author_id = auth.uid() and not public.is_banned_self());

create policy reviews_select on public.reviews for select
  using (hidden = false or author_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert
  with check (author_id = auth.uid() and not public.is_banned_self());

-- reports: anyone can file one (no account required); only admins can read
-- or resolve the queue.
create policy reports_insert on public.reports for insert
  with check ((reporter_id is null or reporter_id = auth.uid()) and not public.is_banned_self());
create policy reports_select_admin on public.reports for select using (public.is_admin());
create policy reports_update_admin on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Grants
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant select, insert on public.toilets to anon, authenticated;
grant select, insert on public.toilet_photos to anon, authenticated;
grant select, insert on public.reviews to anon, authenticated;
grant insert on public.reports to anon, authenticated;
grant select, update on public.reports to authenticated;

grant execute on function public.mint_handle() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_banned_self() to anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.can_post() to authenticated;
grant execute on function public.toilets_near(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.self_delete() to authenticated;
grant execute on function public.admin_hide_content(text, uuid, boolean) to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- ============================================================================
-- Storage: public bucket for toilet photos
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('toilet-photos', 'toilet-photos', true)
on conflict (id) do nothing;

create policy toilet_photos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'toilet-photos' and not public.is_banned_self());
