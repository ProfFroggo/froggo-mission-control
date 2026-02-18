---
phase: 17
plan: 01
subsystem: x-twitter
tags: [sqlite, schema-migration, ipc-handlers, lucide-react, emoji-cleanup]
depends_on:
  requires: [14, 15]
  provides: ["x_mentions schema with all columns", "x_drafts CHECK includes posted", "emoji-free XMentionsView"]
  affects: [17-02]
tech-stack:
  added: []
  patterns: ["idempotent ALTER TABLE migrations", "table recreation for CHECK constraint changes"]
key-files:
  created: []
  modified:
    - electron/main.ts
    - electron/handlers/x-twitter-handlers.ts
    - src/components/XMentionsView.tsx
    - ~/froggo/tools/froggo-db/x-page-schema.sql
decisions:
  - id: d17-01-01
    choice: "Idempotent ALTER TABLE + try/catch per column"
    reason: "SQLite ALTER TABLE ADD COLUMN fails if column exists; wrapping each in try/catch makes migration safe to re-run"
  - id: d17-01-02
    choice: "Recreate x_drafts table to fix CHECK constraint"
    reason: "SQLite cannot ALTER CHECK constraints; CREATE new table + copy data + drop + rename"
  - id: d17-01-03
    choice: "Comment out stubs rather than delete"
    reason: "Preserves stub code for reference; clear DISABLED comment explains why"
metrics:
  duration: "3m 24s"
  completed: "2026-02-18"
---

# Phase 17 Plan 01: Fix X/Twitter Mentions Schema & Handler Conflicts

**One-liner:** Idempotent x_mentions column migration, x_drafts CHECK fix for 'posted' status, disabled duplicate handler stubs, emoji-to-lucide swap in XMentionsView

## What Was Done

### Task 1: DB Schema Fixes
- Added idempotent migration block in `app.whenReady()` that:
  - Creates `x_mentions` table if missing (with all 14 columns)
  - Adds 11 missing columns via individual `ALTER TABLE ... ADD COLUMN` (each in try/catch)
  - Recreates `x_drafts` with updated CHECK constraint including 'posted' status
  - Recreates all 4 x_drafts indexes after table recreation
- Updated `x-page-schema.sql` to match the runtime schema (x_mentions columns, x_drafts CHECK)

### Task 2: Handler Stubs & Emoji Cleanup
- Commented out 7 mention/reply-guy handler registrations in `x-twitter-handlers.ts` (full implementations exist in main.ts)
- Replaced all 10 emoji instances in `XMentionsView.tsx` with lucide-react icons

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 4ed9a22 | fix(17-01): fix x_mentions schema mismatch and x_drafts CHECK constraint |
| 95d75b7 | fix(17-01): disable duplicate handler stubs, replace emoji with lucide icons |

## Out-of-Repo Changes

- `/Users/worker/froggo/tools/froggo-db/x-page-schema.sql` updated (x_mentions columns, x_drafts CHECK) - not in dashboard git repo

## Verification

- [x] Migration block uses try/catch per column (idempotent)
- [x] x_mentions CREATE TABLE includes tweet_id, author_id, reply_status, etc.
- [x] x_drafts CHECK includes 'posted' status
- [x] Handler stubs commented out with DISABLED annotation
- [x] No emoji remaining in XMentionsView.tsx
- [x] lucide-react icons imported and used
- [x] TypeScript compiles (no new errors; pre-existing errors unchanged)
