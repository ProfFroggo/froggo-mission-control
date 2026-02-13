# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Kevin can create a new book project by conversing with an AI agent that plans the story arc, chapter outline, themes, and characters -- then write in a 3-pane layout where AI chat dialogue drives content into the workspace.
**Current focus:** Phase 12 - Setup Wizard

## Current Position

Phase: 12 of 12 (Setup Wizard)
Plan: 04 of 04 complete (code complete, pending human verification)
Status: Phase complete (pending verification checkpoint)
Last activity: 2026-02-13 -- Completed 12-04-PLAN.md

Progress: [####################################] 19/26 v2.1 reqs complete (code)

## Performance Metrics

**Velocity (v1):**
- Total plans completed: 12
- Average duration: ~13min
- Total execution time: ~161min

**Velocity (v2):**
- Plans completed: 14
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
- ChatMessage timestamp uses numeric Date.now() (consistent with feedbackStore)
- writingContext.ts functions are pure (no hooks/store) for cross-component reuse
- JSONL append-only format for chat history (matches feedback log pattern)
- v4 Layout type is {[id:string]:number} object map, not number[] array
- Panel collapse detection via onResize PanelSize.asPercentage === 0 (no onCollapse/onExpand in v4)
- Agent preambles in ChatPane are writing-assistant focused (not edit-focused like FeedbackPopover)
- Chat messages persist to disk after streaming completes (not during)
- contentType:'markdown' for all AI content insertion into TipTap editor
- Session key format: agent:{id}:writing:{projectId}:{feedback|chat} for full isolation
- Collapse state persisted separately from layout in localStorage (writing-collapsed key)
- Retry removes assistant + preceding user message and prefills input
- ProjectMeta.type and WritingProject.type changed from union to string for genre flexibility (WIZARD-11)
- Wizard state stored in _wizard-state/{sessionId}/ under WRITING_PROJECTS_DIR
- WizardChat uses inline textarea (no agent picker) since agent is chosen in braindump step
- Generate Plan requires minimum 2 messages before enabling
- Separate gateway session keys: wizard (conversation) vs wizard-extract (extraction)
- Characters stored with 'relationship' field in memory (mapped from wizard 'role')
- project.json extended with genre, premise, themes, storyArc, wizardComplete for wizard projects
- Atomic creation with rollback: rm -rf on partial project directory if any write fails
- Resume banner inline above ProjectSelector (not modal) for non-intrusive UX
- Plan preview sidebar 280px fixed width, conditionally rendered when plan exists

### Pending Todos

- None

### Blockers/Concerns

- None

## Session Continuity

Last session: 2026-02-13T04:03:45Z
Stopped at: Completed 12-04-PLAN.md (code complete, checkpoint pending)
Resume file: None
