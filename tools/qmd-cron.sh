#!/bin/bash
# Add QMD freshness cron jobs
# Run once to register cron entries

CRON_JOBS='# Mission Control QMD freshness (added by qmd-cron.sh)
0 * * * * qmd update >> ~/mission-control/logs/qmd.log 2>&1
0 3 * * * qmd embed >> ~/mission-control/logs/qmd.log 2>&1'

# Backup current crontab
crontab -l > /tmp/mission-control-cron-backup.txt 2>/dev/null || true

# Add jobs if not already present
if crontab -l 2>/dev/null | grep -q "Mission Control QMD"; then
  echo "QMD cron jobs already installed."
else
  (crontab -l 2>/dev/null; echo "$CRON_JOBS") | crontab -
  echo "QMD cron jobs installed."
fi
