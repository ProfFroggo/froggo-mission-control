#!/bin/bash
# Test the hook pipeline exactly as Claude Code would run it
TOOL='{"tool_name":"mcp__mission-control-db__task_add_activity","tool_input":{"taskId":"task-1773524459577-twssq2","agentId":"coder","action":"started","message":"test"}}'

echo "=== Project hook (uses /usr/local/bin/node) ==="
echo "$TOOL" | /usr/local/bin/node /Users/kevin.macarthur/git/froggo-mission-control/tools/hooks/approval-hook.js

echo "=== Global hook (uses /opt/homebrew/bin/node) ==="
echo "$TOOL" | /opt/homebrew/bin/node /Users/kevin.macarthur/.npm-global/lib/node_modules/froggo-mission-control/tools/hooks/approval-hook.js
