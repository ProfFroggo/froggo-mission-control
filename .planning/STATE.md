# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Kevin can write a complete memoir using AI-collaborative inline feedback -- highlight any passage, get contextual alternatives from the right agent, and maintain consistency across hundreds of chapters.
**Current focus:** Phase 6 — Inline Feedback (in progress)

## Current Position

Phase: 6 of 10 (Inline Feedback)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-12 — Completed 06-01-PLAN.md (Feedback State & Logging Service)

Progress: [████░░░░░░░░] 33% (4/12 plans)

## Performance Metrics

**Velocity (v1):**
- Total plans completed: 12
- Average duration: ~13min
- Total execution time: ~161min

**Velocity (v2):**
- Plans completed: 4
- 05-01: 3min (3 tasks)
- 05-02: 4min (2 tasks)
- 05-03: 5min (2 tasks + checkpoint skipped)
- 06-01: 2min (2 tasks)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

v1 decisions carried forward:
- Keep preload namespace as `clawdbot` (cosmetic rename deferred)
- Keep electron/main.ts as monolith (breakup deferred)
- New IPC handlers go in dedicated service files under electron/
- All paths through electron/paths.ts

v2 decisions (confirmed in execution):
- TipTap v3.19.0 as rich text editor (installed, confirmed)
- File-based storage for writing projects (project.json + chapters.json + .md files on disk)
- No @tiptap/markdown (beta) -- markdown for import/export only via custom converter
- Separate writingStore (not merged into store.ts) -- confirmed in Plan 02
- writingStore not persisted to localStorage (document content lives on disk via IPC)
- Writing panels use ProtectedPanels.tsx lazy load + error boundary pattern (consistent with all other panels)
- bridge() accessor helper for safe IPC access in writingStore
- TipTap 3.19 uses `undoRedo` (not `history`) in StarterKitOptions
- TipTap 3.19 setContent uses options object `{ emitUpdate: false }` not boolean
- 1500ms autosave debounce with flush on unmount
- shouldRerenderOnTransaction: false for editor performance (critical for 10k+ word chapters)
- JSONL per-chapter feedback logs in memory/ dir (append-only, one file per chapter)
- feedbackStore.reset() preserves selectedAgent (user preference persists)
- savedSelection stores editor range at send time (for reliable accept after streaming)

### Pending Todos

- None

### Blockers/Concerns

- 5 pre-existing TypeScript errors in main.ts (execPromise references)
- ~~fs-validation.ts missing ~/froggo in ALLOWED_ROOTS~~ FIXED in 05-01
- TipTap markdown extension is beta -- store as TipTap JSON, treat markdown as import/export only

## Session Continuity

Last session: 2026-02-12T21:11:00Z
Stopped at: Completed 06-01-PLAN.md (Feedback State & Logging Service)
Resume file: None
