# Mission Control

**A self-hosted AI agent platform built for Claude Code CLI.** Mission Control gives you a persistent local dashboard that runs a team of AI agents — they handle tasks, triage your inbox, manage your calendar, write code, research, and more.

[![npm version](https://img.shields.io/npm/v/froggo-mission-control.svg)](https://www.npmjs.com/package/froggo-mission-control)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

---

## What it does

Mission Control is your personal AI operations center. It ships with:

- **15 agents** — Hire from the catalog: Inbox, Coder, Designer, Researcher, Clara (QA), Chief, HR, Writer, Social Manager, Finance, Growth Director, Discord Manager, Voice, Senior Coder, and the Mission Control orchestrator
- **18 modules** — Install what you need: Kanban, Analytics, Approvals, Chat Rooms, Calendar, Gmail Inbox, Finance, Library, Projects, Voice, Writing, Meetings, and more
- **Comms Inbox** — Gmail integration with AI-powered triage (Smart Inbox)
- **Google Calendar** — Today's schedule widget and full Epic Calendar view
- **Task system** — Full lifecycle: todo → internal-review → in-progress → review → human-review → done, with agent auto-dispatch and Clara QA gate
- **Projects** — Kanban boards, agent dispatch, shared chat rooms, file library
- **Memory vault** — Obsidian-compatible knowledge base that agents read/write across sessions
- **Voice** — Real-time voice interface via Gemini Live
- **MCP servers** — Native Claude Code CLI integration for task management, memory search, and scheduling

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org) |
| **Claude Code CLI** | Latest | [install guide](https://docs.anthropic.com/claude-code) — requires active Claude subscription |
| **Gemini API key** | — | Required for Voice. Free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Git** | Any | For cloning + updates |
| **macOS** or **Linux** | — | Windows not tested |

**Optional:**
- **Google Workspace** — Gmail + Calendar integration (OAuth setup in the app wizard)
- **QMD** — Hybrid BM25/vector memory search (`brew install profroggo/tap/qmd` once available)
- **Obsidian** — For browsing the memory vault (any vault reader works)

---

## Installation

### Option A — npm (recommended)

```bash
# Step 1 — install (2–3 min, fully automatic)
npm install -g froggo-mission-control

# Step 2 — setup wizard (~2 min, interactive)
mission-control
```

**What `npm install -g` does automatically:**
- Downloads the package and all dependencies
- Compiles the 3 MCP servers (`mission-control-db-mcp`, `memory-mcp`, `cron-mcp`)
- Runs `next build` — full production build of the dashboard

---

### Option B — install.sh (clone + run)

```bash
git clone https://github.com/ProfFroggo/froggo-mission-control.git
cd froggo-mission-control
./install.sh
```

**What `install.sh` does automatically:**
- Checks prerequisites (Node.js 20+, Claude Code CLI, Git)
- Installs all npm dependencies
- Compiles the 3 MCP servers
- Builds the Next.js dashboard (`next build`)
- Creates the full `~/mission-control/` directory tree
- Generates `.env`, `.mcp.json`, and `.claude/settings.json` configured for your machine
- Sets up an Obsidian-compatible memory vault skeleton
- Installs a **LaunchAgent** (macOS) or **systemd service** (Linux) — persistent, auto-start at login, auto-restart on crash
- Opens the app in your browser when ready

---

### What `mission-control` does (interactive wizard — npm install only)

1. Checks Claude Code CLI is installed — offers to install it if missing
2. Asks for your Gemini API key (+ optional Anthropic key, port)
3. Creates the entire `~/mission-control/` directory tree
4. Generates `.env`, `.mcp.json`, and `.claude/settings.json` configured for your machine
5. Sets up an Obsidian-compatible memory vault skeleton
6. Installs a **LaunchAgent** (macOS) or **systemd service** (Linux) — persistent, auto-start at login, auto-restart on crash
7. Waits for the server, opens your browser

**After setup:** Mission Control runs at `http://localhost:3000` persistently. It starts automatically when you log in. No tmux, no terminal window needed.

---

## First run — setup wizard

On first launch, the wizard walks you through:

1. **Google Workspace** — connect Gmail and Calendar via OAuth
2. **Agent catalog** — hire your first agents (Mission Control + Inbox are core and always active)
3. **Modules** — install the modules you want (Kanban, Analytics, etc.)
4. **Voice** — enter your Gemini API key to enable the voice interface

---

## What gets installed where

```
~/mission-control/
├── data/
│   ├── mission-control.db     # SQLite database (all tasks, agents, chat, etc.)
│   ├── google-tokens.json     # Google OAuth tokens (auto-managed)
│   └── schedule.json          # Cron job schedule
├── memory/                    # Obsidian-compatible agent memory vault
│   ├── agents/                # Per-agent memory files
│   ├── knowledge/             # Knowledge base articles
│   ├── sessions/              # Session logs
│   └── daily/                 # Daily notes
├── library/                   # All agent output files
│   ├── code/
│   ├── design/
│   └── docs/
├── agents/                    # Per-agent workspaces (SOUL.md, MEMORY.md)
└── logs/

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
│   ├── lib/                   # Server-side logic (db, env, agent dispatch)
│   ├── modules/               # Pluggable feature modules
│   ├── stores/                # Zustand client stores
│   └── types/                 # TypeScript types
├── catalog/
│   ├── agents/                # Agent manifests + soul files + avatars
│   └── modules/               # Module manifests
├── tools/
│   ├── mission-control-db-mcp/  # MCP server: task/agent/chat DB tools
│   ├── memory-mcp/              # MCP server: memory vault read/write/search
│   ├── cron-mcp/                # MCP server: schedule management
│   └── hooks/                   # Claude Code CLI hooks
├── .claude/
│   ├── CLAUDE.md              # Platform instructions for agents
│   ├── settings.json.template # Claude Code settings (generated by `mission-control setup`)
│   └── skills/                # Reusable skill files for agents
├── install.sh                 # One-command installer
├── .env.example               # Environment variable template
└── ecosystem.config.js        # pm2 config (alternative to LaunchAgent)
```

---

## Commands

```bash
mission-control              # setup wizard on first run, status otherwise
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
- Access to MCP tools: `mcp__mission-control_db__*` for tasks/chat, `mcp__memory__*` for the vault

The platform dispatches tasks to agents automatically. Agents report progress via MCP, update task status, and store learnings in the memory vault.

---

## MCP servers

Three MCP servers ship with Mission Control and are auto-configured during install:

| Server | Tools | Purpose |
|---|---|---|
| `mission-control_db` | `task_create`, `task_update`, `task_list`, `chat_post`, `chat_read`, `approval_create` + more | Read/write the platform database |
| `memory` | `memory_search`, `memory_recall`, `memory_write`, `memory_read` | Hybrid BM25/vector memory vault |
| `cron` | `schedule_create`, `schedule_list` | Schedule recurring jobs |

These are registered in `.claude/settings.json` (generated by `mission-control setup`) so any Claude Code session in the project directory has full access.

---

## Google Workspace integration

Mission Control integrates Gmail and Google Calendar via the [googleapis](https://www.npmjs.com/package/googleapis) npm package and OAuth2.

**Recommended auth setup:**
1. Install [gogcli](https://github.com/googleworkspace/cli): `npm install -g @googleworkspace/cli`
2. Run `gog login` — stores credentials at `~/Library/Application Support/gogcli/credentials.json`
3. In Mission Control → Settings → Google Workspace → Connect → authenticate via browser

Mission Control automatically uses gogcli credentials if present, so no manual client setup is needed.

**API access:** Gmail inbox, send, archive; Calendar events, create, RSVP.

---

## Voice

Voice uses [Gemini Live](https://ai.google.dev/gemini-api/docs/live) for real-time bi-directional audio.

1. Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Add it in Settings → Voice, or set `GEMINI_API_KEY` in `.env`

---

## Troubleshooting

**Agents won't spawn**
- Check `CLAUDE_BIN`: `which claude` should return a path
- Verify Claude Code is authenticated: `claude auth login`

**Google OAuth fails**
- Install gogcli: `npm install -g @googleworkspace/cli`
- Run `gog login` and authorize in browser

**App won't start**
- Check logs: `tail -f ~/Library/Logs/mission-control-app.log`
- Verify port is free: `lsof -i :3000`
- Rebuild: `mission-control build`

**Database errors**
- The DB auto-migrates on startup — re-running `npm start` usually fixes schema issues

---

## License

AGPL-3.0 — see [LICENSE](LICENSE)

---

*Built on [Next.js 15](https://nextjs.org), [Claude Code CLI](https://docs.anthropic.com/claude-code), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), and [Lucide](https://lucide.dev).*
