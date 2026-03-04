#!/bin/bash
# Add QMD freshness cron jobs
# Run once to register cron entries

CRON_JOBS='# Froggo QMD freshness (added by qmd-cron.sh)
0 * * * * qmd update >> ~/froggo/logs/qmd.log 2>&1
0 3 * * * qmd embed >> ~/froggo/logs/qmd.log 2>&1'

# Backup current crontab
crontab -l > /tmp/froggo-cron-backup.txt 2>/dev/null || true

# Add jobs if not already present
if crontab -l 2>/dev/null | grep -q "Froggo QMD"; then
  echo "QMD cron jobs already installed."
else
  (crontab -l 2>/dev/null; echo "$CRON_JOBS") | crontab -
  echo "QMD cron jobs installed."
fi
