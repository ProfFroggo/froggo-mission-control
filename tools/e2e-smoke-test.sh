#!/usr/bin/env bash
# tools/e2e-smoke-test.sh
# Mission Control v2.0 E2E smoke test — verifies all Froggo Platform deliverables.
# Exit 0 = all checks pass. Exit 1 = one or more checks failed.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
ERRORS=()

check() {
  local label="$1"
  local result="$2"  # "ok" or error message
  if [[ "$result" == "ok" ]]; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label — $result"
    ERRORS+=("$label: $result")
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "═══════════════════════════════════════════"
echo "  Mission Control v2.0 E2E Smoke Test"
echo "═══════════════════════════════════════════"
echo ""

# ── Phase 15: Env & Config ──────────────────────────────────────────────────
echo "Phase 15: Env & Config"

[[ -f "$REPO/.env" ]] && check ".env exists" "ok" || check ".env exists" "file not found"

for var in MC_DB_PATH VAULT_PATH LIBRARY_PATH PROJECT_DIR LOG_DIR QMD_BIN MODEL_LEAD MODEL_WORKER MODEL_TRIVIAL TMUX_SESSION; do
  grep -q "^${var}=" "$REPO/.env" 2>/dev/null \
    && check ".env: $var set" "ok" \
    || check ".env: $var set" "missing from .env"
done

grep -q "export const ENV" "$REPO/src/lib/env.ts" 2>/dev/null \
  && check "src/lib/env.ts: ENV exported" "ok" \
  || check "src/lib/env.ts: ENV exported" "not found"

grep -q "ENV.DB_PATH" "$REPO/src/lib/database.ts" 2>/dev/null \
  && check "database.ts uses ENV.DB_PATH" "ok" \
  || check "database.ts uses ENV.DB_PATH" "direct process.env still in use"

! grep -q "process.env.MC_DB_PATH" "$REPO/src/lib/database.ts" 2>/dev/null \
  && check "database.ts: no direct process.env.MC_DB_PATH" "ok" \
  || check "database.ts: no direct process.env.MC_DB_PATH" "still present"

[[ -f "$REPO/COST_STRATEGY.md" ]] \
  && check "COST_STRATEGY.md exists" "ok" \
  || check "COST_STRATEGY.md exists" "file not found"

echo ""

# ── Phase 16: Tmux Orchestration ───────────────────────────────────────────
echo "Phase 16: Tmux Orchestration"

[[ -f "$REPO/tools/tmux-setup.sh" ]] \
  && check "tools/tmux-setup.sh exists" "ok" \
  || check "tools/tmux-setup.sh exists" "file not found"

[[ -f "$REPO/tools/agent-start.sh" ]] \
  && check "tools/agent-start.sh exists" "ok" \
  || check "tools/agent-start.sh exists" "file not found"

grep -q "mission-control" "$REPO/tools/tmux-setup.sh" 2>/dev/null \
  && check "tmux-setup.sh: mission-control session name" "ok" \
  || check "tmux-setup.sh: mission-control session name" "session name not found"

grep -q "claude --resume" "$REPO/tools/agent-start.sh" 2>/dev/null \
  && check "agent-start.sh: claude --resume for existing sessions" "ok" \
  || check "agent-start.sh: claude --resume for existing sessions" "not found"

grep -q "agent-start.sh" "$REPO/app/api/agents/"*"/spawn/route.ts" 2>/dev/null \
  && check "spawn API: calls agent-start.sh" "ok" \
  || check "spawn API: calls agent-start.sh" "not wired"

echo ""

# ── Phase 17: Enhanced Memory MCP ──────────────────────────────────────────
echo "Phase 17: Enhanced Memory MCP"

[[ -f "$REPO/tools/memory-mcp/src/index.ts" ]] \
  && check "memory-mcp/src/index.ts exists" "ok" \
  || check "memory-mcp/src/index.ts exists" "file not found"

for tool in memory_search memory_recall memory_write memory_read; do
  grep -q "$tool" "$REPO/tools/memory-mcp/src/index.ts" 2>/dev/null \
    && check "memory MCP: $tool defined" "ok" \
    || check "memory MCP: $tool defined" "tool not found in index.ts"
done

grep -q "VAULT_PATH" "$REPO/tools/hooks/session-sync.js" 2>/dev/null \
  && check "session-sync.js: writes to VAULT_PATH" "ok" \
  || check "session-sync.js: writes to VAULT_PATH" "VAULT_PATH not referenced"

echo ""

# ── Phase 18: Approval Rules + Worktrees ───────────────────────────────────
echo "Phase 18: Approval Rules + Worktrees"

[[ -f "$REPO/APPROVAL_RULES.md" ]] \
  && check "APPROVAL_RULES.md exists" "ok" \
  || check "APPROVAL_RULES.md exists" "file not found"

for tier in "Tier 0" "Tier 1" "Tier 2" "Tier 3"; do
  grep -q "$tier" "$REPO/APPROVAL_RULES.md" 2>/dev/null \
    && check "APPROVAL_RULES.md: $tier defined" "ok" \
    || check "APPROVAL_RULES.md: $tier defined" "tier not found"
done

[[ -f "$REPO/tools/worktree-setup.sh" ]] \
  && check "tools/worktree-setup.sh exists" "ok" \
  || check "tools/worktree-setup.sh exists" "file not found"

grep -q "mission-control-worktrees" "$REPO/tools/worktree-setup.sh" 2>/dev/null \
  && check "worktree-setup.sh: uses ~/mission-control-worktrees" "ok" \
  || check "worktree-setup.sh: uses ~/mission-control-worktrees" "path not found"

echo ""

# ── Phase 19: Per-Agent Capability Configs ─────────────────────────────────
echo "Phase 19: Per-Agent Configs"

AGENT_COUNT=$(ls "$REPO/.claude/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
[[ "$AGENT_COUNT" -ge 13 ]] \
  && check ".claude/agents: ≥13 agents present ($AGENT_COUNT)" "ok" \
  || check ".claude/agents: ≥13 agents present" "only $AGENT_COUNT found"

for agent in mission-control coder chief clara designer researcher; do
  grep -q "maxTurns" "$REPO/.claude/agents/${agent}.md" 2>/dev/null \
    && check "agent $agent: maxTurns set" "ok" \
    || check "agent $agent: maxTurns set" "missing"
done

grep -q "worktreePath" "$REPO/.claude/agents/coder.md" 2>/dev/null \
  && check "coder.md: worktreePath set" "ok" \
  || check "coder.md: worktreePath set" "missing"

grep -q "mcpServers" "$REPO/.claude/settings.json" 2>/dev/null \
  && check "settings.json: mcpServers configured" "ok" \
  || check "settings.json: mcpServers configured" "missing"

grep -q "mission-control_db" "$REPO/.claude/settings.json" 2>/dev/null \
  && check "settings.json: mission-control_db server defined" "ok" \
  || check "settings.json: mission-control_db server defined" "missing"

echo ""

# ── Phase 20: Skill Enrichment ─────────────────────────────────────────────
echo "Phase 20: Skill Enrichment"

for skill in agent-routing code-review-checklist froggo-coding-standards froggo-testing-patterns security-checklist task-decomposition x-twitter-strategy nextjs-patterns git-workflow; do
  [[ -f "$REPO/.claude/skills/$skill/SKILL.md" ]] \
    && check "skill: $skill" "ok" \
    || check "skill: $skill" "SKILL.md not found"
done

grep -q "Skills" "$REPO/.claude/CLAUDE.md" 2>/dev/null \
  && check "CLAUDE.md: Skills section present" "ok" \
  || check "CLAUDE.md: Skills section present" "missing"

echo ""

# ── Phase 21: Voice Bridge ─────────────────────────────────────────────────
echo "Phase 21: Voice Bridge"

for f in package.json tsconfig.json src/index.ts src/personality.ts src/tools.ts; do
  [[ -f "$REPO/tools/voice-bridge/$f" ]] \
    && check "voice-bridge/$f" "ok" \
    || check "voice-bridge/$f" "not found"
done

grep -q "gemini-2.5-flash-native-audio-preview" "$REPO/tools/voice-bridge/src/index.ts" 2>/dev/null \
  && check "voice-bridge: correct Gemini model" "ok" \
  || check "voice-bridge: correct Gemini model" "model string not found"

grep -q "switch_agent" "$REPO/tools/voice-bridge/src/tools.ts" 2>/dev/null \
  && check "voice-bridge: switch_agent function" "ok" \
  || check "voice-bridge: switch_agent function" "not found"

[[ -f "$REPO/app/api/voice/status/route.ts" ]] \
  && check "/api/voice/status route exists" "ok" \
  || check "/api/voice/status route exists" "not found"

echo ""

# ── TypeScript + Build ─────────────────────────────────────────────────────
echo "Build Verification"

if cd "$REPO" && npx tsc --noEmit > /dev/null 2>&1; then
  check "npx tsc --noEmit: 0 errors" "ok"
else
  check "npx tsc --noEmit: 0 errors" "TypeScript errors found"
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "═══════════════════════════════════════════"
echo ""

if [[ "${FAIL}" -gt 0 ]]; then
  echo "Failures:"
  for err in "${ERRORS[@]}"; do
    echo "  • $err"
  done
  echo ""
  exit 1
fi

echo "All v2.0 smoke checks passed."
echo ""
