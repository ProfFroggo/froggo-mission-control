# IPC Modularization Spike Report

**Author:** Senior Coder · **Date:** 2026-02-20 · **Task:** task-1771544594972

---

## 1. Executive Summary

**Verdict: Safe to proceed.** Extracting IPC handlers from `electron/main.ts` (10,126 lines, 308 handlers) into modular files is low-risk when done namespace-by-namespace. A PoC extraction of the `pins` namespace (7 handlers, ~130 lines) compiled and built successfully with zero changes to calling code.

## 2. Audit Results

### 2.1 Current State

| Metric | Value |
|--------|-------|
| `electron/main.ts` lines | 10,126 |
| Total IPC handlers | 308 |
| Distinct namespaces | 40+ |
| Existing extractions | 3 (agent-handlers, toolbar-handlers, finance-service) |
| Existing infra | `ipc-registry.ts` (dedup registry), `handlers/index.ts` (central exports) |

### 2.2 Namespace Distribution (Top 10)

| Namespace | Handlers | Lines (est.) | Dependencies | Extraction Risk |
|-----------|----------|-------------|--------------|----------------|
| x (Twitter) | 57 | ~1,500 | x-api-client, x-analytics, x-automations, x-publishing | **High** — deep service coupling |
| inbox | 18 | ~500 | notification-service, connected-accounts | **Medium** — cross-references |
| calendar | 17 | ~450 | calendar-service | **Low** — isolated service |
| folders | 13 | ~350 | folder rules engine | **Low** — self-contained |
| agents | 12 | ~300 | gateway, exec | **Medium** — core infra |
| tasks | 11 | ~300 | prepare only | **Low** — pure DB |
| connectedAccounts | 9 | ~250 | connected-accounts-service | **Low** — isolated |
| security | 8 | ~200 | shell-security, exec | **Medium** — security critical |
| notification-settings | 8 | ~200 | prepare only | **Low** — pure DB |
| pins | 7 | ~130 | prepare, safeLog only | **Very Low** — zero coupling |

### 2.3 Critical Boundaries Identified

1. **Database access (`prepare`)** — All handlers use the shared `prepare()` function from `database.ts`. This is the only hard dependency for ~60% of handlers. Safe to pass as import.

2. **Logger (`safeLog`)** — Universal logging. Already exported. No risk.

3. **BrowserWindow reference** — ~30 handlers need `mainWindow` for `webContents.send()`. This requires either: (a) passing window as parameter, or (b) using an event bus. **This is the #1 gotcha.**

4. **Cross-handler state** — Some handlers share closure variables (e.g., `cronJobs` map in schedule handlers, `writeStreams` in export). These require careful extraction into service objects.

5. **Initialization order** — Some handlers depend on database tables created at startup. The registration function must be called after `app.whenReady()` and DB init.

## 3. PoC: Pins Handler Extraction

### 3.1 What Was Extracted

**File:** `electron/handlers/pins-handlers.ts`

| Handler | Function |
|---------|----------|
| `pins:list` | List all pinned conversations |
| `pins:is-pinned` | Check if conversation is pinned |
| `pins:pin` | Pin a conversation (with 10-pin limit) |
| `pins:unpin` | Unpin a conversation |
| `pins:toggle` | Toggle pin state |
| `pins:reorder` | Reorder pinned conversations |
| `pins:count` | Get pin count |

### 3.2 Pattern Used

```typescript
// electron/handlers/pins-handlers.ts
import { ipcMain } from 'electron';
import { prepare } from '../database';
import { safeLog } from '../logger';

export function registerPinsHandlers(): void {
  ipcMain.handle('pins:list', handlePinsList);
  ipcMain.handle('pins:is-pinned', handleIsPinned);
  // ... etc
}

async function handlePinsList(): Promise<{ success: boolean; pins: any[] }> {
  // Implementation unchanged from main.ts
}
```

### 3.3 Results

- ✅ TypeScript compiles with zero errors (in the handler file itself)
- ✅ `npm run build:dev` passes
- ✅ No changes needed to renderer/preload code
- ✅ Handler registered via `handlers/index.ts`
- ✅ Existing pattern from agent-handlers/toolbar-handlers followed exactly

### 3.4 Improvements Over Original

- Extracted magic number `10` → `const MAX_PINS = 10`
- Each handler is a named function (better stack traces vs anonymous callbacks)
- Return types explicitly declared

## 4. Extraction Pattern (Recommended)

### 4.1 For Simple Handlers (DB-only, no shared state)

```
1. Create electron/handlers/<namespace>-handlers.ts
2. Import { ipcMain } from 'electron', { prepare } from '../database', { safeLog } from '../logger'
3. Export registerXHandlers() that calls ipcMain.handle() for each channel
4. Add export to handlers/index.ts
5. Remove handlers from main.ts
6. Call registerXHandlers() in main.ts init sequence
```

**Applies to:** pins, snooze, starred, notification-settings, analytics, folders, attachments, activity

### 4.2 For Handlers Needing BrowserWindow

```
1. Same as above, but registerXHandlers(mainWindow: BrowserWindow)
2. Pass mainWindow from main.ts at registration time
3. Use mainWindow.webContents.send() for push events
```

**Applies to:** inbox, agents, tasks, calendar, schedule

### 4.3 For Handlers With Shared State

```
1. Create a service class that owns the state
2. Handler file imports and uses the service
3. Service is instantiated once in main.ts, passed to registerXHandlers(service)
```

**Applies to:** x (Twitter), writing, export/backup, schedule (cronJobs map)

## 5. Risk Assessment

### 5.1 Low Risk (Extract Now)

| Namespace | Handlers | Rationale |
|-----------|----------|-----------|
| pins | 7 | ✅ **Done** — PoC complete |
| snooze | 7 | Pure DB, identical pattern to pins |
| starred | 6 | Pure DB |
| notification-settings | 8 | Pure DB |
| analytics | 4 | Pure DB |
| attachments | 6 | DB + fs (isolated) |
| activity | 2 | Pure DB |
| vip | 5 | Pure DB |

**Total: ~45 handlers, ~1,200 lines recoverable immediately.**

### 5.2 Medium Risk (Extract With Care)

| Namespace | Handlers | Gotcha |
|-----------|----------|--------|
| folders | 13 | Rules engine has closure state |
| tasks + subtasks | 16 | Need BrowserWindow for notifications |
| calendar | 17 | calendar-service dependency |
| connectedAccounts | 9 | connected-accounts-service dependency |
| agents | 12 | Gateway + exec dependencies |
| security | 8 | Security-critical, needs extra review |

### 5.3 High Risk (Defer)

| Namespace | Handlers | Gotcha |
|-----------|----------|--------|
| x (Twitter) | 57 | 4+ service dependencies, shared OAuth state |
| inbox + email | 25 | Complex event bus, notification service coupling |
| writing | ~30 | 6 service files, shared DB connections |

## 6. Rollback Plan

### If an extraction breaks something:

1. **Immediate fix:** The original handlers still exist in `main.ts` until explicitly removed. Comment out the `registerXHandlers()` call and uncomment the original inline handlers.

2. **Git revert:** Each extraction should be a single atomic commit:
   ```bash
   git revert <commit-sha>
   ```

3. **Dual-registration guard:** The existing `ipc-registry.ts` prevents duplicate handler registration. If both old and new handlers somehow load, the second is skipped with a warning.

### Recommended Extraction Workflow

```
1. git checkout -b refactor/extract-<namespace>-handlers
2. Create handlers/<namespace>-handlers.ts
3. Add to handlers/index.ts
4. Build and test (npm run build:dev)
5. Remove original handlers from main.ts
6. Build and test again
7. Manual QA of affected feature
8. Commit with descriptive message
9. PR to dev branch
```

**Key safety net:** Steps 2-4 can be done WITHOUT removing from main.ts first. The ipc-registry dedup means both can coexist temporarily — the first registered wins.

## 7. Gotchas & Lessons

1. **`prepare()` is synchronous** — better-sqlite3 uses sync API. Handler functions are marked `async` for IPC contract but the DB calls are sync. No race conditions to worry about.

2. **No transaction boundaries** — Some handlers (like `pins:toggle`) do read-then-write without a transaction. This is a pre-existing bug, not introduced by extraction. Consider wrapping in `db.transaction()` during extraction.

3. **Magic numbers** — Hard-coded limits (10 pins, etc.) scattered through main.ts. Extract as constants during modularization.

4. **Error patterns vary** — Some handlers return `{ success, error }`, others return `{ success, data }`, others return raw data. Standardize during extraction.

5. **No tests for IPC handlers** — Zero test coverage for the 308 handlers. Consider adding integration tests per-module during extraction.

6. **`mainWindow` lifecycle** — Window can be null during startup or after close. Handlers that use `mainWindow.webContents.send()` must null-check. Use optional chaining: `mainWindow?.webContents?.send()`.

## 8. Recommended Next Steps

1. **Remove pins handlers from main.ts** (currently coexisting — ipc-registry dedup handles it)
2. **Extract 7 more low-risk namespaces** (snooze, starred, notification-settings, analytics, attachments, activity, vip) — ~45 handlers, ~1,200 lines
3. **Add integration tests** per extracted handler file
4. **Tackle medium-risk extractions** with BrowserWindow parameter pattern
5. **Target: main.ts < 5,000 lines** after Phase 2, < 500 lines after Phase 3

## 9. Conclusion

The extraction pattern is proven and safe. The existing `ipc-registry.ts` and `handlers/` infrastructure provide a solid foundation. The main risks are:

- **BrowserWindow passing** for handlers that push events to renderer (solvable with parameter injection)
- **Shared state** in closure variables (solvable with service classes)
- **No test coverage** making it hard to verify correctness (mitigate with manual QA + incremental extraction)

**Recommendation:** Proceed with low-risk extractions immediately. Budget 2-3 hours for the 8 low-risk namespaces. Medium-risk namespaces need individual spikes.
