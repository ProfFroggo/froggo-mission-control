# Froggo.app — AI-Powered Writing System

## What This Is

Froggo.app is an Electron desktop dashboard for managing a 15-agent OpenClaw AI orchestration platform. It controls task lifecycle (Kanban), agent spawning, multi-channel communications, voice chat, analytics, and approval workflows. Built with React + Vite + Electron, backed by SQLite and the OpenClaw gateway.

This milestone adds an AI-collaborative long-form writing module — a chapter-based editor with inline feedback, multi-agent collaboration (Writer, Researcher, Jess), memory stores for character/timeline/fact consistency, and context management for 1000+ page documents.

## Core Value

Kevin can write a complete memoir using AI-collaborative inline feedback — highlight any passage, get contextual alternatives from the right agent, and maintain consistency across hundreds of chapters.

## Current Milestone: v2.0 Writing System

**Goal:** Build a modular writing workspace inside Froggo.app that enables AI-collaborative long-form writing with inline feedback, multi-agent support, and consistency management.

**Target features:**
- Project creation and chapter-based document structure
- Rich text editor with markdown support and inline feedback (highlight → chat → iterate)
- Multi-agent feedback (Writer for style/pacing, Researcher for fact-checking, Jess for emotional guidance)
- Memory store (characters, timeline, facts) with consistency checking
- Multi-tier context management for large documents
- Research library with source tracking
- Version history per chapter

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

### Active

- [ ] Writing project creation, selection, and file-based storage
- [ ] Chapter editor with rich text and markdown support
- [ ] Inline feedback system (highlight → chat → iterate with AI alternatives)
- [ ] Writer agent integration for style, pacing, and narrative feedback
- [ ] Researcher agent integration for fact-checking and source tracking
- [ ] Jess agent integration for emotional/memoir-specific guidance
- [ ] Memory store: character profiles, timeline events, verified facts
- [ ] Multi-tier context management (hot/warm/cold/archived)
- [ ] Research library with source database
- [ ] Chapter versioning
- [ ] Outline mode with chapter navigation
- [ ] Consistency checking across chapters

### Out of Scope

- Real-time multi-user collaboration (CRDT/OT) — single-user workflow for now
- PDF/ePub export — defer to v3
- Vector search for semantic retrieval — defer to v3
- Story arc visualization — defer to v3
- electron/main.ts monolith breakup — tracked but separate effort
- preload namespace rename (clawdbot → openclaw) — cosmetic, deferred

## Context

### Design Document (2026-02-10)

Chief produced a comprehensive writing system design (`agent-chief/writing-system-design.md`) covering:
- Agent workflow requirements (Writer, Researcher, Jess)
- Project structure (file-based with SQLite for structured data)
- Multi-tier context management for 1000+ page documents
- Inline feedback system (core innovation)
- Dashboard layout with left sidebar, center workspace, right context panel
- 6-phase implementation plan

### Key Architecture Facts

- Existing dashboard: React + TypeScript + Vite + Electron + Tailwind + Zustand
- Rich text editor needed: TipTap or ProseMirror (selection tracking, inline widgets)
- File-based chapters (markdown, git-friendly) + SQLite for structured data (sources, facts)
- OpenClaw Gateway integration for agent communication
- 200k token context window budget: ~60k hot + ~30k warm + ~20k cold + ~90k working space

### Dev Guide Rules

- All work on feature branches off `dev`, PRs to `dev`, then `dev` → `main`
- All paths through `electron/paths.ts` — never hardcoded
- New services in separate `electron/*.ts` files — don't expand main.ts monolith
- Schema changes need migration files in `migrations/`
- Test with `build:dev` before PRs

## Constraints

- **Stack**: React + TypeScript + Electron (existing) — new deps only where essential (rich text editor)
- **Architecture**: New IPC handlers in dedicated service files, not main.ts
- **Paths**: All new paths through `electron/paths.ts`
- **Branching**: Feature branches off `dev`, PRs to `dev`
- **DB**: File-based for chapters (markdown), SQLite for structured data
- **Backward compatible**: Existing dashboard features must keep working
- **Single user**: No multi-user collaboration in this milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep preload namespace as `clawdbot` | Renaming would touch every component for cosmetic gain | ✓ Good (v1) |
| Keep electron/main.ts as monolith | Breakup is too large for hardening scope | ✓ Good (v1) |
| Move credentials to env vars / keychain | Industry standard, no hardcoded secrets | ✓ Good (v1) |
| File-based chapters + SQLite for structured data | Markdown is git-friendly and AI-parseable, SQLite for queries | — Pending |
| Inline feedback as core UX pattern | Replaces traditional comments/track-changes for AI collaboration | — Pending |
| TipTap or ProseMirror for editor | Need selection tracking and inline widget support | — Pending |

---
*Last updated: 2026-02-12 after milestone v2.0 initialization*
