#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Mission Control — Installer
# https://github.com/ProfFroggo/froggo-Mission-Control
#
# Sets up everything needed to run Mission Control on your Mac or Linux machine:
#   • Directory structure under ~/mission-control/
#   • All npm dependencies (app + MCP servers)
#   • Compiled MCP servers (tools/)
#   • .env configuration
#   • .claude/settings.json for Claude Code CLI hooks + MCP
#   • .mcp.json for Claude Code project MCP access
#   • Obsidian vault skeleton (memory/)
#   • LaunchAgent (macOS) or systemd service (Linux) for persistent boot
#   • First-run opens the app in your browser with the setup wizard
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${BLUE}▸${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}── $* ──${RESET}"; }

# ── Config ────────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_HOME="${HOME}/mission-control"
MC_DATA="${MC_HOME}/data"
MC_MEMORY="${MC_HOME}/memory"
MC_LIBRARY="${MC_HOME}/library"
MC_AGENTS="${MC_HOME}/agents"
MC_LOGS="${MC_HOME}/logs"
PORT="${MC_PORT:-3000}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║         Mission Control — Installer              ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BLUE}Platform directory:${RESET}  $REPO_DIR"
echo -e "  ${BLUE}Data directory:${RESET}      $MC_HOME"
echo -e "  ${BLUE}Port:${RESET}                $PORT"
echo ""

# ── Step 1: Prerequisites ─────────────────────────────────────────────────────
step "Checking prerequisites"

# Node.js
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node.js 20+ from https://nodejs.org"
fi
NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  error "Node.js 20+ required (found $(node --version)). Upgrade at https://nodejs.org"
fi
success "Node.js $(node --version)"

# npm
command -v npm &>/dev/null || error "npm not found — install Node.js from https://nodejs.org"
success "npm $(npm --version)"

# Git
command -v git &>/dev/null || error "git not found — install git from https://git-scm.com"
success "git $(git --version | awk '{print $3}')"

# Claude Code CLI
if ! command -v claude &>/dev/null; then
  warn "Claude Code CLI not found."
  echo "  Install it with: npm install -g @anthropic-ai/claude-code"
  echo "  Then re-run this installer."
  echo ""
  read -rp "  Install Claude Code CLI now? [Y/n] " install_claude
  if [[ "${install_claude:-Y}" =~ ^[Yy]$ ]]; then
    npm install -g @anthropic-ai/claude-code
    command -v claude &>/dev/null || error "Claude Code CLI install failed — check npm permissions"
  else
    error "Claude Code CLI is required. Install it and re-run: npm install -g @anthropic-ai/claude-code"
  fi
fi
CLAUDE_BIN="$(which claude)"
success "Claude Code CLI: $CLAUDE_BIN"

# Claude auth
CLAUDE_AUTH_OK=false
if claude --version &>/dev/null 2>&1; then
  # Try to check if authenticated
  if claude config list 2>/dev/null | grep -q "api_key\|account"; then
    CLAUDE_AUTH_OK=true
  fi
fi
if [ "$CLAUDE_AUTH_OK" = false ]; then
  warn "Claude Code CLI may not be authenticated."
  echo "  If you have a Claude Code subscription, run: claude auth login"
  echo "  (You can do this after installation — the app will work but agents won't spawn)"
fi

# ── Step 2: Gather API keys ───────────────────────────────────────────────────
step "Configuration"

GEMINI_API_KEY=""
ANTHROPIC_API_KEY=""

echo ""
echo "  Mission Control needs a few API keys to unlock all features."
echo "  Press Enter to skip any optional key — you can add them later in Settings."
echo ""

# Gemini API key (required for voice)
echo -e "  ${BOLD}Gemini API Key${RESET} (required for Voice — get free at https://aistudio.google.com/app/apikey)"
read -rp "  Gemini API Key: " GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
  warn "Gemini API key skipped — Voice features will be unavailable"
fi

# Anthropic API key (optional — Claude CLI handles auth, but direct SDK useful)
echo ""
echo -e "  ${BOLD}Anthropic API Key${RESET} (optional — for direct SDK usage, not required if using Claude CLI)"
read -rsp "  Anthropic API Key: " ANTHROPIC_API_KEY
echo ""
if [ -z "$ANTHROPIC_API_KEY" ]; then
  info "Anthropic API key skipped — Claude Code CLI subscription handles agent auth"
fi

# ── Step 3: Create directory structure ────────────────────────────────────────
step "Creating directory structure"

mkdir -p "${MC_DATA}"
mkdir -p "${MC_MEMORY}/agents"
mkdir -p "${MC_MEMORY}/knowledge"
mkdir -p "${MC_MEMORY}/sessions"
mkdir -p "${MC_MEMORY}/daily"
mkdir -p "${MC_MEMORY}/templates"
mkdir -p "${MC_LIBRARY}/code"
mkdir -p "${MC_LIBRARY}/design/images"
mkdir -p "${MC_LIBRARY}/design/media"
mkdir -p "${MC_LIBRARY}/design/ui"
mkdir -p "${MC_LIBRARY}/docs/planning"
mkdir -p "${MC_LIBRARY}/docs/presentations"
mkdir -p "${MC_LIBRARY}/docs/research"
mkdir -p "${MC_LIBRARY}/docs/strategies"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/code"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/design/images"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/design/media"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/design/ui"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/docs/presentations"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/docs/research"
mkdir -p "${MC_LIBRARY}/campaigns/campaign-{name}-{date}/docs/strategies"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/code"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/design/images"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/design/media"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/design/ui"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/docs/presentations"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/docs/research"
mkdir -p "${MC_LIBRARY}/projects/project-{name}-{date}/docs/strategies"
mkdir -p "${MC_AGENTS}"
mkdir -p "${MC_LOGS}"

# Add .gitkeep to each leaf directory so structure is preserved in git
LIBRARY_LEAF_DIRS=(
  "code"
  "design/images" "design/media" "design/ui"
  "docs/planning" "docs/presentations" "docs/research" "docs/strategies"
  "campaigns/campaign-{name}-{date}/code"
  "campaigns/campaign-{name}-{date}/design/images"
  "campaigns/campaign-{name}-{date}/design/media"
  "campaigns/campaign-{name}-{date}/design/ui"
  "campaigns/campaign-{name}-{date}/docs/presentations"
  "campaigns/campaign-{name}-{date}/docs/research"
  "campaigns/campaign-{name}-{date}/docs/strategies"
  "projects/project-{name}-{date}/code"
  "projects/project-{name}-{date}/design/images"
  "projects/project-{name}-{date}/design/media"
  "projects/project-{name}-{date}/design/ui"
  "projects/project-{name}-{date}/docs/presentations"
  "projects/project-{name}-{date}/docs/research"
  "projects/project-{name}-{date}/docs/strategies"
)
for leaf in "${LIBRARY_LEAF_DIRS[@]}"; do
  touch "${MC_LIBRARY}/${leaf}/.gitkeep"
done

# Write library README (only if it doesn't already exist)
if [ ! -f "${MC_LIBRARY}/README.md" ]; then
  cat > "${MC_LIBRARY}/README.md" << 'EOF'
# Mission Control Library

All agent output files live here. Agents write to the appropriate subfolder automatically.

## Structure

- `code/` — code files, scripts, snippets
- `design/images/` — images and graphics
- `design/media/` — video, audio, media files
- `design/ui/` — UI mockups, wireframes, components
- `docs/planning/` — plans, roadmaps, specs
- `docs/presentations/` — slide decks and presentations
- `docs/research/` — research reports and analysis
- `docs/strategies/` — strategy documents
- `campaigns/` — per-campaign folders (auto-created when campaign starts)
- `projects/` — per-project folders (auto-created when project is created)

## File naming

`YYYY-MM-DD_type_description.ext`

Examples:
- `2026-03-08_research_competitor-analysis.md`
- `2026-03-08_code_auth-service.ts`
- `2026-03-08_design_landing-page-v2.png`
EOF
fi

success "~/mission-control/ directory tree created"

# ── Step 4: Install npm dependencies ─────────────────────────────────────────
step "Installing app dependencies"
cd "${REPO_DIR}"
npm ci --prefer-offline 2>/dev/null || npm install
success "App dependencies installed"

# ── Step 5: Build MCP servers ─────────────────────────────────────────────────
step "Building MCP servers"

for tool in mission-control-db-mcp memory-mcp cron-mcp; do
  tool_dir="${REPO_DIR}/tools/${tool}"
  if [ -d "${tool_dir}" ]; then
    info "Building ${tool}..."
    cd "${tool_dir}"
    npm ci --prefer-offline 2>/dev/null || npm install
    npm run build 2>/dev/null || true
    cd "${REPO_DIR}"
    success "${tool} built"
  fi
done

# ── Step 5b: Install QMD memory search tool ───────────────────────────────────
step "Installing QMD memory search tool"

install_qmd() {
  # Check if qmd is already installed
  if command -v qmd &>/dev/null || [ -x "/opt/homebrew/bin/qmd" ] || [ -x "/usr/local/bin/qmd" ]; then
    success "qmd already installed"
    return
  fi

  # Check if Homebrew is available
  if ! command -v brew &>/dev/null; then
    warn "Homebrew not found — install qmd manually for full memory search: brew install profroggo/tap/qmd"
    return
  fi

  info "Installing qmd memory search tool..."
  if brew install profroggo/tap/qmd 2>/dev/null; then
    success "qmd installed"
  else
    warn "qmd install failed — memory search will use ripgrep fallback. Install manually: brew install profroggo/tap/qmd"
  fi
}

install_qmd

# ── Step 5c: Install Obsidian ─────────────────────────────────────────────────
step "Installing Obsidian"

install_obsidian() {
  if [ "$(uname -s)" = "Darwin" ]; then
    if [ -d "/Applications/Obsidian.app" ]; then
      success "Obsidian already installed"
      return
    fi

    if ! command -v brew &>/dev/null; then
      warn "Could not auto-install Obsidian. Download from https://obsidian.md and open ~/mission-control/memory as a vault."
      return
    fi

    info "Installing Obsidian..."
    if brew install --cask obsidian 2>/dev/null; then
      success "Obsidian installed"
      open -a Obsidian "${MC_MEMORY}" 2>/dev/null || true
    else
      warn "Could not auto-install Obsidian. Download from https://obsidian.md and open ~/mission-control/memory as a vault."
    fi

  elif [ "$(uname -s)" = "Linux" ]; then
    if command -v obsidian &>/dev/null || [ -x "/snap/bin/obsidian" ]; then
      success "Obsidian already installed"
      return
    fi

    info "Installing Obsidian via snap..."
    if snap install obsidian --classic 2>/dev/null; then
      success "Obsidian installed"
    else
      warn "Could not auto-install Obsidian. Download from https://obsidian.md"
    fi
  fi
}

install_obsidian

# ── Step 6: Build the app ─────────────────────────────────────────────────────
step "Building Mission Control (Next.js)"
cd "${REPO_DIR}"
npm run build
success "App built successfully"

# ── Step 7: Create .env ───────────────────────────────────────────────────────
step "Writing configuration"

ENV_FILE="${REPO_DIR}/.env"
if [ -f "${ENV_FILE}" ]; then
  warn ".env already exists — backing up to .env.backup"
  cp "${ENV_FILE}" "${ENV_FILE}.backup"
fi

cat > "${ENV_FILE}" << EOF
# Mission Control — Environment Configuration
# Generated by install.sh — edit freely

# ── Data paths ────────────────────────────────────────────────────────────────
MC_DB_PATH=${MC_DATA}/mission-control.db
VAULT_PATH=${MC_MEMORY}
LIBRARY_PATH=${MC_LIBRARY}
PROJECT_DIR=${REPO_DIR}
LOG_DIR=${MC_LOGS}

# ── API Keys ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY=${GEMINI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# ── Claude Code CLI ───────────────────────────────────────────────────────────
CLAUDE_BIN=${CLAUDE_BIN}
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1
CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001

# ── Model tiers (adjust based on your Claude plan) ───────────────────────────
MODEL_LEAD=claude-opus-4-6
MODEL_WORKER=claude-sonnet-4-6
MODEL_TRIVIAL=claude-haiku-4-5-20251001

# ── Server ────────────────────────────────────────────────────────────────────
PORT=${PORT}
TMUX_SESSION=mission-control
EOF
success ".env written to ${REPO_DIR}/.env"

# ── Step 8: Generate .claude/settings.json ────────────────────────────────────
step "Configuring Claude Code CLI"

CLAUDE_SETTINGS_DIR="${REPO_DIR}/.claude"
mkdir -p "${CLAUDE_SETTINGS_DIR}"

# Find QMD binary (optional memory search tool)
QMD_BIN=""
for qmd_path in "/opt/homebrew/bin/qmd" "/usr/local/bin/qmd" "${HOME}/.npm-global/bin/qmd" "${HOME}/.local/bin/qmd"; do
  if [ -x "$qmd_path" ]; then
    QMD_BIN="$qmd_path"
    break
  fi
done

TEMPLATE="${CLAUDE_SETTINGS_DIR}/settings.json.template"
OUTPUT="${CLAUDE_SETTINGS_DIR}/settings.json"

if [ -f "${TEMPLATE}" ]; then
  # Substitute placeholders
  sed \
    -e "s|{{PROJECT_ROOT}}|${REPO_DIR}|g" \
    -e "s|{{HOME}}|${HOME}|g" \
    "${TEMPLATE}" > "${OUTPUT}"
  
  # If QMD not found, clear the QMD_BIN env so it's empty rather than wrong
  if [ -z "${QMD_BIN}" ]; then
    python3 -c "
import json, sys
with open('${OUTPUT}') as f: d = json.load(f)
if 'mcpServers' in d and 'memory' in d['mcpServers']:
    d['mcpServers']['memory']['env'].pop('QMD_BIN', None)
with open('${OUTPUT}', 'w') as f: json.dump(d, f, indent=2)
print('QMD_BIN removed from settings (qmd not installed)')
" 2>/dev/null || true
  fi
  success ".claude/settings.json generated"
else
  warn "settings.json.template not found — skipping Claude Code hook configuration"
fi

# ── Step 9: Generate .mcp.json ────────────────────────────────────────────────
MCPJSON="${REPO_DIR}/.mcp.json"
cat > "${MCPJSON}" << EOF
{
  "mcpServers": {
    "mission-control-db": {
      "command": "node",
      "args": ["${REPO_DIR}/tools/mission-control-db-mcp/dist/index.js"],
      "env": {
        "DB_PATH": "${MC_DATA}/mission-control.db"
      }
    },
    "memory": {
      "command": "node",
      "args": ["${REPO_DIR}/tools/memory-mcp/dist/index.js"],
      "env": {
        "VAULT_PATH": "${MC_MEMORY}",
        "LOG_DIR": "${MC_LOGS}"$([ -n "${QMD_BIN}" ] && echo ",
        \"QMD_BIN\": \"${QMD_BIN}\"" || true)
      }
    },
    "cron": {
      "command": "node",
      "args": ["${REPO_DIR}/tools/cron-mcp/dist/index.js"],
      "env": {
        "SCHEDULE_PATH": "${MC_DATA}/schedule.json"
      }
    }
  }
}
EOF
success ".mcp.json written"

# ── Step 9b: Generate ~/mission-control/.claude/settings.json ────────────────
MC_CLAUDE_DIR="${MC_HOME}/.claude"
mkdir -p "${MC_CLAUDE_DIR}"

TEMPLATE="${REPO_DIR}/.claude/settings.json.template"
MC_SETTINGS_OUTPUT="${MC_CLAUDE_DIR}/settings.json"

if [ -f "${TEMPLATE}" ]; then
  QMD_BIN=""
  for qmd_path in "/opt/homebrew/bin/qmd" "/usr/local/bin/qmd" "${HOME}/.npm-global/bin/qmd" "${HOME}/.local/bin/qmd"; do
    if [ -x "$qmd_path" ]; then
      QMD_BIN="$qmd_path"
      break
    fi
  done

  sed \
    -e "s|{{PROJECT_ROOT}}|${REPO_DIR}|g" \
    -e "s|{{HOME}}|${HOME}|g" \
    "${TEMPLATE}" > "${MC_SETTINGS_OUTPUT}"

  if [ -z "${QMD_BIN}" ]; then
    python3 -c "
import json, sys
with open('${MC_SETTINGS_OUTPUT}') as f: d = json.load(f)
if 'mcpServers' in d and 'memory' in d['mcpServers']:
    d['mcpServers']['memory']['env'].pop('QMD_BIN', None)
with open('${MC_SETTINGS_OUTPUT}', 'w') as f: json.dump(d, f, indent=2)
" 2>/dev/null || true
  fi
  success "~/mission-control/.claude/settings.json generated"
fi

# ── Step 9c: Generate ~/mission-control/.mcp.json ────────────────────────────
cat > "${MC_HOME}/.mcp.json" << EOF
{
  "mcpServers": {
    "mission-control-db": {
      "command": "node",
      "args": ["${REPO_DIR}/tools/mission-control-db-mcp/dist/index.js"],
      "env": {
        "DB_PATH": "${MC_DATA}/mission-control.db"
      }
    },
    "memory": {
      "command": "node",
      "args": ["${REPO_DIR}/tools/memory-mcp/dist/index.js"],
      "env": {
        "VAULT_PATH": "${MC_MEMORY}",
        "LOG_DIR": "${MC_LOGS}"$([ -n "${QMD_BIN:-}" ] && echo ",
        \"QMD_BIN\": \"${QMD_BIN}\"" || true)
      }
    },
    "cron": {
      "command": "node",
      "args": ["${REPO_DIR}/tools/cron-mcp/dist/index.js"],
      "env": {
        "SCHEDULE_PATH": "${MC_DATA}/schedule.json"
      }
    }
  }
}
EOF
success "~/mission-control/.mcp.json written"

# ── Step 9d: Scaffold core agent workspaces ───────────────────────────────────
step "Bootstrapping core agent workspaces"

bootstrap_agents() {
  local catalog_agents_dir="${REPO_DIR}/catalog/agents"
  local core_agents=("mission-control" "clara" "coder" "writer")

  for agent_id in "${core_agents[@]}"; do
    local workspace="${MC_AGENTS}/${agent_id}"
    mkdir -p "${workspace}"

    local src_claude="${catalog_agents_dir}/${agent_id}/claude.md"
    local dst_claude="${workspace}/CLAUDE.md"
    if [ -f "${src_claude}" ] && [ ! -f "${dst_claude}" ]; then
      cp "${src_claude}" "${dst_claude}"
    fi

    local src_soul="${catalog_agents_dir}/${agent_id}/soul.md"
    local dst_soul="${workspace}/SOUL.md"
    if [ -f "${src_soul}" ] && [ ! -f "${dst_soul}" ]; then
      cp "${src_soul}" "${dst_soul}"
    fi

    local dst_memory="${workspace}/MEMORY.md"
    if [ ! -f "${dst_memory}" ]; then
      echo "# Memory" > "${dst_memory}"
    fi
  done
}

bootstrap_agents
success "Core agent workspaces bootstrapped"

# ── Step 9e: Generate ~/mission-control/CLAUDE.md ────────────────────────────
if [ ! -f "${MC_HOME}/CLAUDE.md" ]; then
  cat > "${MC_HOME}/CLAUDE.md" << EOF
# Mission Control

## Paths
- App: ${REPO_DIR} — \`npm start\` → localhost:${PORT}
- DB: ${MC_DATA}/mission-control.db
- Vault: ${MC_MEMORY}/
- Library: ${MC_LIBRARY}/
- Agents: ${MC_AGENTS}/

## MCP Tools Available
- \`mcp__mission-control-db__task_create/update/list\` — task management
- \`mcp__mission-control-db__chat_post/read\` — agent chat
- \`mcp__mission-control-db__approval_create\` — human approval gates
- \`mcp__memory__memory_search/recall/write/read\` — knowledge vault
- \`mcp__cron__schedule_create/list\` — scheduling

## Agent Roster
- **mission-control** — Primary orchestrator, delegates work
- **clara** — QA review gate, runs before work ships
- **coder** — Code execution, debugging, implementation
- **writer** — Content, docs, long-form writing

## Task Lifecycle
todo → internal-review → in-progress → review → human-review → done

## Key Rules
- Check task board before starting work
- Post activity on every meaningful decision
- External actions → \`approval_create\` MCP tool first
- P0/P1 tasks → Clara review before done
- ENV values → read from app API, never hardcode paths
EOF
  success "~/mission-control/CLAUDE.md written"
fi

# ── Step 9f: Create empty data files ─────────────────────────────────────────
if [ ! -f "${MC_DATA}/schedule.json" ]; then
  echo '{}' > "${MC_DATA}/schedule.json"
fi
if [ ! -f "${MC_DATA}/google-tokens.json" ]; then
  echo '{}' > "${MC_DATA}/google-tokens.json"
fi
success "Data files initialised"

# ── Step 10: Obsidian vault skeleton ─────────────────────────────────────────
step "Setting up memory vault"

OBSIDIAN_DIR="${MC_MEMORY}/.obsidian"
mkdir -p "${OBSIDIAN_DIR}"

if [ ! -f "${OBSIDIAN_DIR}/app.json" ]; then
  cat > "${OBSIDIAN_DIR}/app.json" << 'EOF'
{
  "useMarkdownLinks": false,
  "newFileFolderPath": "daily",
  "defaultViewMode": "source"
}
EOF
fi

# Home note
if [ ! -f "${MC_MEMORY}/Home.md" ]; then
  cat > "${MC_MEMORY}/Home.md" << 'EOF'
# Mission Control Memory Vault

Welcome to your agent memory vault. This directory is used by Mission Control agents to store long-term memory, session logs, and knowledge articles.

## Structure
- `agents/` — Per-agent memory files
- `daily/` — Daily notes (auto-generated)
- `sessions/` — Session logs
- `knowledge/` — Knowledge base articles
- `templates/` — Note templates

Open in Obsidian: `File → Open Vault → Select this folder`
EOF
fi

success "Memory vault ready at ${MC_MEMORY}"

# ── Step 11: LaunchAgent (macOS) / systemd (Linux) ───────────────────────────
step "Installing persistent service"

OS="$(uname -s)"

if [ "${OS}" = "Darwin" ]; then
  # macOS LaunchAgent
  LAUNCH_AGENT_DIR="${HOME}/Library/LaunchAgents"
  PLIST="${LAUNCH_AGENT_DIR}/com.mission-control.app.plist"
  CRON_PLIST="${LAUNCH_AGENT_DIR}/com.mission-control.cron.plist"
  LOG_FILE="${HOME}/Library/Logs/mission-control-app.log"

  # Detect node binary (prefer which node, fall back to Apple Silicon / Intel paths)
  NODE_BIN="$(which node 2>/dev/null || echo /opt/homebrew/bin/node)"

  mkdir -p "${LAUNCH_AGENT_DIR}"

  cat > "${PLIST}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mission-control.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/node_modules/.bin/next</string>
    <string>start</string>
    <string>--port</string>
    <string>${PORT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>MC_DB_PATH</key>
    <string>${MC_DATA}/mission-control.db</string>
    <key>VAULT_PATH</key>
    <string>${MC_MEMORY}</string>
    <key>LIBRARY_PATH</key>
    <string>${MC_LIBRARY}</string>
    <key>PROJECT_DIR</key>
    <string>${REPO_DIR}</string>
    <key>LOG_DIR</key>
    <string>${MC_LOGS}</string>
    <key>CLAUDE_BIN</key>
    <string>${CLAUDE_BIN}</string>
    <key>GEMINI_API_KEY</key>
    <string>${GEMINI_API_KEY}</string>
    <key>ANTHROPIC_API_KEY</key>
    <string>${ANTHROPIC_API_KEY}</string>
    <key>CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS</key>
    <string>1</string>
    <key>CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING</key>
    <string>1</string>
    <key>MODEL_LEAD</key>
    <string>claude-opus-4-6</string>
    <key>MODEL_WORKER</key>
    <string>claude-sonnet-4-6</string>
    <key>MODEL_TRIVIAL</key>
    <string>claude-haiku-4-5-20251001</string>
    <key>PORT</key>
    <string>${PORT}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
</dict>
</plist>
EOF

  # Unload existing (if any) then load
  launchctl unload "${PLIST}" 2>/dev/null || true
  launchctl load -w "${PLIST}"
  success "LaunchAgent installed — Mission Control starts automatically at login"
  info "Logs: $LOG_FILE"

  # ── Cron daemon LaunchAgent ────────────────────────────────────────────────
  cat > "${CRON_PLIST}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mission-control.cron</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/tools/cron-daemon.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${MC_LOGS}/cron-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${MC_LOGS}/cron-daemon-error.log</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
EOF

  launchctl unload "${CRON_PLIST}" 2>/dev/null || true
  launchctl load -w "${CRON_PLIST}" 2>/dev/null || warn "Cron daemon plist registered (will start when cron-daemon.js is present)"
  success "Cron daemon LaunchAgent installed"
  info "Cron logs: ${MC_LOGS}/cron-daemon.log"

elif [ "${OS}" = "Linux" ]; then
  # systemd user service
  SYSTEMD_DIR="${HOME}/.config/systemd/user"
  mkdir -p "${SYSTEMD_DIR}"
  
  NODE_BIN="$(which node)"
  
  cat > "${SYSTEMD_DIR}/mission-control.service" << EOF
[Unit]
Description=Mission Control Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=${REPO_DIR}
ExecStart=${NODE_BIN} ${REPO_DIR}/node_modules/.bin/next start --port ${PORT}
Restart=always
RestartSec=5
Environment=HOME=${HOME}
Environment=MC_DB_PATH=${MC_DATA}/mission-control.db
Environment=VAULT_PATH=${MC_MEMORY}
Environment=LIBRARY_PATH=${MC_LIBRARY}
Environment=PROJECT_DIR=${REPO_DIR}
Environment=LOG_DIR=${MC_LOGS}
Environment=CLAUDE_BIN=${CLAUDE_BIN}
Environment=GEMINI_API_KEY=${GEMINI_API_KEY}
Environment=ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
Environment=CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
Environment=MODEL_LEAD=claude-opus-4-6
Environment=MODEL_WORKER=claude-sonnet-4-6
Environment=MODEL_TRIVIAL=claude-haiku-4-5-20251001
Environment=PORT=${PORT}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
  
  # cron daemon systemd service
  cat > "${SYSTEMD_DIR}/mission-control-cron.service" << EOF
[Unit]
Description=Mission Control Cron Daemon
After=network.target

[Service]
Type=simple
WorkingDirectory=${REPO_DIR}
ExecStart=${NODE_BIN} ${REPO_DIR}/tools/cron-daemon.js
Restart=always
RestartSec=5
Environment=HOME=${HOME}
Environment=MC_DB_PATH=${MC_DATA}/mission-control.db
Environment=SCHEDULE_PATH=${MC_DATA}/schedule.json
Environment=PROJECT_DIR=${REPO_DIR}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable mission-control.service
  systemctl --user enable mission-control-cron.service
  systemctl --user start mission-control.service
  systemctl --user start mission-control-cron.service
  success "systemd services installed and started (app + cron daemon)"
  info "Logs: journalctl --user -fu mission-control"
  info "Cron logs: journalctl --user -fu mission-control-cron"
else
  warn "Unknown OS (${OS}) — manual startup only. Run: npm start"
fi

# ── Step 12: Wait for server and open browser ─────────────────────────────────
step "Starting Mission Control"

echo ""
info "Waiting for server to start on port ${PORT}..."

for i in {1..30}; do
  if curl -sf "http://localhost:${PORT}/api/health" &>/dev/null; then
    break
  fi
  sleep 1
  printf "."
done
echo ""

if curl -sf "http://localhost:${PORT}/api/health" &>/dev/null; then
  success "Mission Control is running at http://localhost:${PORT}"
  
  # Open in browser
  if [ "${OS}" = "Darwin" ]; then
    open "http://localhost:${PORT}"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:${PORT}"
  fi
else
  warn "Server not responding yet — it may still be starting up"
  info "Once ready: http://localhost:${PORT}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║       Installation Complete                      ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Dashboard:${RESET}   http://localhost:${PORT}"
echo -e "  ${BOLD}Data:${RESET}        ${MC_HOME}/"
echo -e "  ${BOLD}Platform:${RESET}    ${REPO_DIR}/"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "    1. The setup wizard will open in your browser"
echo -e "    2. Connect Google Workspace (Gmail + Calendar) in the wizard"
echo -e "    3. Browse the Agents Catalog to hire your team"
echo -e "    4. Install modules from the Modules Library"
echo ""
if [ -z "${GEMINI_API_KEY}" ]; then
  echo -e "  ${YELLOW}Voice:${RESET} Add your Gemini API key in Settings → Voice"
fi
echo -e "  ${BLUE}Logs:${RESET} tail -f ~/Library/Logs/mission-control-app.log"
echo -e "  ${BLUE}Stop:${RESET} launchctl stop com.mission-control.app"
echo -e "  ${BLUE}Update:${RESET} git pull && npm run build && launchctl stop com.mission-control.app"
echo ""
