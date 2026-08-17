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
`supabase/migrations/0001_init.sql` — apply it with:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/0001_init.sql
```

## Admin / moderation

There's no separate admin signup flow. Sign in for real (your own email,
through the normal "Keep this name" flow, not the anonymous guest path) once,
then flip `is_admin = true` on your `profiles` row directly in the database.
The `/admin` route then shows the report queue (from S16/S16b/S16c) with
resolve / dismiss / hide / ban actions.
