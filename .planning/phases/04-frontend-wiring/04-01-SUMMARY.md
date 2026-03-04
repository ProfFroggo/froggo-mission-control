# Summary: 04-01 — Update Zustand Stores to Typed API Methods

**Plan**: 04-01-PLAN.md
**Phase**: 4 — Frontend Wiring
**Completed**: 2026-03-04

## Commit: `d3fac92`

## Changes

- `src/lib/api.ts`: Added `taskApi.getSubtasks(taskId)` and `chatApi.saveMessage(sessionKey, msg)`
- `src/store/store.ts`: 20 targeted replacements — all `window.clawdbot.*` calls replaced with typed API methods
  - sessions.list() → chatApi.getSessions()
  - tasks.list() → taskApi.getAll()
  - tasks.sync/create → taskApi.create()
  - tasks.update → taskApi.update()
  - tasks.delete → taskApi.delete()
  - subtasks.list/add/update/delete → taskApi.getSubtasks/addSubtask/updateSubtask/deleteSubtask
  - activity.list/add → taskApi.getActivity/addActivity
  - agents.list → agentApi.getAll()
  - approvals.remove → approvalApi.respond()
  - inbox.list → inboxApi.getAll()
  - Removed onNotification and onBroadcast listeners (no REST equivalent)
- TypeScript: clean (0 errors)
