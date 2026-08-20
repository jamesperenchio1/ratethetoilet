#!/usr/bin/env bash
# Dumps the self-hosted Postgres DB to a timestamped, gzipped file and prunes
# old backups. Meant to run on the home server (via cron) since it talks to
# the DB container directly — the whole app's data (toilets, reviews,
# profiles, everything except the actual photo bytes in Storage) lives in
# this one database, so this is the difference between a bad migration/disk
# failure being a bad afternoon vs. losing everything.
#
# Usage:
#   ./supabase/backup.sh                 # backs up to ./backups
#   BACKUP_DIR=/mnt/nas/ratethetoilet ./supabase/backup.sh
#
# Suggested cron (daily at 3am, keep 14 days):
#   0 3 * * * BACKUP_KEEP_DAYS=14 /path/to/repo/supabase/backup.sh >> /var/log/ratethetoilet-backup.log 2>&1
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/ratethetoilet-$stamp.sql.gz"

echo "backing up $DB_NAME from $CONTAINER -> $out"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$out"
echo "wrote $(du -h "$out" | cut -f1)"

find "$BACKUP_DIR" -name 'ratethetoilet-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete
