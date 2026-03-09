# Mission Control

**A self-hosted AI agent platform built for Claude Code CLI.** Mission Control gives you a persistent local dashboard that runs a team of AI agents — they handle tasks, triage your inbox, manage your calendar, write code, research, and more.

[![npm version](https://img.shields.io/npm/v/froggo-mission-control.svg)](https://www.npmjs.com/package/froggo-mission-control)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## What it does

Mission Control is your personal AI operations center. It ships with:

- **15 agents** — 5 core agents installed automatically (Mission Control, Clara, Coder, HR, Inbox), plus 10 optional agents available in the catalog: Senior Coder, Chief, Designer, Researcher, Writer, Social Manager, Finance Manager, Growth Director, Discord Manager, and Voice
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
4. Bootstraps 5 core agent workspaces from catalog templates (mission-control, clara, coder, hr, inbox)
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
git clone https://github.com/ProfFroggo/froggo-mission-control.git
cd froggo-mission-control
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
7. **Agent & Module Picker** — 5 core agents pre-selected; choose optional agents and modules from the catalog
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
│   ├── mission-control/       # Orchestrator — coordinates agents, manages task delegation
│   ├── clara/                 # QA review gate — mandatory quality checks before/after tasks
│   ├── coder/                 # Software engineer — features, bugs, tests, refactors
│   ├── hr/                    # Agent & team manager — hiring, onboarding, team ops
│   └── inbox/                 # Message triage — monitors comms, routes to agents
│   (+ any optional agents installed during setup wizard)
├── .claude/
│   └── settings.json          # Tool permissions + MCP server registrations + hooks
├── .mcp.json                  # MCP server config for Claude Code sessions
└── CLAUDE.md                  # Project context for all agent sessions

$(npm root -g)/froggo-mission-control/  # Platform code (npm global install)
```

### Core modules (always installed)

| Module | What it does |
|--------|-------------|
| **Chat** | Real-time AI chat with agents — primary interaction surface |
| **Tasks (Kanban)** | Full task pipeline: `todo → internal-review → in-progress → agent-review → done` |
| **Inbox** | Unified communications inbox with Gmail integration and AI triage |
| **Approvals** | Human-in-the-loop approval queue for agent actions and external writes |
| **Agent Management** | View, configure, and manage agents — trust tiers, models, personalities |
| **Library** | Browse and manage all agent output files (code, docs, designs, campaigns) |
| **Projects** | Project workspaces — tasks, chat rooms, files, and agent dispatch |
| **Schedule** | Calendar and cron-based scheduling for agent tasks and automation |
| **Notifications** | Platform-wide notification system for agent activity and events |
| **Settings** | Dashboard preferences, connected accounts, security, and configuration |

### Optional modules (install from the catalog)

| Module | What it does |
|--------|-------------|
| **Analytics** | Usage metrics, agent performance dashboards, token tracking |
| **Finance** | Multi-account finance tracking, AI categorization, budget management |
| **Meetings** | Meeting scheduling, agendas, notes, and action items |
| **Social Media** | X/Twitter command center — publish, drafts, research, calendar, mentions |
| **Voice Chat** | Real-time voice interaction with agents via browser microphone (Gemini Live) |
| **Writing** | AI-assisted long-form writing workspace with draft management |
| **Module Builder** | Visual builder for creating custom platform modules |
| **Dev Tools** | Platform internals, DB inspector, log viewer, debugging utilities |

---

## Directory layout (repo)

```
froggo-mission-control/
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

## Security & Compliance FAQ

This section answers common questions from security and legal reviewers.

### Credential Storage

All API keys and secrets are stored in the **OS Keychain** via [keytar](https://github.com/atom/node-keytar). Nothing sensitive is written to SQLite or `.env`. The `.env` file contains only non-secret configuration (ports, feature flags). Secret retrieval is centralized in `src/lib/keychain.ts`.

### Data Residency

All data — the SQLite database, the Obsidian Memory Vault, session logs, and agent output files — is stored **locally on the host machine**. Nothing is synced to a centralized cloud server.

- Database: `~/mission-control/data/mission-control.db`
- Memory vault (immutable audit trail): `~/mission-control/memory/sessions/`
- Agent output library: `~/mission-control/library/`

### Agent Trust Tier System

Agents are assigned one of five trust tiers that gate what actions they can take:

| Tier | Description |
|------|-------------|
| **Restricted** | Read-only. All writes are blocked and queued for human review. |
| **Apprentice** | Can read and write files/tasks. Cannot push to git or send external communications. |
| **Worker** | Full local access. Can draft external actions; cannot send without approval. |
| **Trusted** | Can send external communications. Cannot perform force-pushes or destructive operations without approval. |
| **Admin** | Full autonomy. Can bypass the approval queue for immediate execution. |

Tier enforcement is implemented at two layers: the `PreToolUse` hook (`tools/hooks/approval-hook.js`) intercepts every tool call, and the `/api/actions` route enforces tier checks before queuing or executing actions.

### Human-in-the-Loop (HITL) Architecture

High-risk actions — email sends, social media posts, git pushes, file deletions — cannot be executed autonomously by any agent below `admin` tier. The flow is:

1. Agent calls `POST /api/actions` with the action payload.
2. The platform creates a pending approval record visible in the **Approval Queue** dashboard tab.
3. A human operator reviews a rich preview (email layout, tweet card, danger box for destructive ops) and clicks **Approve & Run** or **Reject**.
4. On approval, the platform fires the executor script (`tools/executors/`) which routes through the local API (Google OAuth for email, twitter-api-v2 for X posts).

Scheduled actions follow the same flow but execute at the designated time only after prior human approval.

### Clara QA Gate

**Clara** (QA agent) acts as a mandatory quality and security gate in the task pipeline:

- **Before work starts**: Every task must pass `internal-review` — Clara verifies the plan, subtasks, and agent assignment before any agent picks up the work.
- **After work completes**: Agents cannot move tasks to `done` themselves. Only Clara can finalize after passing `agent-review`.
- Clara runs an automated sweep every 3 minutes via `src/lib/claraReviewCron.ts`.

### Observability & Audit Trail

Every agent session, tool call decision, and action execution is logged:

- Hook decisions logged to `analytics_events` table with tool name, tier, and decision.
- All approval records (including rejected/cancelled ones) are permanently stored.
- Session transcripts: `~/mission-control/memory/sessions/` — one file per session, append-only.

### Kill Switch

To immediately terminate all agent processes:

```bash
mission-control stop      # CLI kill switch
# Or via process manager:
pm2 stop all              # If running under PM2
launchctl stop com.froggo.mission-control   # macOS LaunchAgent
systemctl stop mission-control              # Linux systemd
```

---

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE)

---

*Built on [Next.js](https://nextjs.org), [Claude Code CLI](https://docs.anthropic.com/claude-code), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), and [Lucide](https://lucide.dev).*
