# Mission Control

**A self-hosted AI agent platform built for Claude Code CLI.** Mission Control gives you a persistent local dashboard that runs a team of AI agents — they handle tasks, triage your inbox, manage your calendar, write code, research, and more.

![Mission Control Dashboard](public/og-image.png)

---

## What it does

Mission Control is your personal AI operations center. It ships with:

- **15 agents** — Hire from the catalog: Inbox, Coder, Designer, Researcher, Clara (QA), Chief, HR, Writer, Social Manager, Finance, Growth Director, Discord Manager, Voice, Senior Coder, and the Mission Control orchestrator
- **17 modules** — Install what you need: Kanban, Analytics, Approvals, Chat Rooms, Calendar, Gmail Inbox, Finance, Library, and more
- **Comms Inbox** — Gmail integration with AI-powered triage (Smart Inbox)
- **Google Calendar** — Today's schedule widget and full Epic Calendar view
- **Task system** — Full lifecycle: todo → in-progress → review → done, with agent auto-dispatch
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

```bash
npm install -g froggo-mission-control
mission-control
```

That's it. The two commands handle everything:

**`npm install -g froggo-mission-control`** — downloads the package, installs all dependencies, compiles the three MCP servers, and builds the Next.js app. Takes 2–3 minutes. No interaction needed.

**`mission-control`** — interactive setup wizard:
1. Checks Claude Code CLI is installed (offers to install if missing)
2. Asks for your Gemini API key
3. Creates `~/mission-control/` directory structure
4. Writes your `.env`, `.mcp.json`, and `.claude/settings.json`
5. Sets up an Obsidian-compatible memory vault
6. Installs a LaunchAgent (macOS) or systemd service (Linux) — auto-starts at login, auto-restarts on crash
7. Opens your browser to the setup wizard

**After setup:** The app runs at `http://localhost:3000` persistently. It starts automatically when you log in. No tmux, no terminal window needed.

### Manual / from source

```bash
git clone https://github.com/ProfFroggo/froggo-mission-control.git
cd froggo-mission-control
./install.sh
```

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

~/git/froggo-Mission-Control/  # The platform code (this repo)
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
│   ├── settings.json.template # Claude Code settings (generated by install.sh)
│   └── skills/                # Reusable skill files for agents
├── install.sh                 # One-command installer
├── .env.example               # Environment variable template
└── ecosystem.config.js        # pm2 config (alternative to LaunchAgent)
```

---

## Updating

```bash
cd ~/git/froggo-Mission-Control
git pull
npm run build
launchctl stop com.mission-control.app   # macOS
# or: systemctl --user restart mission-control  # Linux
```

---

## Manual start / stop

```bash
# Start (if LaunchAgent is not installed)
cd ~/git/froggo-Mission-Control
npm start

# Stop LaunchAgent (macOS)
launchctl stop com.mission-control.app

# View logs (macOS)
tail -f ~/Library/Logs/mission-control-app.log

# View logs (Linux)
journalctl --user -fu mission-control
```

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

These are registered in `.claude/settings.json` (generated by `install.sh`) so any Claude Code session in the project directory has full access.

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
- Rebuild: `npm run build`

**Database errors**
- The DB auto-migrates on startup — re-running `npm start` usually fixes schema issues

---

## License

AGPL-3.0 — see [LICENSE](LICENSE)

---

*Built on [Next.js 15](https://nextjs.org), [Claude Code CLI](https://docs.anthropic.com/claude-code), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), and [Lucide](https://lucide.dev).*
