-- Report handling: hide content automatically once enough distinct people
-- flag it, instead of requiring an admin to hide everything by hand.
--
-- Apply on the server (runs as postgres / supabase_admin):
--   docker exec -i supabase-db psql -U postgres -d postgres < 0009_report_auto_hide.sql

-- 1. One report per reporter per target — otherwise a single account could
-- file the same report repeatedly and hit the auto-hide threshold alone.
-- Anonymous reports (reporter_id null) are exempt since NULLs never compare
-- equal, but in practice every session already has a persistent auth id.
create unique index if not exists reports_unique_reporter_target
  on public.reports (target_type, target_id, reporter_id)
  where reporter_id is not null;

-- 2. Auto-hide trigger: once a target has 3+ queued reports, hide it for
-- everyone the same way admin_hide_content() would, without requiring an
-- admin to act first. The report itself stays "queued" so it still shows up
-- in the admin dashboard for final review/dismissal — this only flips the
-- content's own `hidden` flag early.
create function public.auto_hide_on_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_count integer;
  db_target_type text;
begin
  select count(*) into report_count
  from public.reports
  where target_type = new.target_type
    and target_id = new.target_id
    and status = 'queued';

  if report_count >= 3 then
    -- "hint" reports target a note that lives on the toilets row itself.
    db_target_type := case when new.target_type = 'hint' then 'toilet' else new.target_type::text end;
    if db_target_type = 'photo' then
      update public.toilet_photos set hidden = true where id = new.target_id;
    elsif db_target_type = 'review' then
      update public.reviews set hidden = true where id = new.target_id;
    else
      update public.toilets set hidden = true where id = new.target_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_on_report_threshold();
