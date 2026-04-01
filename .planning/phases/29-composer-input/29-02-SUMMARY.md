# Phase 29 Plan 02: Draft Persistence + Model Pill Summary

**Added localStorage draft persistence per agent and a passive model pill in the composer.**

## Accomplishments

- `saveDraft`/`loadDraft` helpers use `froggo:chat-draft:{agentId}` prefix in localStorage, with SSR-safe try/catch
- Draft saved on every keystroke via onChange handler
- Draft restored when switching agents via `handleAgentSwitch`
- Draft cleared after message send
- `formatModelName` strips "claude-" prefix and date suffixes (e.g. claude-opus-4-6 → opus-4-6)
- Model pill renders in composer flex row before the send/stop button — small monospace span
- `model` field added to `ChatAgent` interface, `Agent` store interface, and both mapping functions in `AgentSelector.tsx`

## Files Created/Modified

- `src/components/ChatPanel.tsx` — draft helpers, draft save/load/clear wiring, model pill
- `src/components/AgentSelector.tsx` — model field added to ChatAgent + both mapping functions
- `src/store/store.ts` — model field added to Agent interface

## Decisions Made

- Added `model` to `Agent` interface in store.ts so the field flows through consistently — agents API already returns the model column from DB

## Issues Encountered

- `model` was not in the `ChatAgent` or `Agent` interfaces — needed to add it to both and wire through the mapping functions

## Next Step

Ready for 29-03-PLAN.md
