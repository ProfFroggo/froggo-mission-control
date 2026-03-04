#!/bin/bash
# Install Froggo cron jobs
# Run once to register all automated schedules

FROGGO_DIR="${FROGGO_DIR:-$HOME/git/froggo-nextjs}"

CRON_JOBS="# Froggo Automation (installed by cron-setup.sh)
# Morning triage (8am daily)
0 8 * * * cd $FROGGO_DIR && claude --print --model sonnet --agents froggo \"Check inbox for new messages. Triage by priority. Create tasks for anything actionable.\" >> ~/froggo/logs/cron.log 2>&1
# Stale task check (hourly)
0 * * * * cd $FROGGO_DIR && claude --print --model haiku \"Check task board for tasks stuck in in-progress for more than 4 hours. Post a status check comment on each one.\" >> ~/froggo/logs/cron.log 2>&1
# Auto-approve low-risk (every 15 min)
*/15 * * * * cd $FROGGO_DIR && claude --print --model haiku \"Check approvals table. Auto-approve any tier 0 or tier 1 approvals that have been pending more than 5 minutes.\" >> ~/froggo/logs/cron.log 2>&1
# Weekly planning (Monday 9am)
0 9 * * 1 cd $FROGGO_DIR && claude --print --model opus --agents froggo \"Run weekly planning. Review last week completed tasks, identify blockers, prioritize this week backlog. Post summary to #planning chat room.\" >> ~/froggo/logs/cron.log 2>&1
# Session sync + QMD update (nightly 2am)
0 2 * * * cd $FROGGO_DIR && qmd update >> ~/froggo/logs/cron.log 2>&1
# QMD embedding refresh (nightly 3am)
0 3 * * * qmd embed >> ~/froggo/logs/cron.log 2>&1"

if crontab -l 2>/dev/null | grep -q "Froggo Automation"; then
  echo "Froggo cron jobs already installed."
else
  (crontab -l 2>/dev/null; echo "$CRON_JOBS") | crontab -
  echo "Froggo cron jobs installed. View with: crontab -l"
fi
