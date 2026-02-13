---
phase: 12-setup-wizard
plan: 01
subsystem: ui
tags: [zustand, zod, wizard, ipc, electron, preload]

# Dependency graph
requires:
  - phase: 11-chat-layout
    provides: chatPaneStore pattern, gateway streaming, preload bridge structure
provides:
  - wizardStore with 7-step state machine
  - Zod validation schemas for wizard plan JSON
  - Agent-specialized prompts (memoir/novel) with extraction and parsing
  - Wizard state persistence IPC service (save/load/list/delete)
  - Preload bridge writing.wizard namespace
  - Flexible project type (string instead of union)
affects: [12-02 wizard UI, 12-03 gateway integration, 12-04 atomic creation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard state machine: idle|braindump|conversation|extracting|review|creating|complete"
    - "Prompt-level structured extraction with JSON code blocks + Zod validation"
    - "File-based wizard state persistence in _wizard-state/{sessionId}/"

key-files:
  created:
    - src/store/wizardStore.ts
    - src/lib/wizardSchema.ts
    - src/lib/wizardPrompts.ts
    - electron/writing-wizard-service.ts
  modified:
    - electron/preload.ts
    - electron/main.ts
    - electron/paths.ts
    - electron/writing-project-service.ts
    - src/store/writingStore.ts

key-decisions:
  - "ProjectMeta.type and WritingProject.type changed from 'memoir' | 'novel' to string for genre flexibility"
  - "Wizard state stored in _wizard-state/{sessionId}/ under WRITING_PROJECTS_DIR"
  - "Agent selection: memoir -> Jess, everything else -> Writer"

patterns-established:
  - "Wizard IPC pattern: writing:wizard:{action} following writing-chat-service.ts convention"
  - "bridge() accessor: (window as any).clawdbot?.writing?.wizard for safe IPC access"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 12 Plan 01: Wizard Foundation Summary

**Zustand wizard store with 7-step state machine, Zod plan validation, agent-specialized prompts (Jess/Writer), wizard state IPC persistence, and flexible project type**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T03:45:19Z
- **Completed:** 2026-02-13T03:49:12Z
- **Tasks:** 2
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments
- Complete wizard state machine (idle/braindump/conversation/extracting/review/creating/complete) in Zustand store
- Zod schemas validating full plan structure: title, type, genre, premise, themes, storyArc, chapters, characters, timeline
- Agent-specialized prompts for memoir (Jess) and novel (Writer), with conversation and extraction prompt builders
- parseWizardPlan extracts JSON from AI markdown responses and validates with Zod
- Wizard state persistence IPC service with save/load/list/delete handlers
- ProjectMeta.type relaxed from union to string for WIZARD-11 genre flexibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wizard store, Zod schemas, and prompt utilities** - `81cc147` (feat)
2. **Task 2: Create wizard IPC service, update preload bridge, register in main.ts, add path helper, and flex project type** - `d738c27` (feat)

## Files Created/Modified
- `src/store/wizardStore.ts` - Wizard state management with full state machine and persistence bridge
- `src/lib/wizardSchema.ts` - Zod validation schemas for wizard plan JSON
- `src/lib/wizardPrompts.ts` - Agent-specialized prompts, extraction prompt builder, JSON parser
- `electron/writing-wizard-service.ts` - Wizard state persistence IPC handlers (save/load/list/delete)
- `electron/preload.ts` - Added writing.wizard namespace with 4 methods
- `electron/main.ts` - Import and registration of wizard handlers
- `electron/paths.ts` - Added WIZARD_STATE_DIR constant
- `electron/writing-project-service.ts` - ProjectMeta.type changed to string, removed union casts
- `src/store/writingStore.ts` - WritingProject.type and createProject param changed to string

## Decisions Made
- Changed ProjectMeta.type from `'memoir' | 'novel'` to `string` -- enables wizard to set any genre. Existing memoir/novel values remain valid strings.
- Removed unnecessary `as 'memoir' | 'novel'` casts in updateProject and IPC handler for cleaner code.
- Wizard state directory is `_wizard-state/` (prefixed with underscore) under WRITING_PROJECTS_DIR to avoid collision with project IDs.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All stores, schemas, prompts, and IPC services are in place for Plan 02 (wizard UI components)
- Plan 03 (gateway integration) can use buildConversationPrompt and buildExtractionPrompt
- Plan 04 (atomic creation) can use wizardPlanSchema for validation
- No blockers

---
*Phase: 12-setup-wizard*
*Completed: 2026-02-13*
