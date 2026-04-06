#!/bin/bash
# Nightly SQLite backup — runs inside Fly Machine container
# Add to crontab: 0 3 * * * /app/tools/backup.sh
# Or run via session-monitor as a periodic task.

set -euo pipefail

MC_HOME="${MISSION_CONTROL_HOME:-$HOME/mission-control}"
DB_PATH="${MC_DB_PATH:-$MC_HOME/data/mission-control.db}"
BACKUP_DIR="$MC_HOME/data/backups"
MAX_BACKUPS=7  # Keep 7 days of backups

mkdir -p "$BACKUP_DIR"

DATE=$(date -u +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mission-control-$DATE.db"

echo "[backup] Starting backup: $DB_PATH -> $BACKUP_FILE"

# Use SQLite's online backup API — safe even while the DB is in use
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[backup] Backup complete: $BACKUP_FILE ($SIZE)"
else
  echo "[backup] ERROR: Backup file was not created" >&2
  exit 1
fi

# Rotate old backups — keep only the most recent $MAX_BACKUPS
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/mission-control-*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "$BACKUP_DIR"/mission-control-*.db | tail -n "$REMOVE_COUNT" | while read -r OLD; do
    echo "[backup] Removing old backup: $OLD"
    rm -f "$OLD"
  done
fi

echo "[backup] Done. $BACKUP_COUNT backups retained (max $MAX_BACKUPS)."
