-- Own-listing edit/delete for the Me tab. Builds on 0001-0004. Apply in order.
-- Apply as supabase_admin (superuser) — storage.object policies and the
-- storage.objects delete inside delete_own_toilet need privileges beyond the
-- postgres role:
--   docker exec -i -e PGPASSWORD=... supabase-db psql -U supabase_admin -d postgres < 0005_edit_listings.sql

-- 1. Helper: jsonb array -> text[] (jsonb_array_to_text_array is not a Postgres
-- builtin). Used by update_own_toilet below.
create or replace function public.jsonb_text_array(p jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array(select jsonb_array_elements_text(p)), '{}');
$$;

-- 2. Update your own listing. Full-object patch (all editable columns sent,
--    null meaning "set to null") — predictable and no accidental partial writes.
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
    venue_id       = nullif(p_patch->>'venue_id', '')::uuid
  where id = p_id
  returning * into t;
  return t;
end;
$$;

-- 3. Delete your own listing. Removes the toilet row (photos cascade) and the
--    photos' storage records so the files don't dangle in the bucket.
create or replace function public.delete_own_toilet(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.toilets;
  photo public.toilet_photos;
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

  -- The storage.objects table blocks direct deletes via the protect_objects_delete
  -- trigger unless this GUC is set for the transaction (the Storage API does the
  -- same internally). Scoped to this transaction, so it can't leak out.
  perform set_config('storage.allow_delete_query', 'true', true);
  for photo in select * from public.toilet_photos where toilet_id = p_id loop
    delete from storage.objects
      where bucket_id = 'toilet-photos' and name = photo.storage_path;
  end loop;

  delete from public.toilets where id = p_id;
end;
$$;

-- 4. Allow the author to remove an individual photo (storage file + row) from
--    the edit screen. The storage API checks these policies; the delete_own_toilet
--    RPC above bypasses RLS as its owner.
drop policy if exists toilet_photos_storage_delete on storage.objects;
drop policy if exists toilet_photos_storage_update on storage.objects;
drop policy if exists toilet_photos_delete_own on public.toilet_photos;
create policy toilet_photos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'toilet-photos' and (owner = auth.uid() or public.is_admin()));
create policy toilet_photos_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'toilet-photos' and owner = auth.uid())
  with check (bucket_id = 'toilet-photos' and owner = auth.uid());

create policy toilet_photos_delete_own on public.toilet_photos for delete
  using (author_id = auth.uid());

-- 5. Grants
grant execute on function public.update_own_toilet(uuid, jsonb) to authenticated;
grant execute on function public.delete_own_toilet(uuid) to authenticated;
grant delete on public.toilet_photos to authenticated;