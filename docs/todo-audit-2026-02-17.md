# TODO Comments Audit - 2026-02-17

## Summary
Audited 14 TODO comments across 9 files. Converted 3 to proper tasks, deferred 5 architecture items.

## Converted to Tasks

### 1. MorningBrief Unread Messages (P3)
- **File:** src/components/MorningBrief.tsx:355
- **Task:** task-1771286400757
- **Issue:** Hardcoded unreadMessages: 0
- **Action:** Fetch real count from messaging system

### 2. XResearchIdeaEditor Agent Context (P3)
- **File:** src/components/XResearchIdeaEditor.tsx:50
- **Task:** task-1771286407528
- **Issue:** Hardcoded 'researcher' as proposedBy
- **Action:** Get actual agent from context

### 3. Task Assignment Notifications (P2)
- **File:** electron/task-handlers.ts:392, 407
- **Task:** task-1771286414777
- **Issue:** No notification when tasks assigned
- **Action:** Implement notification system

## Deferred (Architecture/Roadmap)

| File | TODO | Reason |
|------|------|--------|
| main-refactored.ts:282-295 | Phase 2-4 architecture | Roadmap items, not bugs |
| EmailWidget.tsx:36-37 | @action/starred search | Feature requests |
| accounts-service.ts:329 | iCloud authentication | Platform expansion |
| calendar-service.ts:226,235 | Mission Control schedule | External dependency |
| connected-accounts-service.ts:391 | OAuth token revocation | Cleanup feature |

## Result
All meaningful TODOs now tracked as proper tasks with priorities and assignees. Original comments preserved with task references.