#!/bin/bash
# Install Mission Control cron jobs
# Run once to register all automated schedules

MC_DIR="${MC_DIR:-$HOME/git/mission-control-nextjs}"
LOG_DIR="${LOG_DIR:-$HOME/mission-control/logs}"

CRON_JOBS="# Mission Control Automation (installed by cron-setup.sh)
# Morning triage (8am daily)
0 8 * * * cd $MC_DIR && claude --print --model sonnet --agents mission-control \"Check inbox for new messages. Triage by priority. Create tasks for anything actionable.\" >> $LOG_DIR/cron.log 2>&1
# Stale task check (hourly)
0 * * * * cd $MC_DIR && claude --print --model haiku \"Check task board for tasks stuck in in-progress for more than 4 hours. Post a status check comment on each one.\" >> $LOG_DIR/cron.log 2>&1
# Auto-approve low-risk (every 15 min)
*/15 * * * * cd $MC_DIR && claude --print --model haiku \"Check approvals table. Auto-approve any tier 0 or tier 1 approvals that have been pending more than 5 minutes.\" >> $LOG_DIR/cron.log 2>&1
# Weekly planning (Monday 9am)
0 9 * * 1 cd $MC_DIR && claude --print --model opus --agents mission-control \"Run weekly planning. Review last week completed tasks, identify blockers, prioritize this week backlog. Post summary to #planning chat room.\" >> $LOG_DIR/cron.log 2>&1
# Session sync + QMD update (nightly 2am)
0 2 * * * cd $MC_DIR && qmd update >> $LOG_DIR/cron.log 2>&1
# QMD embedding refresh (nightly 3am)
0 3 * * * qmd embed >> $LOG_DIR/cron.log 2>&1"

if crontab -l 2>/dev/null | grep -q "Mission Control Automation"; then
  echo "Mission Control cron jobs already installed."
else
  (crontab -l 2>/dev/null; echo "$CRON_JOBS") | crontab -
  echo "Mission Control cron jobs installed. View with: crontab -l"
fi
