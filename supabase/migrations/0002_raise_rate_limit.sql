-- Raise the post rate limit from 3 to 10 (toilets + reviews combined) per
-- rolling hour, per user. Same functions as 0001_init.sql, bodies swapped —
-- the triggers already attached to public.toilets/public.reviews don't need
-- re-creating.

create or replace function public.can_post()
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

  if recent_count < 10 then
    return jsonb_build_object('allowed', true, 'retryAt', null);
  end if;

  return jsonb_build_object('allowed', false, 'retryAt', oldest_in_window + interval '1 hour');
end;
$$;

create or replace function public.enforce_post_rate_limit()
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

  if recent_count >= 10 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
