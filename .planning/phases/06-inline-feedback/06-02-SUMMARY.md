---
phase: "06"
plan: "02"
subsystem: "writing-feedback-ui"
tags: ["tiptap", "bubble-menu", "streaming", "gateway", "zustand", "inline-feedback"]

depends_on:
  requires:
    - phase: "06-01"
      provides: "feedbackStore, writing-feedback-service IPC, feedback logging"
    - phase: "05-02"
      provides: "ChapterEditor with TipTap, writingStore"
  provides:
    - "FeedbackPopover with streaming agent communication"
    - "AgentPicker (Writer/Researcher/Jess selector)"
    - "FeedbackAlternative card component"
    - "BubbleMenu integration in ChapterEditor"
  affects: ["07-memory-store"]

tech_stack:
  added: []
  patterns: ["BubbleMenu for selection-triggered UI", "sendChatWithCallbacks for per-request streaming", "project-scoped agent session keys"]

key_files:
  created:
    - "src/components/writing/FeedbackPopover.tsx"
    - "src/components/writing/FeedbackAlternative.tsx"
    - "src/components/writing/AgentPicker.tsx"
  modified:
    - "src/components/writing/ChapterEditor.tsx"

key_decisions:
  - "useRef for stream accumulation to avoid stale closure in onDelta callbacks"
  - "Agent-specific preamble in prompt (style vs accuracy vs emotional focus)"
  - "Chapter context truncated to ~16K chars around selection position"
  - "onMouseDown preventDefault on popover root to prevent editor blur"

patterns_established:
  - "BubbleMenu with shouldShow for non-empty text selections"
  - "Project-scoped session keys: agent:{agentId}:writing:{projectId}"
  - "parseAlternatives splits on ### Alternative N headers"

duration: "3min"
completed: "2026-02-12"
---

# Phase 6 Plan 02: Inline Feedback UI Summary

**BubbleMenu-based feedback popover with agent picker, streaming alternatives via gateway, and text replacement on accept**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-12T21:15:39Z
- **Completed:** 2026-02-12T21:19:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- BubbleMenu appears instantly on text selection with agent picker and instruction input
- Streaming agent responses via gateway.sendChatWithCallbacks with project-scoped session keys
- 1-3 alternatives parsed from response and shown as accept-able cards
- Accept replaces highlighted text via insertContentAt; dismiss resets state
- All interactions logged as JSONL via IPC (from Plan 01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AgentPicker and FeedbackAlternative** - `52fd67a` (feat)
2. **Task 2: Create FeedbackPopover with streaming** - `2f74cb4` (feat)
3. **Task 3: Integrate BubbleMenu into ChapterEditor** - `98b50c6` (feat)

## Files Created/Modified
- `src/components/writing/AgentPicker.tsx` - Writer/Researcher/Jess pill selector with lucide icons
- `src/components/writing/FeedbackAlternative.tsx` - Alternative card with accept button
- `src/components/writing/FeedbackPopover.tsx` - Main feedback UI: prompt building, streaming, accept/dismiss
- `src/components/writing/ChapterEditor.tsx` - Added BubbleMenu wrapping FeedbackPopover

## Decisions Made
- Used `useRef` for stream content accumulation (avoids stale closures in onDelta callbacks)
- Agent-specific preamble in prompt: Writer focuses on style/pacing, Researcher on accuracy, Jess on emotional impact
- Chapter context window truncated to ~16K chars around selection position (Pitfall 6 mitigation)
- `onMouseDown preventDefault` on popover root div to prevent editor blur (Pitfall 7 backup)
- `updateDelay={0}` on BubbleMenu for instant popup (Pitfall 4 mitigation)
- After accept, collapse selection to prevent BubbleMenu flicker (Pitfall 1 mitigation)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 6 (Inline Feedback) is now complete:
- feedbackStore manages all UI state (Plan 01)
- JSONL feedback logging via IPC (Plan 01)
- BubbleMenu shows FeedbackPopover on text selection (Plan 02)
- Agent communication via gateway with project-scoped sessions (Plan 02)
- All FEED-01 through FEED-08, AGENT-01, AGENT-04, AGENT-05 requirements delivered

Phase 7 (Memory Store) can consume:
- Feedback logs from `memory/feedback-{chapterId}.jsonl` for context enrichment
- Project-scoped session keys for memory-aware agent conversations

---
*Phase: 06-inline-feedback*
*Completed: 2026-02-12*
