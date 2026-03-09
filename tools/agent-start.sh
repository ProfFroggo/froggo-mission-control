#!/usr/bin/env bash
# (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
# tools/agent-start.sh
# Starts or resumes a Claude Code agent in the appropriate tmux pane.
# Usage: bash tools/agent-start.sh <agent-id>
#
# Checks the sessions table in mission-control.db for an existing session ID.
# If found, resumes with: claude --resume <session-id>
# If not found, starts new session for agent.

set -euo pipefail

AGENT_ID="${1:-}"
if [[ -z "$AGENT_ID" ]]; then
  echo "Usage: $0 <agent-id>" >&2
  exit 1
fi

DB_PATH="${MC_DB_PATH:-$HOME/mission-control/data/mission-control.db}"
SESSION="${TMUX_SESSION:-mission-control}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/git/mission-control-nextjs}"

# Agent → tmux pane mapping
declare -A PANE_MAP
PANE_MAP["mission-control"]="agents.0"
PANE_MAP["main"]="agents.0"
PANE_MAP["coder"]="agents.1"
PANE_MAP["lead_engineer"]="agents.1"
PANE_MAP["clara"]="agents.2"
PANE_MAP["researcher"]="agents.3"
PANE_MAP["writer"]="agents.3"
PANE_MAP["chief"]="agents.3"
PANE_MAP["designer"]="agents.3"
PANE_MAP["hr"]="agents.3"
PANE_MAP["social_media_manager"]="agents.3"
PANE_MAP["growth_director"]="agents.3"
PANE_MAP["voice"]="agents.3"
PANE_MAP["degen-frog"]="agents.3"

PANE="${PANE_MAP[$AGENT_ID]:-agents.3}"

# Look up existing session ID in DB
SESSION_ID=""
if command -v sqlite3 &>/dev/null && [[ -f "$DB_PATH" ]]; then
  SESSION_ID=$(sqlite3 "$DB_PATH" \
    "SELECT sessionId FROM agent_sessions WHERE agentId='$AGENT_ID' AND status='active' ORDER BY createdAt DESC LIMIT 1;" \
    2>/dev/null || true)
fi

if [[ -n "$SESSION_ID" ]]; then
  echo "Resuming agent '$AGENT_ID' session $SESSION_ID in pane $SESSION:$PANE"
  tmux send-keys -t "$SESSION:$PANE" "cd $PROJECT_DIR && claude --resume $SESSION_ID" Enter
else
  echo "Starting new agent '$AGENT_ID' in pane $SESSION:$PANE"
  SOUL_FILE="$PROJECT_DIR/.claude/agents/$AGENT_ID.md"
  if [[ -f "$SOUL_FILE" ]]; then
    tmux send-keys -t "$SESSION:$PANE" "cd $PROJECT_DIR && claude --agent $SOUL_FILE" Enter
  else
    tmux send-keys -t "$SESSION:$PANE" "cd $PROJECT_DIR && claude" Enter
  fi
fi
