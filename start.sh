#!/usr/bin/env bash
# (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
# start.sh — Launch Mission Control platform
# Usage: bash start.sh
# Or double-click in Finder (requires: chmod +x start.sh, then right-click > Open)

set -uo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

echo ""
echo "🚀 Mission Control — Starting platform..."
echo ""

# ── 1. Tmux session ─────────────────────────────────────────────────────────
if tmux has-session -t mission-control 2>/dev/null; then
  echo "  ✓ tmux: session 'mission-control' already running"
else
  echo "  → tmux: creating session..."
  bash "$REPO/tools/tmux-setup.sh" > /dev/null 2>&1
  echo "  ✓ tmux: session created (attach with: tmux attach -t mission-control)"
fi

# ── 2. Worktrees ─────────────────────────────────────────────────────────────
WORKTREE_BASE="$HOME/mission-control/worktrees"
if [[ -d "$WORKTREE_BASE/coder" ]] && [[ -d "$WORKTREE_BASE/designer" ]] && [[ -d "$WORKTREE_BASE/chief" ]]; then
  echo "  ✓ worktrees: already initialized"
else
  echo "  → worktrees: initializing agent branches..."
  bash "$REPO/tools/worktree-setup.sh" > /dev/null 2>&1
  echo "  ✓ worktrees: coder / designer / chief ready"
fi

# ── 3. Voice bridge ──────────────────────────────────────────────────────────
VOICE_PORT="${VOICE_BRIDGE_PORT:-8765}"
if lsof -ti :"$VOICE_PORT" > /dev/null 2>&1; then
  echo "  ✓ voice bridge: already running on port $VOICE_PORT"
else
  echo "  → voice bridge: building + starting..."
  VOICE_DIR="$REPO/tools/voice-bridge"
  # Install deps if needed
  if [[ ! -d "$VOICE_DIR/node_modules" ]]; then
    (cd "$VOICE_DIR" && npm install --silent)
  fi
  # Build if dist is missing or stale
  if [[ ! -f "$VOICE_DIR/dist/index.js" ]]; then
    (cd "$VOICE_DIR" && npm run build --silent)
  fi
  # Start in background, log to mission-control/logs/
  mkdir -p "$HOME/mission-control/logs"
  nohup node "$VOICE_DIR/dist/index.js" > "$HOME/mission-control/logs/voice-bridge.log" 2>&1 &
  echo "  ✓ voice bridge: started on ws://localhost:$VOICE_PORT (log: ~/mission-control/logs/voice-bridge.log)"
fi

# ── 4. Next.js dev server ────────────────────────────────────────────────────
if lsof -ti :"$PORT" > /dev/null 2>&1; then
  echo "  ✓ next.js: already running on port $PORT"
else
  echo "  → next.js: starting dev server..."
  mkdir -p "$HOME/mission-control/logs"
  nohup bash -c "cd '$REPO' && npm run dev" > "$HOME/mission-control/logs/nextjs.log" 2>&1 &
  NEXT_PID=$!
  echo "  ✓ next.js: starting (pid $NEXT_PID, log: ~/mission-control/logs/nextjs.log)"
  # Wait up to 15s for Next.js to be ready
  echo "  → waiting for http://localhost:$PORT..."
  for i in $(seq 1 15); do
    sleep 1
    if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
      echo "  ✓ next.js: ready"
      break
    fi
    if [[ $i -eq 15 ]]; then
      echo "  ⚠ next.js: taking longer than expected — check ~/mission-control/logs/nextjs.log"
    fi
  done
fi

# ── 5. Open browser ──────────────────────────────────────────────────────────
echo ""
echo "  Opening http://localhost:$PORT in browser..."
open "http://localhost:$PORT"

echo ""
echo "  Mission Control is running."
echo "  Dashboard:    http://localhost:$PORT"
echo "  Voice bridge: ws://localhost:$VOICE_PORT"
echo "  Agent panes:  tmux attach -t mission-control"
echo ""
