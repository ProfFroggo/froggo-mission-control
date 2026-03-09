#!/usr/bin/env bash
# (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
# tools/tmux-setup.sh
# Creates the 'mission-control' tmux session with per-agent panes.
# Usage: bash tools/tmux-setup.sh

set -euo pipefail

SESSION="${TMUX_SESSION:-mission-control}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/git/mission-control-nextjs}"

# Don't recreate if already running
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists. Attach with: tmux attach -t $SESSION"
  exit 0
fi

echo "Creating tmux session: $SESSION"

# Window 0: Persistent agents (panes per agent)
tmux new-session -d -s "$SESSION" -n agents -x 220 -y 50

# Pane 0.0 — mission-control (lead orchestrator)
tmux send-keys -t "$SESSION:agents.0" "cd $PROJECT_DIR && echo 'Pane: mission-control'" Enter

# Pane 0.1 — coder
tmux split-window -t "$SESSION:agents" -h
tmux send-keys -t "$SESSION:agents.1" "cd $PROJECT_DIR && echo 'Pane: coder'" Enter

# Pane 0.2 — clara (reviewer)
tmux split-window -t "$SESSION:agents" -v
tmux send-keys -t "$SESSION:agents.2" "cd $PROJECT_DIR && echo 'Pane: clara'" Enter

# Pane 0.3 — on-demand / general purpose
tmux split-window -t "$SESSION:agents.0" -v
tmux send-keys -t "$SESSION:agents.3" "cd $PROJECT_DIR && echo 'Pane: on-demand'" Enter

# Window 1: Log monitoring
tmux new-window -t "$SESSION" -n logs
tmux send-keys -t "$SESSION:logs" "tail -f ${LOG_DIR:-$HOME/mission-control/logs}/*.log 2>/dev/null || echo 'No logs yet'" Enter

# Window 2: Next.js dev server
tmux new-window -t "$SESSION" -n nextjs
tmux send-keys -t "$SESSION:nextjs" "cd $PROJECT_DIR && npm run dev" Enter

# Back to agents window
tmux select-window -t "$SESSION:agents"

echo "Session '$SESSION' created."
echo "Attach with: tmux attach -t $SESSION"
echo ""
echo "Pane layout:"
echo "  agents.0 — mission-control"
echo "  agents.1 — coder"
echo "  agents.2 — clara"
echo "  agents.3 — on-demand"
echo "  logs      — log tail"
echo "  nextjs    — npm run dev"
