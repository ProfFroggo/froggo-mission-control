# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Kevin can write a complete memoir using AI-collaborative inline feedback -- highlight any passage, get contextual alternatives from the right agent, and maintain consistency across hundreds of chapters.
**Current focus:** Phase 10 — Jess Integration (complete)

## Current Position

Phase: 10 of 10 (Jess Integration)
Plan: 1 of 1 in current phase
Status: ALL PHASES COMPLETE
Last activity: 2026-02-13 — Completed 10-01-PLAN.md (Jess Integration)

Progress: [████████████] 100% (12/12 plans)

## Performance Metrics

**Velocity (v1):**
- Total plans completed: 12
- Average duration: ~13min
- Total execution time: ~161min

**Velocity (v2):**
- Plans completed: 12
- 05-01: 3min (3 tasks)
- 05-02: 4min (2 tasks)
- 05-03: 5min (2 tasks + checkpoint skipped)
- 06-01: 2min (2 tasks)
- 06-02: 3min (3 tasks)
- 07-01: 3min (2 tasks)
- 07-02: 3min (2 tasks)
- 08-01: 3min (2 tasks)
- 08-02: 4min (2 tasks)
- 09-01: 2min (2 tasks)
- 09-02: 4min (2 tasks)
- 10-01: 3min (2 tasks)

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
- useRef for stream accumulation in FeedbackPopover (avoids stale closures)
- Agent-specific preamble in feedback prompts (writer: style, researcher: accuracy, jess: psychological integration)
- responseFormat() helper for agent-conditional prompt format (Jess gets **Why:** blocks)
- ParsedAlternative { text, commentary? } replaces string[] for alternatives
- Commentary extraction gated on agentId === 'jess' in parser
- Indigo italic commentary styling matches Jess agent theme
- Chapter context truncated to ~16K chars around selection position
- BubbleMenu updateDelay=0 for instant popup; selection collapse after accept to prevent flicker
- JSON array files per project for memory storage (characters.json, timeline.json, facts.json)
- Re-list after mutation in memoryStore (simpler than optimistic updates, local I/O is fast)
- Cap memory context to ~2000 chars in AI prompts (prevents bloat)
- Inline form editing in context panel (form replaces card in-place, consistent with ChapterListItem)
- Per-project research.db (not shared) for data isolation and portability
- Synchronous better-sqlite3 API for research DB (no async wrapper needed)
- Blue badge with 'S' label for needs-source fact status
- Lazy-load sources on tab activation (not project open) for performance
- Fact-check results shown as raw stream (verdict format, not alternatives)
- Fact Check button next to AgentPicker for non-intrusive discoverability
- GripVertical handle-only drag (listeners on handle, not whole item) for click-to-select compatibility
- 5px PointerSensor activation constraint to prevent accidental drags
- File-copy version snapshots (not git-based) for simplicity and debuggability
- Strip HTML before diffing to avoid noisy tag diffs in prose
- Flush editor content to disk before save/compare for accuracy
- History and Context panels mutually exclusive for V1 simplicity

### Pending Todos

- None

### Blockers/Concerns

- 5 pre-existing TypeScript errors in main.ts (execPromise references)
- ~~fs-validation.ts missing ~/froggo in ALLOWED_ROOTS~~ FIXED in 05-01
- TipTap markdown extension is beta -- store as TipTap JSON, treat markdown as import/export only

## Session Continuity

Last session: 2026-02-13T00:59:59Z
Stopped at: Completed 10-01-PLAN.md (Jess Integration) -- ALL PLANS COMPLETE
Resume file: None
