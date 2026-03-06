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

grep -q "mission-control/worktrees" "$REPO/tools/worktree-setup.sh" 2>/dev/null \
  && check "worktree-setup.sh: uses ~/mission-control/worktrees" "ok" \
  || check "worktree-setup.sh: uses ~/mission-control/worktrees" "path not found"

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

grep -q "permissionMode" "$REPO/.claude/agents/coder.md" 2>/dev/null \
  && check "coder.md: permissionMode set" "ok" \
  || check "coder.md: permissionMode set" "missing"

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

# ── v3.0: Task Dispatcher ───────────────────────────────────────────────────
echo "Phase 23: Task Dispatcher Overhaul (v3.0)"

grep -q "buildTaskSystemPrompt" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: buildTaskSystemPrompt present" "ok" \
  || check "taskDispatcher: buildTaskSystemPrompt present" "not found"

grep -q "resolveModel" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: resolveModel present" "ok" \
  || check "taskDispatcher: resolveModel present" "not found"

grep -q "process.cwd()" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: cwd = process.cwd()" "ok" \
  || check "taskDispatcher: cwd = process.cwd()" "not found"

grep -q "stream-json" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: --output-format stream-json" "ok" \
  || check "taskDispatcher: --output-format stream-json" "not found"

grep -q "persistTaskSession" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: session persistence" "ok" \
  || check "taskDispatcher: session persistence" "not found"

grep -q "dispatch_exit" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: exit event logging" "ok" \
  || check "taskDispatcher: exit event logging" "not found"

grep -q "CLAUDE_AGENT_ID" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher: CLAUDE_AGENT_ID in env" "ok" \
  || check "taskDispatcher: CLAUDE_AGENT_ID in env" "not found"

echo ""

# ── v3.0: Agent Identity ─────────────────────────────────────────────────────
echo "Phase 23.1: Agent Identity Foundation (v3.0)"

FIXED=0; BROKEN=0
for dir in ~/mission-control/agents/*/; do
  id="$(basename "$dir")"
  if [[ -f "$dir/CLAUDE.md" ]]; then
    if grep -q "mcp__mission-control_db" "$dir/CLAUDE.md" 2>/dev/null; then
      FIXED=$((FIXED+1))
    else
      BROKEN=$((BROKEN+1))
    fi
  fi
done
[[ "$BROKEN" -eq 0 && "$FIXED" -gt 0 ]] \
  && check "Agent workspace CLAUDE.md files: all use MCP tools (${FIXED} agents)" "ok" \
  || check "Agent workspace CLAUDE.md files: ${BROKEN} still have derek-db" "fix needed"

echo ""

# ── v3.0: PreCompact Hook ────────────────────────────────────────────────────
echo "Phase 24: PreCompact Context Resilience (v3.0)"

[[ -f "$REPO/tools/hooks/precompact-hook.js" ]] \
  && check "tools/hooks/precompact-hook.js exists" "ok" \
  || check "tools/hooks/precompact-hook.js exists" "not found"

grep -q '"PreCompact"' "$REPO/.claude/settings.json" 2>/dev/null \
  && check "settings.json: PreCompact hook registered" "ok" \
  || check "settings.json: PreCompact hook registered" "not found"

echo ""

# ── v3.0: Agent Teams Hooks ──────────────────────────────────────────────────
echo "Phase 25: Agent Teams Quality Gates (v3.0)"

[[ -f "$REPO/tools/hooks/teammate-idle.js" ]] \
  && check "tools/hooks/teammate-idle.js exists" "ok" \
  || check "tools/hooks/teammate-idle.js exists" "not found"

[[ -f "$REPO/tools/hooks/task-completed.js" ]] \
  && check "tools/hooks/task-completed.js exists" "ok" \
  || check "tools/hooks/task-completed.js exists" "not found"

grep -q '"TeammateIdle"' "$REPO/.claude/settings.json" 2>/dev/null \
  && check "settings.json: TeammateIdle hook registered" "ok" \
  || check "settings.json: TeammateIdle hook registered" "not found"

grep -q '"TaskCompleted"' "$REPO/.claude/settings.json" 2>/dev/null \
  && check "settings.json: TaskCompleted hook registered" "ok" \
  || check "settings.json: TaskCompleted hook registered" "not found"

echo ""

# ── v3.0: Token Tracking ─────────────────────────────────────────────────────
echo "Phase 26: Token & Cost Tracking (v3.0)"

grep -q "token_usage" "$REPO/src/lib/database.ts" 2>/dev/null \
  && check "database.ts: token_usage table defined" "ok" \
  || check "database.ts: token_usage table defined" "not found"

grep -q "MODEL_PRICING" "$REPO/src/lib/env.ts" 2>/dev/null \
  && check "env.ts: MODEL_PRICING defined" "ok" \
  || check "env.ts: MODEL_PRICING defined" "not found"

grep -q "calcCostUsd" "$REPO/src/lib/env.ts" 2>/dev/null \
  && check "env.ts: calcCostUsd helper" "ok" \
  || check "env.ts: calcCostUsd helper" "not found"

[[ -f "$REPO/app/api/analytics/tokens/route.ts" ]] \
  && check "app/api/analytics/tokens/route.ts exists" "ok" \
  || check "app/api/analytics/tokens/route.ts exists" "not found"

echo ""

# ── v3.0: Monitoring ─────────────────────────────────────────────────────────
echo "Phase 28: Monitoring & Alerting (v3.0)"

grep -q "checkStuckTasks" "$REPO/tools/cron-daemon.js" 2>/dev/null \
  && check "cron-daemon.js: checkStuckTasks present" "ok" \
  || check "cron-daemon.js: checkStuckTasks present" "not found"

[[ -f "$REPO/app/api/agents/health/route.ts" ]] \
  && check "app/api/agents/health/route.ts exists" "ok" \
  || check "app/api/agents/health/route.ts exists" "not found"

echo ""

# ── v3.0: Rate Limiting ───────────────────────────────────────────────────────
echo "Phase 29: Rate Limiting & Resilience (v3.0)"

STREAM_ROUTE="$REPO/app/api/agents/[id]/stream/route.ts"
grep -q "agentLocks" "$STREAM_ROUTE" 2>/dev/null \
  && check "stream/route.ts: agentLocks spawn lock" "ok" \
  || check "stream/route.ts: agentLocks spawn lock" "not found"

grep -q "DEBOUNCE_MS" "$REPO/src/lib/taskDispatcher.ts" 2>/dev/null \
  && check "taskDispatcher.ts: dispatch debounce" "ok" \
  || check "taskDispatcher.ts: dispatch debounce" "not found"

echo ""

# ── TypeScript + Build ─────────────────────────────────────────────────────
echo "Build Verification"

if cd "$REPO" && npx tsc --noEmit > /dev/null 2>&1; then
  check "npx tsc --noEmit: 0 errors" "ok"
else
  check "npx tsc --noEmit: 0 errors" "TypeScript errors found"
fi

echo ""

# ── v4.0: Catalog Schema ──────────────────────────────────────────────────────
echo "Phase 31: Catalog Schema & Data Model (v4.0)"

grep -q "catalog_agents" "$REPO/src/lib/database.ts" 2>/dev/null \
  && check "database.ts: catalog_agents table defined" "ok" \
  || check "database.ts: catalog_agents table defined" "not found"

grep -q "catalog_modules" "$REPO/src/lib/database.ts" 2>/dev/null \
  && check "database.ts: catalog_modules table defined" "ok" \
  || check "database.ts: catalog_modules table defined" "not found"

[[ -f "$REPO/src/lib/catalogSync.ts" ]] \
  && check "src/lib/catalogSync.ts exists" "ok" \
  || check "src/lib/catalogSync.ts exists" "not found"

AGENT_COUNT=$(ls "$REPO/.catalog/agents/"*.json 2>/dev/null | wc -l | tr -d ' ')
[[ "$AGENT_COUNT" -ge 10 ]] \
  && check ".catalog/agents: ≥10 manifests ($AGENT_COUNT found)" "ok" \
  || check ".catalog/agents: ≥10 manifests" "$AGENT_COUNT found"

MODULE_COUNT=$(ls "$REPO/.catalog/modules/"*.json 2>/dev/null | wc -l | tr -d ' ')
[[ "$MODULE_COUNT" -ge 10 ]] \
  && check ".catalog/modules: ≥10 manifests ($MODULE_COUNT found)" "ok" \
  || check ".catalog/modules: ≥10 manifests" "$MODULE_COUNT found"

echo ""

# ── v4.0: Catalog REST API ────────────────────────────────────────────────────
echo "Phase 32: Catalog REST API (v4.0)"

[[ -f "$REPO/app/api/catalog/agents/route.ts" ]] \
  && check "app/api/catalog/agents/route.ts exists" "ok" \
  || check "app/api/catalog/agents/route.ts exists" "not found"

[[ -f "$REPO/app/api/catalog/agents/[id]/route.ts" ]] \
  && check "app/api/catalog/agents/[id]/route.ts exists" "ok" \
  || check "app/api/catalog/agents/[id]/route.ts exists" "not found"

[[ -f "$REPO/app/api/catalog/modules/route.ts" ]] \
  && check "app/api/catalog/modules/route.ts exists" "ok" \
  || check "app/api/catalog/modules/route.ts exists" "not found"

[[ -f "$REPO/app/api/catalog/modules/[id]/route.ts" ]] \
  && check "app/api/catalog/modules/[id]/route.ts exists" "ok" \
  || check "app/api/catalog/modules/[id]/route.ts exists" "not found"

grep -q "catalogApi" "$REPO/src/lib/api.ts" 2>/dev/null \
  && check "api.ts: catalogApi exported" "ok" \
  || check "api.ts: catalogApi exported" "not found"

echo ""

# ── v4.0: Agent & Module Library UI ──────────────────────────────────────────
echo "Phases 33-35: Library UI (v4.0)"

[[ -f "$REPO/src/components/AgentLibraryPanel.tsx" ]] \
  && check "AgentLibraryPanel.tsx exists" "ok" \
  || check "AgentLibraryPanel.tsx exists" "not found"

[[ -f "$REPO/src/components/ModuleLibraryPanel.tsx" ]] \
  && check "ModuleLibraryPanel.tsx exists" "ok" \
  || check "ModuleLibraryPanel.tsx exists" "not found"

grep -q "AgentLibraryPanel" "$REPO/src/components/AgentPanel.tsx" 2>/dev/null \
  && check "AgentPanel.tsx: imports AgentLibraryPanel" "ok" \
  || check "AgentPanel.tsx: imports AgentLibraryPanel" "not found"

grep -q "ModuleLibraryPanel" "$REPO/src/components/ModulesPage.tsx" 2>/dev/null \
  && check "ModulesPage.tsx: imports ModuleLibraryPanel" "ok" \
  || check "ModulesPage.tsx: imports ModuleLibraryPanel" "not found"

echo ""

# ── v4.0: Wizards & Install ───────────────────────────────────────────────────
echo "Phases 34-36: Hire & Install Wizards (v4.0)"

[[ -f "$REPO/app/api/agents/hire/route.ts" ]] \
  && check "app/api/agents/hire/route.ts exists" "ok" \
  || check "app/api/agents/hire/route.ts exists" "not found"

[[ -f "$REPO/app/api/modules/install/route.ts" ]] \
  && check "app/api/modules/install/route.ts exists" "ok" \
  || check "app/api/modules/install/route.ts exists" "not found"

[[ -f "$REPO/src/components/ModuleInstallModal.tsx" ]] \
  && check "ModuleInstallModal.tsx exists" "ok" \
  || check "ModuleInstallModal.tsx exists" "not found"

[[ -f "$REPO/app/api/agents/hr/stream/route.ts" ]] \
  && check "app/api/agents/hr/stream/route.ts exists" "ok" \
  || check "app/api/agents/hr/stream/route.ts exists" "not found"

echo ""

# ── v4.0: Lifecycle & Onboarding ─────────────────────────────────────────────
echo "Phases 37-38: Lifecycle & Onboarding Presets (v4.0)"

grep -q "DELETE" "$REPO/app/api/catalog/agents/[id]/route.ts" 2>/dev/null \
  && check "catalog/agents/[id]: DELETE handler present" "ok" \
  || check "catalog/agents/[id]: DELETE handler present" "not found"

grep -q "core.*cannot\|Core modules" "$REPO/app/api/catalog/modules/[id]/route.ts" 2>/dev/null \
  && check "catalog/modules/[id]: core module guard present" "ok" \
  || check "catalog/modules/[id]: core module guard present" "not found"

grep -q "ROLE_PRESETS" "$REPO/src/components/OnboardingWizard.tsx" 2>/dev/null \
  && check "OnboardingWizard.tsx: ROLE_PRESETS defined" "ok" \
  || check "OnboardingWizard.tsx: ROLE_PRESETS defined" "not found"

grep -q "renderRolePresets" "$REPO/src/components/OnboardingWizard.tsx" 2>/dev/null \
  && check "OnboardingWizard.tsx: renderRolePresets step added" "ok" \
  || check "OnboardingWizard.tsx: renderRolePresets step added" "not found"

STEP_COUNT=$(grep -o "STEP_COUNT = [0-9]*" "$REPO/src/components/OnboardingWizard.tsx" 2>/dev/null | grep -o "[0-9]*$")
[[ "$STEP_COUNT" == "7" ]] \
  && check "OnboardingWizard.tsx: STEP_COUNT = 7" "ok" \
  || check "OnboardingWizard.tsx: STEP_COUNT = 7" "got $STEP_COUNT"

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

echo "All v2.0 + v3.0 + v4.0 smoke checks passed."
echo ""
