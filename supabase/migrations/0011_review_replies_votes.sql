-- 0011: replies + votes on reviews
--
-- Add the ability to reply to a review (a nested comment) and to upvote /
-- downvote a review, matching the existing reviews RLS/grants model: public
-- read of non-hidden rows, insert as yourself, no direct edit/delete except
-- moderation through admin_hide_content(). Votes are one-per-review-per-user
-- (unique review_id + voter_id), toggleable between up (+1) and down (-1),
-- and removable by the voter.
--
-- Apply as supabase_admin (RLS is enabled on these tables; the grants/policies
-- below cover the anon/authenticated paths):
--   docker exec -i supabase-db psql -U postgres -d postgres < 0011_review_replies_votes.sql

-- ============================================================================
-- 1. Allow replies to be reported (extend the report target enum)
-- ============================================================================

alter type public.report_target_type_enum add value if not exists 'reply';

-- ============================================================================
-- 2. review_replies: a reply thread under a review
-- ============================================================================

create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index review_replies_review_idx on public.review_replies (review_id);

-- ============================================================================
-- 3. review_votes: one vote (up +1 / down -1) per review per user
-- ============================================================================

create table public.review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  unique (review_id, voter_id)
);
create index review_votes_review_idx on public.review_votes (review_id);

-- ============================================================================
-- 4. Row level security
-- ============================================================================

alter table public.review_replies enable row level security;
alter table public.review_votes enable row level security;

create policy review_replies_select on public.review_replies for select
  using (hidden = false or author_id = auth.uid() or public.is_admin());
create policy review_replies_insert on public.review_replies for insert
  with check (author_id = auth.uid() and not public.is_banned_self());

create policy review_votes_select on public.review_votes for select using (true);
create policy review_votes_insert on public.review_votes for insert
  with check (voter_id = auth.uid() and not public.is_banned_self());
create policy review_votes_update on public.review_votes for update
  using (voter_id = auth.uid()) with check (voter_id = auth.uid() and not public.is_banned_self());
create policy review_votes_delete on public.review_votes for delete
  using (voter_id = auth.uid());

-- ============================================================================
-- 5. Grants
-- ============================================================================

grant select, insert on public.review_replies to anon, authenticated;
grant select on public.review_votes to anon, authenticated;
grant select, insert, update, delete on public.review_votes to authenticated;
