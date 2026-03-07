# Phase 56 Plan 01: Input Sanitization — Length Limits Summary

Added length-limit guards to four API routes, preventing oversized strings from reaching the DB or filesystem.

## Accomplishments

- `POST /api/tasks`: title required check + title ≤500 chars + description ≤5000 chars, validated from `body` before destructuring
- `PATCH /api/tasks/[id]`: title ≤500 (if present in body), description ≤5000 (if present and non-null)
- `POST /api/agents/hire`: name required + name ≤100 chars, placed after `validateAgentId` guard
- `POST /api/library` `action=folder-create`: name required + ≤255 chars
- `POST /api/library` `action=update`: name ≤255 chars (if present in update fields)
- All violations return `400` with a descriptive `{ error: '...' }` message
- Zero TypeScript errors introduced in modified files (15 pre-existing errors in unrelated files)

## Files Created/Modified

- `app/api/tasks/route.ts` — 3 validation checks added before INSERT
- `app/api/tasks/[id]/route.ts` — 2 validation checks added before setClauses loop
- `app/api/agents/hire/route.ts` — name required + length checks after validateAgentId guard
- `app/api/library/route.ts` — folder-create name check + update name check

## Decisions Made

- Validated from `body.title`/`body.description` directly before the destructuring block in `tasks/route.ts` to avoid referencing variables before they are declared
- PATCH title check uses `typeof body.title !== 'string' || body.title.length > 500` (combined) so a non-string title also fails gracefully
- Library `folder-create` treats empty/missing name as invalid (same error message, keeps response consistent)
- hire route: name validation placed after the validateAgentId guard per plan order: presence check → id format validate → name length validate

## Issues Encountered

None. All edits applied cleanly; no TS errors in modified files.

## Next Step

Ready for 56-02: Module ID validation + soul content size cap.
