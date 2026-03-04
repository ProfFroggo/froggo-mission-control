# Summary 11-01: Cron Daemon + Cron Setup Script

## What was done
- Created tools/cron-daemon.js — reads ~/froggo/data/schedule.json every 60s, executes due jobs
- Created tools/cron-setup.sh — installs 6 crontab entries: morning triage, stale task check, auto-approve, weekly planning, QMD update, QMD embed

## Files
- tools/cron-daemon.js
- tools/cron-setup.sh

## Commit
feat(11-01): create cron daemon + cron-setup.sh with 6 scheduled jobs
