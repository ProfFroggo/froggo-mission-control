# Phase 27 Plan 01: Chat Schema Consolidation Summary

**Expanded base CREATE TABLE statements to include all columns, plus fixed 3 API bugs in chat rooms.**

## Accomplishments

- Both `chat_rooms` and `chat_room_messages` CREATE TABLE statements now include all columns that were previously only added via ALTER TABLE migrations — fresh installs get the full schema
- Fixed room sort order: GET /api/chat-rooms now returns rooms ordered by most recent activity (COALESCE(updatedAt, createdAt) DESC)
- Removed duplicate `pinnedMessageId` push in PATCH handler
- loadRoomContext messages now show `[user]` prefix (or any non-agent role) for clarity

## Files Created/Modified

- `src/lib/database.ts` — expanded base CREATE TABLE for chat_rooms + chat_room_messages
- `app/api/chat-rooms/route.ts` — fixed sort order
- `app/api/chat-rooms/[roomId]/route.ts` — removed duplicate PATCH field
- `src/lib/sessionService.ts` — loadRoomContext now shows message roles

## Decisions Made

- Kept all columnMigrations entries intact — they are required for existing databases that predate these columns

## Issues Encountered

None

## Next Step

Ready for 27-02-PLAN.md
