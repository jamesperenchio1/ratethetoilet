#!/usr/bin/env bash
# Applies every migration in supabase/migrations/ that hasn't been applied yet,
# tracked in a `_migrations` table on the DB itself — so re-running this is
# always safe and "which migrations are live" stops depending on memory.
#
# Run from the home server, in this repo's checkout:
#   ./supabase/apply-migrations.sh
#
# Needs PGPASSWORD (or a ~/.pgpass entry) for the postgres role, since most
# migrations run as `postgres`. A couple (noted in their own header comment)
# need supabase_admin instead — set SUPABASE_DB_USER=supabase_admin to run
# with that role. This script stops at the first failing migration rather
# than guessing at privilege escalation or skipping ahead out of order.
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/migrations" && pwd)"

psql_exec() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

psql_exec -c "
  create table if not exists public._migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
"

applied="$(psql_exec -tAc "select filename from public._migrations")"

for file in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$file")"
  if grep -qx "$name" <<<"$applied"; then
    echo "skip   $name (already applied)"
    continue
  fi
  echo "apply  $name"
  if psql_exec < "$file"; then
    psql_exec -c "insert into public._migrations (filename) values ('$name');"
  else
    echo "FAILED $name — stopping. Fix the error above, then re-run this script." >&2
    exit 1
  fi
done

echo "done."
