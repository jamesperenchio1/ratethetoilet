# RateTheToilet

A crowdsourced public-toilet-finder PWA (Bangkok-focused — "hongnam" = ห้องน้ำ, Thai
for restroom). Implemented from the `Hongnam Wireframes.dc.html` design doc.

## Identity model

There are no accounts in the traditional sense. A user gets an auto-generated
**handle** (`toilet_user51`) the first time they post, backed by a stable
internal id (a Supabase anonymous-auth user). Renaming changes the display
handle only — the id never changes, and content always belongs to the id, not
the device. An email is used only to send a magic link that reattaches a new
device to an existing id (`supabase.auth.updateUser({ email })` on the
anonymous session) — never a password, never a signup wall.

See `src/lib/useAuth.ts` and `supabase/migrations/0001_init.sql` for the
implementation, and the design doc's thread `2a` for the full spec.

## Stack

- **Frontend**: Vite + React + TypeScript PWA, MapLibre GL (OpenFreeMap tiles),
  `@supabase/supabase-js`. Deployed on Vercel, auto-deploying from `main`.
- **Backend**: self-hosted Supabase (Postgres + Auth + PostgREST + Storage),
  running on a home server via Docker Compose, exposed through an existing
  Cloudflare Tunnel at `ratethetoilet-api.gingerbrosshop.com`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_ANON_KEY
npm run dev
```

## Backend

The self-hosted Supabase stack lives at `/opt/ratethetoilet-supabase/docker` on the
home server (a sparse checkout of `supabase/supabase`'s `docker/` folder, kept
out of this repo). The schema/RLS this app depends on is versioned here at
`supabase/migrations/*.sql`.

**Applying migrations**: run `supabase/apply-migrations.sh` from a checkout on
the home server. It tracks what's already applied in a `_migrations` table on
the DB itself, so it's safe to re-run any time (new migrations get picked up,
already-applied ones are skipped) — no more guessing which `.sql` files have
actually landed. A migration that needs elevated privileges (noted in its own
header comment, e.g. `0005_edit_listings.sql`) needs
`SUPABASE_DB_USER=supabase_admin supabase/apply-migrations.sh`.

**Backups**: `supabase/backup.sh` dumps the whole DB to a gzipped, timestamped
file (default `./backups`, pruned after `BACKUP_KEEP_DAYS`, default 14) — see
the script header for a suggested daily cron entry. This covers the Postgres
data (toilets, reviews, profiles, everything); photo bytes live in Storage
separately and aren't included.

Both scripts assume the DB container is named `supabase-db` (override with
`SUPABASE_DB_CONTAINER` if yours differs) and that `docker exec` on the host
can reach it without a password prompt (a `~/.pgpass` entry or the container
trusting local connections).

## Admin / moderation

There's no separate admin signup flow. Sign in for real (your own email,
through the normal "Keep this name" flow, not the anonymous guest path) once,
then flip `is_admin = true` on your `profiles` row directly in the database.
The `/admin` route then shows the report queue (from S16/S16b/S16c) with
resolve / dismiss / hide / ban actions.
