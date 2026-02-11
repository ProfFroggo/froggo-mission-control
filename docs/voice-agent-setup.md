# Voice Agent Setup & Requirements

## Architecture
The voice agent uses **Gemini Live API** (WebSocket) for real-time bidirectional audio. It runs entirely in the Electron renderer process, NOT through OpenClaw gateway.

### Key Files
- `src/components/VoiceChatPanel.tsx` — UI, tool definitions, system instruction builder
- `src/lib/geminiLiveService.ts` — WebSocket connection to Gemini Live API
- `src/lib/agentContext.ts` — Loads workspace files (SOUL.md, AGENTS.md, etc.) via exec
- `electron/main.ts` — `exec:run` IPC handler for shell commands
- `electron/shell-security.ts` — Command allowlist/blocklist for security

## Tool Execution Flow
1. Gemini calls a function (e.g., `list_tasks`)
2. `VoiceChatPanel` receives `tool-call` event
3. `executeToolCall()` runs the command via `window.clawdbot.exec.run()`
4. Electron preload bridges to `ipcMain.handle('exec:run')` in main process
5. `secureExec()` validates command against allowlist
6. Result returned to Gemini via `sendToolResponse()`

## Available Tools
- `create_task` — Create tasks via froggo-db
- `update_task` — Update task status/priority/assignee
- `list_tasks` — Query tasks from database
- `spawn_agent` — Send messages to other agents
- `get_agent_status` — Check agent personality, tasks, sessions
- `read_file` — Read workspace files
- `run_command` — Shell commands (allowlist: cat, head, tail, ls, find, grep, froggo-db, git, clawdbot, date, echo, wc)
- `send_message` — Send to Discord
- `search_workspace` — Grep workspace files

## Context Files Loaded
For each agent, the following are loaded into the system instruction:
- `SOUL.md` — Core identity
- `USER.md` — Human context
- `IDENTITY.md` — Identity details
- `AGENTS.md` — Agent instructions
- `TOOLS.md` — Tool reference
- `PLATFORM_CONTEXT.md` — Platform context
- `MEMORY.md` — Long-term memory
- `memory/{today}.md` — Daily memory

## Critical: PATH Configuration
The `exec:run` handler MUST include `/opt/homebrew/bin` in PATH. Electron apps launched from Dock don't inherit the user's shell PATH. Without this, `froggo-db`, `clawdbot`, and other Homebrew-installed tools fail with "command not found".

## Troubleshooting
- **"Exec not available"** — `window.clawdbot.exec.run` not defined. Running outside Electron?
- **"command not found"** — PATH missing in exec handler. Check `electron/main.ts` exec:run.
- **Tool not working** — Check `shell-security.ts` SAFE_PREFIXES and VoiceChatPanel allowlist.
- **No context loaded** — `loadWorkspaceFiles()` returns `{}` if exec not available.
