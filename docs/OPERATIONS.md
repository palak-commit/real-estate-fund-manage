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

The entire app state lives in one MySQL database. **Back it up on a schedule.**

```bash
# Nightly logical backup (cron, e.g. 0 2 * * *)
mysqldump --single-transaction --routines \
  -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" \
  "${DB_NAME:-real_estate_money}" | gzip > "backup-$(date +\%F).sql.gz"
```

Keep at least 7 daily + 4 weekly copies **off the app server**. Test a restore at least once:

```bash
gunzip < backup-YYYY-MM-DD.sql.gz | \
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "${DB_NAME:-real_estate_money}"
```

The schema auto-creates/migrates on first request (`lib/db.ts`), so restoring data into a fresh DB is enough — no manual DDL needed.

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
