# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Kevin can create a new book project by conversing with an AI agent that plans the story arc, chapter outline, themes, and characters -- then write in a 3-pane layout where AI chat dialogue drives content into the workspace.
**Current focus:** Phase 11 - Chat Pane + 3-Pane Layout

## Current Position

Phase: 11 of 12 (Chat Pane + 3-Pane Layout)
Plan: -- (not yet planned)
Status: Ready to plan
Last activity: 2026-02-13 -- Roadmap created for v2.1

Progress: [########################..........] 24/26 reqs mapped, 0 plans complete

## Performance Metrics

**Velocity (v1):**
- Total plans completed: 12
- Average duration: ~13min
- Total execution time: ~161min

**Velocity (v2):**
- Plans completed: 12
- Average duration: ~3min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

v1 decisions carried forward:
- Keep preload namespace as `clawdbot` (cosmetic rename deferred)
- Keep electron/main.ts as monolith (breakup deferred)
- New IPC handlers go in dedicated service files under electron/
- All paths through electron/paths.ts

v2 decisions carried forward:
- TipTap v3.19.0 as rich text editor
- File-based storage for writing projects (project.json + chapters.json + .md files on disk)
- Separate writingStore (not merged into store.ts)
- bridge() accessor helper for safe IPC access in writingStore
- JSONL per-chapter feedback logs
- Per-project research.db (not shared) for data isolation
- File-copy version snapshots (not git-based)

v2.1 decisions:
- Only 2 new packages: react-resizable-panels v4.6.2, @tiptap/markdown v3.19.0
- Separate stores: chatPaneStore.ts, wizardStore.ts (following feedbackStore pattern)
- Gateway session key namespacing: chat, feedback, wizard isolated
- pendingInsert in writingStore for chat-to-editor communication
- Chat history persisted to disk per project
- Wizard state persisted to wizard-state.json for resume-on-restart

### Pending Todos

- None

### Blockers/Concerns

- None

## Session Continuity

Last session: 2026-02-13
Stopped at: Roadmap created for v2.1
Resume file: None
