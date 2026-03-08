#!/bin/bash
# QMD setup script for Mission Control memory system
# Run once to initialize QMD with the Mission Control vault

set -e

VAULT_PATH="${VAULT_PATH:-$HOME/mission-control/memory}"

echo "Setting up QMD for Mission Control memory vault at $VAULT_PATH..."

# Install QMD (requires bun)
if ! command -v qmd &> /dev/null; then
  echo "Installing QMD..."
  bun install -g https://github.com/tobi/qmd
fi

# Add collections
qmd collection add "$VAULT_PATH/agents" --name agent-memory
qmd collection add "$VAULT_PATH/sessions" --name sessions
qmd collection add "$VAULT_PATH/knowledge" --name knowledge
qmd collection add "$VAULT_PATH/daily" --name daily
qmd collection add "$VAULT_PATH/projects" --name projects

# Generate embeddings (takes 5-10 min on first run)
echo "Generating embeddings (this may take a few minutes)..."
qmd embed

echo "QMD setup complete. Test with: qmd search 'task lifecycle'"
