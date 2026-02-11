# Froggo.app Dashboard Hardening

## What This Is

Froggo.app is an Electron desktop dashboard for managing a 15-agent OpenClaw AI orchestration platform. It controls task lifecycle (Kanban), agent spawning, multi-channel communications (Telegram, Discord, WhatsApp, X/Twitter), voice chat (Gemini Live), analytics, and approval workflows. Built with React + Vite + Electron, backed by SQLite (froggo.db) and the OpenClaw gateway (WebSocket on port 18789).

This milestone takes the app from "functional but accumulated tech debt" to production-grade: secure, debloated, modular, and fully wired.

## Core Value

Kevin can trust that Froggo.app is secure (no leaked credentials), reliable (no crashes from null guards or malformed data), and honest (every button works, every indicator reflects reality).

## Requirements

### Validated

- ✓ Kanban board with drag-and-drop task management — existing
- ✓ Agent panel showing all 15 agents with status — existing
- ✓ Multi-channel chat (Telegram, Discord, WhatsApp, webchat) — existing
- ✓ Approval inbox with keyboard shortcuts (Gmail-style) — existing
- ✓ Voice chat via Gemini Live with reconnect — existing
- ✓ Analytics dashboard with token tracking — existing
- ✓ Morning brief with calendar/mentions/tasks — existing
- ✓ Settings panel with panel config customization — existing
- ✓ Agent dispatcher (pure Python, LaunchAgent, every 60s) — existing
- ✓ Task lifecycle: todo → internal-review → in-progress → review → done — existing
- ✓ Global search across messages, tasks, agents — existing
- ✓ Export/backup system — existing

### Active

- [ ] Remove all hardcoded credentials from source code
- [ ] Close DevTools in production builds
- [ ] Fix all SQL injection vulnerabilities
- [ ] Lock down filesystem/DB IPC handlers
- [ ] Fix wrong DB paths (~/Froggo/ → ~/clawd/)
- [ ] Fix all stale clawdbot → openclaw CLI references
- [ ] Fix broken features (spawn script, missing IPC, layout bug)
- [ ] Fix task routing (stop defaulting everything to coder)
- [ ] Add error boundaries to all panels
- [ ] Fix race conditions (sendChat, double listeners, debounce collision)
- [ ] Remove ~1,200+ lines of dead code
- [ ] Delete orphaned/duplicate files
- [ ] Consolidate competing implementations
- [ ] Guard all JSON.parse and IPC calls against null/malformed data
- [ ] Fix Kanban activity indicators and memo comparator
- [ ] Fix dynamic Tailwind classes (AgentPanel hover)
- [ ] Remove PII from source (emails, phone numbers)
- [ ] Fix chatRoomStore localStorage overflow risk
- [ ] Wrap DMFeed in error boundary (ProtectedPanels)
- [ ] Fix phantom task creation in store (approveItem/adjustItem)

### Out of Scope

- New features — this is hardening, not feature development
- electron/main.ts monolith breakup — too large for this milestone, tracked for future
- Redesigning the UI — only fixing what's broken/inconsistent
- Migrating preload namespace from `clawdbot` to `openclaw` — cosmetic, would touch every component
- "Coming soon" notification stubs — fine as placeholders

## Context

### Audit Findings (2026-02-11)

Four parallel audit agents produced ~120 findings across:
- **electron/main.ts + preload.ts** — 52 issues (14 HIGH, 13 MEDIUM)
- **UI components batch 1** — Kanban, Dashboard, Sidebar, InboxPanel, ChatPanel, ChatRoomView, AgentPanel
- **UI components batch 2** — Analytics, TokenUsage, VoiceChat, Settings, TaskDetail, GlobalSearch, MorningBrief
- **Store + lib + routing** — 14 functional, 17 cosmetic

### Key Architecture Facts

- `electron/main.ts` is 7,272 lines with 60+ IPC handlers (monolith, but out of scope to break up)
- `preload.ts` exposes ~135 IPC channels as `window.clawdbot.*`
- Two competing account services (JSON file vs SQLite)
- Two competing performance monitors (only one is used)
- Gateway auth token, Twitter tokens, Gemini key, encryption key all hardcoded
- 4 files reference deleted `~/Froggo/` path prefix
- 4 components reference old `clawdbot` CLI name
- `matchTaskToAgent` in lib/agents.ts and InboxPanel both hardcode routing to 4 agents

### Build Pipeline

- `npm run build` = Vite only (dev/web)
- `npm run electron:build` = tsc + vite + electron-builder → release/mac-arm64/Froggo.app
- Must run `electron:build` for changes to appear in packaged app

## Constraints

- **No new dependencies** — fixes should use existing libraries
- **No feature changes** — users should not notice behavioral differences except bugs disappearing
- **Backward compatible** — existing localStorage data, froggo.db schema, gateway protocol must all work
- **Test every change** — build must pass, app must launch, affected features must be manually verified
- **Accountability gate** — before each change: "will this break anything?" / "will this make the app better?"

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep preload namespace as `clawdbot` | Renaming would touch every component for cosmetic gain | — Pending |
| Keep electron/main.ts as monolith | Breakup is too large for hardening scope | — Pending |
| Move credentials to env vars / keychain | Industry standard, no hardcoded secrets | — Pending |
| Wave-based execution (security → broken → functional → cleanup) | Fix worst issues first, each wave leaves app in better state | — Pending |

---
*Last updated: 2026-02-11 after initialization*
