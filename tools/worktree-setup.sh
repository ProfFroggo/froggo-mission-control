#!/usr/bin/env bash
# tools/worktree-setup.sh
# Creates git worktrees for code-writing agents (coder, designer, chief).
# Each agent gets an isolated working copy on its own branch.
# Usage: bash tools/worktree-setup.sh

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/git/mission-control-nextjs}"
WORKTREE_BASE="${WORKTREE_BASE:-$HOME/mission-control/worktrees}"

AGENTS=("coder" "designer" "chief")

# Ensure we're in a git repo
cd "$PROJECT_DIR"
if ! git rev-parse --git-dir &>/dev/null; then
  echo "Error: Not a git repository: $PROJECT_DIR" >&2
  exit 1
fi

mkdir -p "$WORKTREE_BASE"

for AGENT in "${AGENTS[@]}"; do
  BRANCH="agent/${AGENT}"
  WORKTREE_PATH="${WORKTREE_BASE}/${AGENT}"

  # Skip if worktree already exists
  if [[ -d "$WORKTREE_PATH" ]]; then
    echo "Worktree for '${AGENT}' already exists at ${WORKTREE_PATH}"
    continue
  fi

  # Create branch if it doesn't exist
  if ! git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    git branch "${BRANCH}" HEAD
    echo "Created branch: ${BRANCH}"
  fi

  # Create worktree
  git worktree add "$WORKTREE_PATH" "$BRANCH"
  echo "Created worktree: ${WORKTREE_PATH} (branch: ${BRANCH})"
done

echo ""
echo "Worktrees:"
git worktree list
echo ""
echo "Agents can now work in isolated copies:"
for AGENT in "${AGENTS[@]}"; do
  echo "  ${AGENT}: ${WORKTREE_BASE}/${AGENT}"
done
