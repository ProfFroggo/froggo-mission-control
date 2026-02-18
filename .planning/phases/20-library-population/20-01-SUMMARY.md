---
phase: 20
plan: 01
subsystem: library-ipc
tags: [ipc, library, skills, electron, sqlite, migration]
requires: []
provides: [skills:list, library:update, library:uploadBuffer, library-project-column]
affects: [20-02]
tech-stack:
  added: []
  patterns: [idempotent-alter-table, arraybuffer-upload, ipc-handler]
key-files:
  created: []
  modified:
    - electron/main.ts
    - electron/preload.ts
decisions:
  - "DB migration uses try/catch per ALTER TABLE for idempotency (SQLite pattern from Phase 17)"
  - "library:uploadBuffer uses Buffer.from(ArrayBuffer) for drag-drop without file dialog"
  - "skills:list queries agent_skills LEFT JOIN agent_registry for enriched skill data"
  - "Category migration: strategy→marketing, test→test-logs, draft/document→content"
metrics:
  duration: ~1min
  completed: 2026-02-18
---

# Phase 20 Plan 01: Library IPC Wiring Summary

**One-liner:** Added skills:list, library:update, library:uploadBuffer IPC handlers + library project column migration to wire up skills display and drag-drop upload.

## What Was Built

Three new IPC handlers in `electron/main.ts` and matching preload bindings in `electron/preload.ts`:

1. **`skills:list`** — queries `agent_skills LEFT JOIN agent_registry` to return all agent skills with agent name/emoji enrichment
2. **`library:update`** — updates category, tags, or project fields on a library file (partial update, only sets provided fields)
3. **`library:uploadBuffer`** — accepts `{ name, type, buffer: ArrayBuffer }` for drag-drop uploads without showing a file dialog; auto-detects category from file extension

Also added:
- **DB migration block** at top of library section: `ALTER TABLE library ADD COLUMN project TEXT` (idempotent via try/catch) + category name normalization
- **`project` field** in `library:list` file transform
- **Preload bindings**: `library.update`, `library.uploadBuffer`, `skills.list`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add IPC handlers + preload bindings + DB migration | 7ef3167 | electron/main.ts, electron/preload.ts |

## Verification Results

1. `grep -n "skills:list\|library:update\|library:uploadBuffer" electron/main.ts` — all 3 handlers found at lines 4368, 4385, 4403
2. `grep -n "skills" electron/preload.ts` — skills namespace at lines 339-341
3. `grep -n "ALTER TABLE library ADD COLUMN project" electron/main.ts` — migration at line 4113
4. `npx tsc --noEmit --project tsconfig.electron.json` — clean, no errors

## Decisions Made

- Used try/catch around `ALTER TABLE ... ADD COLUMN` for idempotency (same pattern as Phase 17 x_mentions migration)
- `library:uploadBuffer` uses `Buffer.from(data.buffer)` — works correctly with ArrayBuffer passed over IPC
- `skills:list` returns raw snake_case from DB (frontend can map as needed); uses `as2` alias to avoid `AS` keyword conflict with `AS` in column aliases
- Category migration coalesces old values; wrapped in try/catch since some rows may not exist

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Plan 20-02 (library UI population, tagging, drag-drop frontend) can now call:
- `window.clawdbot.library.update(fileId, { category, tags, project })`
- `window.clawdbot.library.uploadBuffer({ name, type, buffer })`
- `window.clawdbot.skills.list()`

All IPC surface is wired and TypeScript-clean.
