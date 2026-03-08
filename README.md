# Mission Control

**A self-hosted AI agent platform built for Claude Code CLI.** Mission Control gives you a persistent local dashboard that runs a team of AI agents — they handle tasks, triage your inbox, manage your calendar, write code, research, and more.

[![npm version](https://img.shields.io/npm/v/froggo-mission-control.svg)](https://www.npmjs.com/package/froggo-mission-control)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

---

## What it does

Mission Control is your personal AI operations center. It ships with:

- **15 agents** — Hire from the catalog: Inbox, Coder, Senior Coder, Designer, Researcher, Clara (QA), Chief, HR, Writer, Social Manager, Finance, Growth Director, Discord Manager, Voice, and the Mission Control orchestrator
- **Modular dashboard** — Install what you need: Kanban, Analytics, Approvals, Chat Rooms, Schedule, Gmail Inbox, Finance, Library, Projects, Voice, Writing, Meetings, and more
- **Task pipeline** — Full lifecycle: `todo → internal-review → in-progress → agent-review → done`, with Clara QA gates before work starts and after it completes
- **Projects** — Kanban boards, agent dispatch, shared chat rooms, file library — all linked
- **Memory vault** — Obsidian-compatible knowledge base that agents read/write across sessions, pre-seeded with platform documentation
- **Comms Inbox** — Gmail integration with AI-powered triage (Smart Inbox)
- **Google Calendar** — Today's schedule widget and full calendar view
- **Voice** — Real-time voice interface via Gemini Live
- **Agent trust tiers** — Mission Control runs with full trust; Clara and HR as workers; all others as apprentices with scoped permissions
- **OS keychain** — API keys stored securely in the system keychain (macOS Keychain / Linux Secret Service), never in plaintext
- **MCP servers** — Native Claude Code CLI integration for task management, memory search, and scheduling

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org) |
| **Claude Code CLI** | Latest | [install guide](https://docs.anthropic.com/claude-code) — requires active Claude subscription |
| **Obsidian** | Latest | Auto-installed via `brew install --cask obsidian`. Required for memory vault. |
| **Git** | Any | For cloning + updates |
| **macOS** or **Linux** | — | Windows not tested |

**Optional:**
- **Gemini API key** — Required for Voice. Free at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **Google Workspace** — Gmail + Calendar integration (OAuth setup in the app wizard)
- **QMD** — Hybrid BM25/vector memory search. Auto-installed via `brew install profroggo/tap/qmd`. Falls back to ripgrep automatically if not installed.

---

## Installation

### Option A — npm (recommended)

```bash
# Step 1 — install the package (3–5 min, fully automatic)
npm install -g froggo-mission-control

# Step 2 — run first-time setup (~1 min)
mission-control
```

**What `npm install -g` does automatically:**
- Downloads the package and all dependencies
- Compiles the 3 MCP servers (`mission-control-db-mcp`, `memory-mcp`, `cron-mcp`)
- Installs QMD memory search and Obsidian (via Homebrew on macOS)
- Runs `next build` — full production build of the dashboard

**What `mission-control` (first run) does automatically:**
1. Checks prerequisites — Node.js 20+, Claude Code CLI
2. Creates the full `~/mission-control/` directory tree (agents, data, library, memory, logs)
3. Scaffolds the complete library structure with all output folders
4. Bootstraps 4 core agent workspaces from catalog templates (mission-control, clara, coder, writer)
5. Pre-seeds `~/mission-control/memory/knowledge/` with 6 platform documentation articles
6. Generates `CLAUDE.md`, `.claude/settings.json`, and `.mcp.json` in `~/mission-control/`
7. Creates data files (`schedule.json`, `google-tokens.json`)
8. Writes `.env`
9. Installs a **LaunchAgent** (macOS) or **two systemd services** (Linux) — app + cron daemon
10. Starts the server and opens your browser to `http://localhost:3000/setup`

No interactive prompts. No API keys in the terminal. Everything continues in the browser.

---

### Option B — install.sh (clone + run)

```bash
git clone https://github.com/ProfFroggo/froggo-Mission-Control.git
cd froggo-Mission-Control
./install.sh
```

**What `install.sh` does automatically:**
- Checks prerequisites (Node.js 20+, Claude Code CLI, Git)
- Installs all npm dependencies
- Compiles the 3 MCP servers
- Installs QMD and Obsidian
- Builds the Next.js dashboard (`next build`)
- Creates the full `~/mission-control/` directory tree and library structure
- Bootstraps core agent workspaces from catalog templates
- Pre-seeds the knowledge base
- Generates `.env`, `.mcp.json`, and `.claude/settings.json` configured for your machine
- Sets up an Obsidian-compatible memory vault skeleton
- Installs a **LaunchAgent** (macOS) or **systemd services** (Linux) — persistent, auto-start at login, auto-restart on crash
- Opens `http://localhost:3000/setup` in your browser

---

## First run — in-app setup wizard

After the CLI opens your browser, the wizard walks you through 10 steps:

1. **Welcome** — what Mission Control does and what you're about to set up
2. **System Check** — verifies CLI, database, MCP servers, and agent files are ready
3. **Agent Permissions** — review the tool permissions agents need; confirm to unlock autonomous operation
4. **Gemini API Key** — paste and validate (skippable — voice features won't work without it)
5. **Google Workspace** — connect Gmail and Calendar via OAuth (skippable)
6. **Obsidian & Permissions** — open the memory vault in Obsidian; grant mic/camera for voice
7. **Agent & Module Picker** — 4 core agents pre-selected; choose optional agents and modules from the catalog
8. **Animated Setup Checklist** — live progress as your selected agents and modules are installed
9. **Interactive Tour** — guided walkthrough of every panel (re-launchable from Settings anytime)
10. **Done** — land on your dashboard, ready to go

---

## What gets installed where

```
~/mission-control/
├── data/
│   ├── mission-control.db     # SQLite database (tasks, agents, chat, approvals, etc.)
│   ├── google-tokens.json     # Google OAuth tokens (auto-managed)
│   └── schedule.json          # Cron job schedule
├── memory/                    # Obsidian-compatible agent memory vault
│   ├── knowledge/             # Pre-seeded platform docs (architecture, MCP tools, task lifecycle, etc.)
│   ├── agents/                # Per-agent memory files
│   ├── sessions/              # Session logs
│   ├── daily/                 # Daily notes
│   └── templates/             # Note templates
├── library/                   # All agent output files
│   ├── code/
│   ├── design/
│   │   ├── ui/
│   │   ├── images/
│   │   └── media/
│   ├── docs/
│   │   ├── research/
│   │   ├── presentations/
│   │   └── strategies/
│   ├── campaigns/             # Per-campaign folders (auto-created)
│   └── projects/              # Per-project folders (auto-created)
├── agents/                    # Per-agent workspaces (CLAUDE.md, SOUL.md, MEMORY.md, DIRECTORIES.md)
│   ├── mission-control/       # Orchestrator
│   ├── clara/                 # QA review gate
│   ├── coder/                 # Code execution
│   └── writer/                # Content & docs
├── .claude/
│   └── settings.json          # Tool permissions + MCP server registrations + hooks
├── .mcp.json                  # MCP server config for Claude Code sessions
└── CLAUDE.md                  # Project context for all agent sessions

$(npm root -g)/froggo-mission-control/  # Platform code (npm global install)
```

---

## Directory layout (repo)

```
froggo-Mission-Control/
├── app/                       # Next.js App Router routes + API
│   └── api/                   # 100+ API endpoints
├── src/
│   ├── components/            # React UI components
│   ├── lib/                   # Server-side logic (db, env, dispatch, keychain)
│   ├── modules/               # Pluggable feature modules
│   ├── store/                 # Zustand client stores
│   └── types/                 # TypeScript types
├── catalog/
│   ├── agents/                # Agent manifests + soul files + avatars (WebP)
│   └── modules/               # Module manifests
├── templates/
│   └── knowledge/             # Knowledge base articles seeded on install
├── tools/
│   ├── mission-control-db-mcp/  # MCP server: task/agent/chat DB tools
│   ├── memory-mcp/              # MCP server: memory vault read/write/search
│   ├── cron-mcp/                # MCP server: schedule management
│   └── hooks/                   # Claude Code CLI hooks
├── .claude/
│   ├── CLAUDE.md              # Platform instructions for agents
│   ├── agents/                # Agent definition files (trust tiers, tools, MCP)
│   ├── settings.json.template # Claude Code settings template
│   └── skills/                # Reusable skill files for agents
├── bin/
│   └── cli.js                 # `mission-control` CLI entry point
├── install.sh                 # One-command installer (Option B)
├── .env.example               # Environment variable template
└── ecosystem.config.js        # pm2 config (alternative to LaunchAgent)
```

---

## Commands

```bash
mission-control              # first-time setup on first run, status otherwise
mission-control status       # health check — server, CLI, database
mission-control logs         # tail the log file (Ctrl+C to exit)
mission-control stop         # stop the server
mission-control restart      # restart the server
mission-control open         # open dashboard in browser
mission-control config       # show current configuration
mission-control build        # rebuild app + MCP servers
mission-control update       # npm update -g + rebuild + restart
mission-control setup        # re-run the setup wizard
mission-control setup --force  # overwrite existing config
mission-control help         # full command reference
```

## Updating

```bash
mission-control update
```

Runs `npm update -g froggo-mission-control`, rebuilds everything, and restarts the service automatically.

---

## How agents work

Agents are Claude Code CLI subprocesses spawned by Mission Control. Each agent has:
- A **soul file** (`catalog/agents/{id}/soul.md`) — personality, responsibilities, output paths
- A **CLAUDE.md** (`catalog/agents/{id}/claude.md`) — boot sequence and MCP tool access
- A **manifest** (`catalog/agents/{id}/manifest.json`) — model, capabilities, required APIs/tools
- A **definition file** (`.claude/agents/{id}.md`) — trust tier, tools, MCP servers
- Access to MCP tools: `mcp__mission-control_db__*` for tasks/chat, `mcp__memory__*` for the vault

The platform dispatches tasks to agents automatically. Agents report progress via MCP, update task status, and store learnings in the memory vault.

### Agent trust tiers

| Tier | Who | Permissions |
|------|-----|-------------|
| **Trusted** | Mission Control | Full tool access, bypass permissions |
| **Worker** | Clara, HR | Full tool access, bypass permissions |
| **Apprentice** | All other agents | Default scoped permissions |

### Task pipeline

```
todo → internal-review → in-progress → agent-review → done
             ↕                              ↕
        human-review                  human-review
     (needs human input)         (external dependency)
```

- Clara reviews every task **before** work begins (internal-review gate) and **after** (agent-review gate)
- Agents cannot move tasks directly to `done` — only Clara can
- `human-review` replaces any notion of "blocked" — always has a path forward

---

## MCP servers

Three MCP servers ship with Mission Control and are auto-configured during install:

| Server | Tools | Purpose |
|---|---|---|
| `mission-control_db` | `task_create`, `task_update`, `task_list`, `task_add_activity`, `chat_post`, `chat_read`, `approval_create` + more | Read/write the platform database |
| `memory` | `memory_search`, `memory_recall`, `memory_write`, `memory_read` | Hybrid BM25/vector memory vault |
| `cron` | `schedule_create`, `schedule_list` | Schedule recurring jobs |

These are registered in `~/mission-control/.mcp.json` and `.claude/settings.json` so any Claude Code session in the project directory has full access.

---

## Google Workspace integration

Mission Control integrates Gmail and Google Calendar via the [googleapis](https://www.npmjs.com/package/googleapis) npm package and OAuth2.

Connect in the in-app setup wizard (Step 5) or later via Settings → Google Workspace → Connect.

**API access:** Gmail inbox, send, archive; Calendar events, create, RSVP.

---

## Voice

Voice uses [Gemini Live](https://ai.google.dev/gemini-api/docs/live) for real-time bi-directional audio.

1. Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Enter it in the setup wizard (Step 4) or Settings → Voice

---

## Memory search

Memory search uses a cascading backend:
1. **QMD** (preferred) — hybrid BM25/vector search. Auto-installed via `brew install profroggo/tap/qmd`
2. **ripgrep** — fast full-text fallback. Install: `brew install ripgrep`
3. **None** — shows a clear "search unavailable" message in the UI with install instructions

---

## Security

- **API keys** are stored in the OS keychain (macOS Keychain / Linux Secret Service) via `keytar`, never in plaintext SQLite
- **Agent permissions** are scoped by trust tier — new agents start as apprentices
- **External actions** (emails, deploys, tweets) require human approval before execution
- **Approval tiers** (0–3) gate actions from read-only to external writes

---

## Troubleshooting

**Build failed during install**
- Run `mission-control build` to retry the Next.js build

**Agents won't spawn**
- Check `CLAUDE_BIN`: `which claude` should return a path
- Verify Claude Code is authenticated: `claude auth login`

**Google OAuth fails**
- Use the OAuth connect button in Settings → Google Workspace

**App won't start**
- Check logs: `mission-control logs`
- Verify port is free: `lsof -i :3000`
- Rebuild: `mission-control build`

**Database errors**
- The DB auto-migrates on startup — re-running `mission-control restart` usually fixes schema issues

**Memory search not working**
- Install ripgrep (`brew install ripgrep`) for basic search, or QMD for hybrid search
- Check Settings for the current search backend status

---

## License

AGPL-3.0 — see [LICENSE](LICENSE)

---

*Built on [Next.js](https://nextjs.org), [Claude Code CLI](https://docs.anthropic.com/claude-code), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), and [Lucide](https://lucide.dev).*
