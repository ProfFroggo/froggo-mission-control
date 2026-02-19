# IPC Refactor Spike — electron/main.ts (10,126 lines)

> **Date:** 2026-02-20 · **Author:** Chief · **Status:** Analysis Complete

## Summary

`electron/main.ts` contains **308 IPC handlers** across **30+ namespaces**. Two handler files have been extracted so far (`agent-handlers.ts`, `toolbar-handlers.ts`). This document maps the full handler landscape and proposes extraction order.

## Handler Distribution by Namespace

| Namespace | Count | Lines (est.) | Module Candidate | Priority |
|-----------|-------|-------------|------------------|----------|
| `x:*` (Twitter) | 57 | ~2500 | ✅ twitter module | P1 |
| `inbox:*` | 18 | ~600 | ✅ comms module | P2 |
| `calendar:*` | 17 | ~500 | ✅ calendar module | P2 |
| `folders:*` | 13 | ~400 | comms module | P2 |
| `agents:*` | 12 | ~350 | core (already extracted) | ✅ Done |
| `tasks:*` | 11 | ~500 | core | P1 |
| `connectedAccounts:*` | 9 | ~300 | accounts module | P3 |
| `notification-settings:*` | 8 | ~400 | core | P2 |
| `security:*` | 8 | ~300 | core | P2 |
| `library:*` | 8 | ~300 | library module | P3 |
| `snooze:*` | 7 | ~200 | comms module | P3 |
| `pins:*` | 7 | ~200 | comms module | P3 |
| `email:*` | 7 | ~250 | comms module | P2 |
| `starred:*` | 6 | ~200 | comms module | P3 |
| `conversations:*` | 6 | ~200 | comms module | P3 |
| `attachments:*` | 6 | ~200 | core | P2 |
| `ai:*` | 6 | ~250 | core | P2 |
| `vip:*` | 5 | ~150 | comms module | P3 |
| `subtasks:*` | 5 | ~300 | core | P1 |
| `schedule:*` | 5 | ~200 | calendar module | P2 |
| `activity:*` | 4 | ~150 | core | P2 |
| `analytics:*` | 4 | ~200 | analytics module | P3 |
| `settings:*` | 4 | ~100 | core | P3 |
| `whisper:*` / `voice:*` | 4 | ~200 | voice module | P3 |
| `screen:*` / `media:*` | 3 | ~100 | core | P3 |
| `chat:*` | 3 | ~150 | core | P3 |
| `export:*` / `backup:*` | 3 | ~100 | core | P3 |
| `finance:*` | varies | ~200 | ✅ finance module | P2 |
| Other | ~15 | ~300 | core | P3 |

**Totals:** ~308 handlers, ~9000+ lines of handler code, ~1000 lines infrastructure

## Extraction Order (Recommended)

### Wave 1 — Biggest impact, cleanest boundaries
1. **X/Twitter handlers** → `handlers/x-twitter-handlers.ts` (already created but not fully wired)
   - 57 handlers, ~2500 lines — biggest single win
2. **Task + Subtask + Activity + Attachment handlers** → `handlers/task-handlers.ts`
   - 26 handlers, ~1150 lines

### Wave 2 — Module candidates
3. **Inbox + Folders + Email + Snooze + Pins + Starred + Conversations + VIP** → `handlers/comms-handlers.ts`
   - 67 handlers, ~2000 lines — natural comms module boundary
4. **Calendar + Schedule** → `handlers/calendar-handlers.ts`
   - 22 handlers, ~700 lines
5. **Finance** → `handlers/finance-handlers.ts`
   - Already partially extracted via `finance-service.ts`

### Wave 3 — Remaining
6. **Notification settings** → `handlers/notification-handlers.ts`
7. **Security** → `handlers/security-handlers.ts`
8. **Connected Accounts** → `handlers/accounts-handlers.ts`
9. **Library** → `handlers/library-handlers.ts`
10. **Analytics** → `handlers/analytics-handlers.ts`
11. **Settings, Voice, Media, Chat, Export** → smaller handler files

## Extraction Pattern

Each handler file follows this pattern:

```typescript
// handlers/example-handlers.ts
import { ipcMain } from 'electron';
import { registerHandler } from '../ipc-registry';

export function registerExampleHandlers(deps: { db: any; /* ... */ }) {
  registerHandler('example:list', async (_event, ...args) => {
    // handler logic
  });
  
  registerHandler('example:get', async (_event, id: string) => {
    // handler logic
  });
}
```

Key principles:
- **Dependency injection** — pass db, services, etc. as deps object
- **Use `registerHandler`** from ipc-registry (dedup + logging)
- **One register function** per file, called from main.ts
- **No side effects** on import — only on register call

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking IPC channels | High | Keep exact same channel names |
| Shared state in main.ts | Medium | Pass via deps object |
| Circular imports | Medium | Services import handlers, not vice versa |
| Missing handler | High | IPC registry logs all registrations, compare counts |

## Validation Strategy

After each extraction:
1. Count registered handlers (`getRegisteredHandlers().length`) — must match pre-refactor count
2. Smoke test affected features in dev build
3. Check console for "Handler already registered" warnings

## Current State vs Target

```
BEFORE (now):
  electron/main.ts ─── 10,126 lines, 308 handlers

AFTER (target):
  electron/main.ts ─── ~500 lines (window + lifecycle + registration calls)
  electron/handlers/
    ├── agent-handlers.ts      ✅ exists (~200 lines)
    ├── toolbar-handlers.ts    ✅ exists (~140 lines)
    ├── x-twitter-handlers.ts  (partially exists, ~2500 lines)
    ├── task-handlers.ts       (~1150 lines)
    ├── comms-handlers.ts      (~2000 lines)
    ├── calendar-handlers.ts   (~700 lines)
    ├── finance-handlers.ts    (~200 lines)
    ├── notification-handlers.ts (~400 lines)
    ├── security-handlers.ts   (~300 lines)
    ├── accounts-handlers.ts   (~300 lines)
    ├── library-handlers.ts    (~300 lines)
    ├── analytics-handlers.ts  (~200 lines)
    ├── settings-handlers.ts   (~100 lines)
    ├── voice-handlers.ts      (~200 lines)
    ├── media-handlers.ts      (~100 lines)
    ├── chat-handlers.ts       (~150 lines)
    └── export-handlers.ts     (~100 lines)
```

## Effort Estimate

- Wave 1: ~4 hours (mechanical extraction, high value)
- Wave 2: ~6 hours (module boundary decisions needed)
- Wave 3: ~4 hours (smaller files, lower risk)
- Testing: ~2 hours per wave
- **Total: ~22 hours across multiple sessions**

This is substantial work — recommend spawning Senior Coder for the mechanical extraction in Wave 1.
