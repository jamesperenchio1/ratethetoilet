# AGENTS.md

Single-page React 19 + Vite + TypeScript PWA (toilet finder, Bangkok). All backend logic is Supabase (Postgres + RLS + Auth) — there is no server code in this repo.

## Commands

- `npm run dev` — dev server (requires `.env.local`, see below)
- `npm run lint` — **oxlint**, not eslint (config: `.oxlintrc.json`)
- `npm run build` — `tsc -b && vite build`. This is the typecheck; there is no separate typecheck script.
- `npm test` — **vitest**, unit tests for pure `src/lib/*` logic only (no component/integration tests). Run `npm run lint && npm test && npm run build` as the verification step.

## Environment

`.env.local` must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). The Supabase client in `src/lib/supabase.ts` throws at import time if either is missing, so nothing runs without them. Values point at the self-hosted instance at `ratethetoilet-api.gingerbrosshop.com`.

## Repo quirks that will bite you

- **`.claude/worktrees/` contains a full worktree copy of this repo including `node_modules`.** Exclude it from every glob/grep or you'll get duplicate hits and edit the wrong copy. Real code lives only in `src/`.
- **TypeScript is strict in unusual ways** (`tsconfig.app.json`): `verbatimModuleSyntax` (type-only imports must use `import type`), `erasableSyntaxOnly` (no enums, no constructor parameter properties), `noUnusedLocals`/`noUnusedParameters`.
- **MapLibre worker files are special-cased.** A custom plugin in `vite.config.ts` copies `maplibre-gl-worker.mjs` + `maplibre-gl-shared.mjs` verbatim to `/maplibre-assets/` because the worker hardcodes its sibling import by exact filename. Do not let Vite hash/bundle these or route them through `?url` imports — the map breaks only in production. `MapView.tsx`'s `setWorkerUrl()` points at the fixed `/maplibre-assets/` path.
- **Service worker registration is manual** (`src/registerSW.ts`, `injectRegister: false` in vite config): it polls `registration.update()` every 60s and reloads on `controllerchange` so deploys reach open tabs. Don't switch back to the auto-injected register.

## Architecture

- Routes in `src/routes/` (flat page components, `add/` = multi-step toilet wizard, `admin/` = moderation queue); wiring in `src/App.tsx` (react-router).
- All data access goes through `src/lib/api.ts` on top of `src/lib/supabase.ts`. Business rules (rate limits, admin checks, moderation) live in Postgres RLS/triggers, not the frontend — see `supabase/migrations/`.
- Identity model: no accounts. Supabase **anonymous auth** + auto-generated display handles (`src/lib/useAuth.ts`); email is only ever a magic link to reattach a device to an existing id. Admin access is a manual `is_admin = true` flip on the `profiles` row in the DB — there is no admin signup flow.

## Backend / migrations

Self-hosted Supabase runs in Docker on a home server (out of repo). Only the SQL is versioned here, in `supabase/migrations/`. Apply on the server with:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/NNNN_name.sql
```

Numbered migrations build on each other (0002 redefines functions from 0001); apply in order.

**Ownership gotcha:** `postgres` in the container is *not* a superuser, and some functions are owned by `supabase_admin` (the actual superuser, password in the container's `POSTGRES_PASSWORD` env). Applying a `create or replace function` for one of those as `postgres` fails with "must be owner of function" — `alter function ... owner` and `set role` fail the same way. For such functions, pipe the SQL in as `supabase_admin` instead (password comes from the container env, never the command line):

```bash
ssh james@192.168.1.102 "docker exec -i supabase-db sh -c 'PGPASSWORD=\$POSTGRES_PASSWORD psql -U supabase_admin -d postgres'" < <(tail -n +16 supabase/migrations/0008_location_address.sql)
```

(0008 hit this: its `alter table` half applies fine as `postgres`, but its `update_own_toilet` rewrite had to go in as `supabase_admin`.)

## Deploy

Vercel auto-deploys `main` (`.vercel/` is gitignored, `dist/` is a local build artifact). Commits to `main` ship immediately.
