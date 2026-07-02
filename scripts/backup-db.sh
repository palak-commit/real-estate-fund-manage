#!/usr/bin/env bash
#
# Fund Manager — MySQL database backup.
# The whole app state lives in one MySQL database, so a single logical dump is a complete
# backup. Run this on a schedule (monthly by default — see docs/OPERATIONS.md) or on demand.
#
#   ./scripts/backup-db.sh            # dump using .env.local, write to ./backups
#   BACKUP_DIR=/mnt/nas ./scripts/backup-db.sh   # override output dir
#   BACKUP_RETAIN=24 ./scripts/backup-db.sh      # keep the newest 24 dumps
#
# Reads DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME from .env.local (same as the app).
# Output: backups/<db>_<YYYY-MM-DD_HHMMSS>.sql.gz  (gzipped, InnoDB-consistent).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.local}"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETAIN="${BACKUP_RETAIN:-12}"   # keep the newest N dumps (12 ≈ one year of monthly backups)

[ -f "$ENV_FILE" ] || { echo "❌ env file not found: $ENV_FILE" >&2; exit 1; }
command -v mysqldump >/dev/null || { echo "❌ mysqldump not found on PATH" >&2; exit 1; }

# Read a single KEY=value from the env file, trimming quotes and CRs — no code execution.
env_val() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" -e 's/\r$//'
}

DB_HOST="$(env_val DB_HOST)";     DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(env_val DB_PORT)";     DB_PORT="${DB_PORT:-3306}"
DB_USER="$(env_val DB_USER)";     DB_USER="${DB_USER:-root}"
DB_PASSWORD="$(env_val DB_PASSWORD)"
DB_NAME="$(env_val DB_NAME)";     DB_NAME="${DB_NAME:-real_estate_money}"

# Pass credentials via a temp defaults-file so the password never appears in `ps` / logs.
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
cat > "$CNF" <<EOF
[client]
host=$DB_HOST
port=$DB_PORT
user=$DB_USER
password=$DB_PASSWORD
EOF

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
FILE="$OUT_DIR/${DB_NAME}_${STAMP}.sql.gz"

echo "→ Backing up '$DB_NAME' from ${DB_HOST}:${DB_PORT} …"
# Note: --routines/--events are intentionally omitted — the app uses no stored routines or
# scheduled events (all logic is application-level), and both trip warnings on this MariaDB
# server. --single-transaction gives an InnoDB-consistent snapshot without locking writes.
mysqldump --defaults-extra-file="$CNF" \
  --single-transaction --quick --triggers \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -c > "$FILE"

# Fail loudly if the dump is suspiciously tiny (e.g. auth/host error slipped through).
BYTES="$(wc -c < "$FILE")"
if [ "$BYTES" -lt 500 ]; then
  echo "❌ Backup looks empty (${BYTES} bytes) — check credentials/host. Removing." >&2
  rm -f "$FILE"; exit 1
fi

echo "✓ Saved $FILE ($(du -h "$FILE" | cut -f1))"

# Retention: keep the newest $RETAIN dumps for this DB, delete older ones.
mapfile -t OLD < <(ls -1t "$OUT_DIR/${DB_NAME}_"*.sql.gz 2>/dev/null | tail -n +"$((RETAIN + 1))")
for f in "${OLD[@]:-}"; do
  [ -n "$f" ] || continue
  echo "  pruning old backup: $(basename "$f")"
  rm -f "$f"
done

echo "✓ Done. Keeping newest $RETAIN backup(s) in $OUT_DIR"
