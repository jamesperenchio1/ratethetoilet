# Home server

The self-hosted Supabase stack (Postgres + Auth + PostgREST + Storage) that
this app talks to runs on the home server described in [README.md](README.md#backend).

```bash
ssh james@192.168.1.102
```

Stack lives at `/opt/ratethetoilet-supabase/docker` on that host. See
[README.md](README.md#backend) for applying migrations
(`supabase/apply-migrations.sh`) and backups (`supabase/backup.sh`) once
you're on the box.
