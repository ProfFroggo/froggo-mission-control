# Froggo.app — AI-Powered Writing System

## What This Is

Froggo.app is an Electron desktop dashboard for managing a 15-agent OpenClaw AI orchestration platform. It controls task lifecycle (Kanban), agent spawning, multi-channel communications, voice chat, analytics, and approval workflows. Built with React + Vite + Electron, backed by SQLite and the OpenClaw gateway.

v2.0 added a writing module with editor, inline feedback, memory stores, and multi-agent collaboration. v2.1 redesigned the UX into an AI-powered book creation system with a conversational setup wizard, 3-pane layout (chapters | AI chat | workspace), and agent-driven content flow.

## Core Value

Kevin can create a new book project by conversing with an AI agent that plans the story arc, chapter outline, themes, and characters — then write in a 3-pane layout where AI chat dialogue drives content into the workspace.

## Requirements

### Validated

- ✓ Kanban board with drag-and-drop task management — v1
- ✓ Agent panel showing all 15 agents with status — v1
- ✓ Multi-channel chat (Telegram, Discord, WhatsApp, webchat) — v1
- ✓ Approval inbox with keyboard shortcuts (Gmail-style) — v1
- ✓ Voice chat via Gemini Live with reconnect — v1
- ✓ Analytics dashboard with token tracking — v1
- ✓ Morning brief with calendar/mentions/tasks — v1
- ✓ Settings panel with panel config customization — v1
- ✓ Agent dispatcher (pure Python, LaunchAgent, every 60s) — v1
- ✓ Task lifecycle: todo → internal-review → in-progress → review → done — v1
- ✓ Global search across messages, tasks, agents — v1
- ✓ Export/backup system — v1
- ✓ Security hardening (credentials, SQL injection, IPC lockdown) — v1
- ✓ All broken features fixed (paths, spawn, CLI refs) — v1
- ✓ Functional fixes (routing, guards, debounce, memo) — v1
- ✓ Dead code cleanup — v1
- ✓ Writing projects with chapter-based editor and autosave — v2.0
- ✓ Inline feedback with streaming AI alternatives (Writer, Researcher, Jess) — v2.0
- ✓ Memory store (characters, timeline, facts) with AI context injection — v2.0
- ✓ Research library with per-project SQLite and fact-checking — v2.0
- ✓ Chapter outline with drag-and-drop reordering — v2.0
- ✓ Version snapshots with diff comparison — v2.0
- ✓ 3-pane resizable layout (chapters | AI chat | workspace) — v2.1
- ✓ Persistent AI chat with streaming responses and agent switching — v2.1
- ✓ Chat-to-editor content insertion — v2.1
- ✓ Conversational setup wizard (brain dump → AI planning → review → create) — v2.1
- ✓ Atomic project creation from wizard (chapters, characters, timeline) — v2.1
- ✓ Genre flexibility beyond memoir/novel — v2.1

### Current Milestone: v3.0 — App-Wide Polish & X/Twitter Overhaul

**Goal:** Every page functions correctly in dark mode, X/Twitter page fully rebuilt, Finance page works end-to-end, Writing panes usable, Library has real data.

**Target features:**
- Global dark mode consistency (all inputs, chat bubbles, borders)
- Uniform chat dialogue component across all pages
- X/Twitter: X logo, fully dark-mode, working calendar (drag-to-reschedule), rebuilt automation builder, analytics tab, correct tab order, approval panels removed from non-content tabs
- Writing: pane min-widths fixed, double-bar visible
- Library: skills populated, file tagging, expanded categories
- Finance: all features functional (insights, upload, chat, budgets)

### Active

### Out of Scope

- Real-time multi-user collaboration (CRDT/OT) — single-user workflow
- AI autocomplete/ghost text — destroys creative voice (anti-feature from research)
- AI-generated first drafts — user writes, AI assists
- "Generate entire book" button — results are generic, keep human in loop
- electron/main.ts monolith breakup — tracked but separate effort
- preload namespace rename (clawdbot → openclaw) — cosmetic, deferred

## Context

### Architecture

- Existing dashboard: React + TypeScript + Vite + Electron + Tailwind + Zustand
- Rich text editor: TipTap v3.19.0 with Selection and Markdown extensions
- File-based chapters (markdown, git-friendly) + SQLite for structured data (sources, facts)
- OpenClaw Gateway integration for agent communication (WebSocket)
- 3-pane layout: react-resizable-panels v4.6.2
- Gateway session key isolation: 4 distinct keys (chat, feedback, wizard, wizard-extract)

### Dev Guide Rules

- All work on feature branches off `dev`, PRs to `dev`, then `dev` → `main`
- All paths through `electron/paths.ts` — never hardcoded
- New services in separate `electron/*.ts` files — don't expand main.ts monolith
- Schema changes need migration files in `migrations/`
- Test with `build:dev` before PRs

## Constraints

- **Stack**: React + TypeScript + Electron (existing) — new deps only where essential
- **Architecture**: New IPC handlers in dedicated service files, not main.ts
- **Paths**: All new paths through `electron/paths.ts`
- **Branching**: Feature branches off `dev`, PRs to `dev`
- **DB**: File-based for chapters (markdown), SQLite for structured data
- **Backward compatible**: Existing dashboard features must keep working
- **Single user**: No multi-user collaboration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep preload namespace as `clawdbot` | Renaming would touch every component for cosmetic gain | ✓ Good (v1) |
| Keep electron/main.ts as monolith | Breakup is too large for hardening scope | ✓ Good (v1) |
| Move credentials to env vars / keychain | Industry standard, no hardcoded secrets | ✓ Good (v1) |
| File-based chapters + SQLite for structured data | Markdown is git-friendly and AI-parseable, SQLite for queries | ✓ Good (v2.0) |
| Inline feedback as core UX pattern | Replaces traditional comments/track-changes for AI collaboration | ✓ Good (v2.0) |
| TipTap v3.19.0 for editor | Selection tracking, inline widgets, markdown extension support | ✓ Good (v2.0) |
| Separate Zustand stores per feature | chatPaneStore, wizardStore, feedbackStore — isolated concerns | ✓ Good (v2.1) |
| react-resizable-panels v4 for layout | Lightweight, well-maintained, supports collapse detection | ✓ Good (v2.1) |
| Gateway session key namespacing | 4 distinct keys prevent context contamination across features | ✓ Good (v2.1) |
| pendingInsert bridge pattern | Decoupled cross-pane content flow via Zustand | ✓ Good (v2.1) |
| Prompt-level JSON extraction for wizard | No tool-calling needed, Zod validates AI output | ✓ Good (v2.1) |
| Atomic project creation with rollback | rm -rf on partial directory if any write fails | ✓ Good (v2.1) |
| ProjectMeta.type as string (not union) | Genre flexibility for wizard, existing values still valid | ✓ Good (v2.1) |

---
*Last updated: 2026-02-17 after v3.0 milestone started*
