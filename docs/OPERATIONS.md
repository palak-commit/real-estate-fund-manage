# Operations & Launch Runbook

Practical ops notes for running this single-admin app in production. Keep it short and current.

## Environment variables (all required in production)

| Var | Purpose | Notes |
|-----|---------|-------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL connection | `DB_NAME` defaults to `real_estate_money` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | The single admin login | **No defaults** — login is refused (HTTP 500 "auth not configured") if either is unset |
| `AUTH_SECRET` | HMAC key signing the session cookie | Use a long random string. In production the app throws if it's missing. **Rotating it logs everyone out** (the simplest "revoke all sessions"). |

`DB_POOL_LIMIT` (optional) caps connections per instance (default 5).

## Auth model (what to know)

- One admin; credentials come from env, compared in constant time.
- The session cookie is a signed, **expiring** token (`issuedAt.nonce.hmac`), valid for **7 days** (`SESSION_TTL_SECONDS` in `lib/auth.ts`). After that it's rejected and the user must log in again.
- Login is **rate-limited**: 5 failed attempts per IP → 15-minute lockout (in-memory, per instance).
- There is no server-side session store, so an already-issued token can't be individually revoked before expiry — rotate `AUTH_SECRET` to invalidate **all** sessions at once.

## Database backups (do this before launch)

The entire app state lives in one MySQL database, so a single logical dump is a **complete**
backup. Use the bundled script — it reads `DB_*` from `.env.local`, writes a gzipped,
InnoDB-consistent dump to `backups/`, and prunes old copies.

```bash
npm run db:backup            # → backups/real_estate_money_<date>.sql.gz
# or directly, with overrides:
BACKUP_DIR=/mnt/nas BACKUP_RETAIN=24 ./scripts/backup-db.sh
```

`backups/` is git-ignored (it contains real data — never commit it).

### Monthly schedule (the plan)

Run it **monthly** via cron — 02:00 on the 1st of each month:

```cron
# crontab -e   (as the deploy user)
0 2 1 * * cd /path/to/real-estate-money-manage && /usr/bin/npm run db:backup >> /var/log/fund-backup.log 2>&1
```

- **Retention:** the script keeps the newest **12** dumps by default (≈ one year of monthly
  backups); override with `BACKUP_RETAIN`. On a shared money system, monthly is the floor —
  step up to weekly (`0 2 * * 1`) or nightly (`0 2 * * *`) if data changes daily; the same
  script works at any cadence.
- **Off-site copy (important):** a backup on the same machine as the DB protects against
  *mistakes*, not *disk loss*. Sync `backups/` to separate storage (object store / NAS / another
  host) — e.g. add `&& rclone copy backups remote:fund-backups` to the cron line, or point
  `BACKUP_DIR` at a mounted off-site volume.
- **Managed MySQL?** If the DB is on a managed provider (PlanetScale, RDS, etc.), enable its
  automated snapshots **as well** — treat this script as a portable, provider-independent copy.

### Restore

```bash
gunzip -c backups/real_estate_money_<date>.sql.gz \
  | mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p "${DB_NAME:-real_estate_money}"
```

The schema auto-creates/migrates on first request (`lib/db.ts`), so restoring data into a fresh
empty DB is enough — no manual DDL needed. **Test a restore at least once** (into a scratch DB)
so you know the process works *before* you need it — an untested backup is not a backup.

## Money integrity

- `lib/ledger.ts` `accountEffects` is the single source of truth for balance movement; `recomputeBalances(true)` replays the whole ledger to fix any drift (exposed as **Recheck balances** on the Accounts page).
- RA receipt payments are guarded **server-side** against over-payment (can't exceed the receipt's persisted Net Receivable snapshot).
- After any suspected drift, run **Recheck balances**.

## Pre-launch checklist

- [ ] `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET` set to strong values
- [ ] HTTPS enforced (cookie is `Secure` only in production)
- [ ] Nightly DB backup configured **and a restore tested**
- [ ] `npm run typecheck && npm test` green (also runs in CI)
- [ ] Error monitoring wired (e.g. Sentry) — not included by default

## Verify before each deploy

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run (ledger + RA math)
npm run build       # production build
```
