# Summary: 03-01 — Tasks API Routes

**Plan**: 03-01-PLAN.md
**Phase**: 3 — API Routes
**Completed**: 2026-03-04
**Duration**: ~3 min

## Commit: `9ac4aab`

## Files Created

- `app/api/tasks/route.ts` — GET (filters: status, assignedTo, project, priority; priority-sorted) + POST (id: `task-${Date.now()}-${random}`)
- `app/api/tasks/[id]/route.ts` — GET + PATCH (dynamic SET for scalar + JSON fields) + DELETE
- `app/api/tasks/[id]/subtasks/route.ts` — GET ordered by position + POST with auto-position
- `app/api/tasks/[id]/subtasks/[subtaskId]/route.ts` — PATCH + DELETE
- `app/api/tasks/[id]/activity/route.ts` — GET last 50 DESC + POST
- `app/api/tasks/[id]/attachments/route.ts` — GET + POST

## Outcome

Full tasks CRUD API. JSON fields (tags, labels, blockedBy, blocks) parsed on read, stringified on write.
