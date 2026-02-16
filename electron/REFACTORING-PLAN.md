# Main.ts Refactoring Plan

## Current State

`electron/main.ts` is **9043 lines** with 60+ IPC handlers, violating single responsibility principle.

## Target State

Thin orchestrator (~300 lines) that imports and registers handlers from modular files.

## Directory Structure

```
electron/
├── main.ts                    # Thin orchestrator (~300 lines)
├── main.ts.legacy             # Original file (archived)
├── main-refactored.ts         # New refactored entry point
├── handlers/                  # NEW: IPC handler modules
│   ├── index.ts              # Central exports
│   ├── agent-handlers.ts     # Agent & session management
│   ├── x-twitter-handlers.ts # X/Twitter content pipeline
│   ├── task-handlers.ts      # Task CRUD (exists, needs integration)
│   ├── finance-handlers.ts   # Finance module
│   ├── security-handlers.ts  # Security & audit
│   ├── chat-handlers.ts      # Chat messages & starred
│   ├── export-handlers.ts    # Export & backup
│   ├── notification-handlers.ts # Notifications
│   ├── settings-handlers.ts  # Settings & API keys
│   ├── voice-handlers.ts     # Voice & whisper
│   ├── media-handlers.ts     # Screen capture & media
│   └── toolbar-handlers.ts   # Floating toolbar
├── services/                  # NEW: Business logic services
│   └── (future extraction)
└── helpers/                   # NEW: Utility functions
    └── (future extraction)
```

## Handler Categories

### Phase 1: COMPLETE ✅

| Handler File | Handlers | Lines (Original) | Status |
|--------------|----------|------------------|--------|
| `agent-handlers.ts` | gateway:getToken, agents:list, sessions:list, agents:*, widget:scan-manifest | ~200 | ✅ Created |
| `x-twitter-handlers.ts` | x:research:*, x:plan:*, x:draft:*, x:schedule:*, x:mention:*, x:replyGuy:* | ~1200 | ✅ Created |
| `main-refactored.ts` | Orchestrator | ~300 | ✅ Created |

### Phase 2: TODO

| Handler File | Handlers | Lines (Original) | Priority |
|--------------|----------|------------------|----------|
| `task-handlers.ts` | tasks:*, subtasks:*, activity:*, attachments:* | ~1000 | P1 |
| `finance-handlers.ts` | finance:*, financeAgent:* | ~200 | P2 |
| `security-handlers.ts` | security:* | ~180 | P2 |
| `chat-handlers.ts` | chat:*, starred:* | ~230 | P2 |
| `export-handlers.ts` | export:*, backup:* | ~90 | P2 |

### Phase 3: TODO

| Handler File | Handlers | Lines (Original) | Priority |
|--------------|----------|------------------|----------|
| `notification-handlers.ts` | notification-settings:*, rejections:log | ~300 | P3 |
| `settings-handlers.ts` | settings:* | ~50 | P3 |
| `voice-handlers.ts` | whisper:*, voice:* | ~150 | P3 |
| `media-handlers.ts` | screen:*, media:* | ~40 | P3 |
| `toolbar-handlers.ts` | toolbar:* | ~140 | P3 |

## Migration Strategy

1. **Create handler modules** ✅
   - Create `handlers/` directory
   - Extract handlers by category
   - Export register functions

2. **Create new main.ts** ✅
   - Import all handler modules
   - Call register functions in app.whenReady()
   - Keep only window management and lifecycle code

3. **Test in parallel**
   - Keep original main.ts
   - Test main-refactored.ts
   - Fix any issues

4. **Switch over**
   - Rename main.ts → main.ts.legacy
   - Rename main-refactored.ts → main.ts
   - Update build config if needed

5. **Archive legacy**
   - Remove main.ts.legacy after stable period

## Handler Pattern

Each handler module follows this pattern:

```typescript
import { ipcMain } from 'electron';
import { prepare } from '../database';
import { safeLog } from '../logger';

export function registerXHandlers(): void {
  ipcMain.handle('x:action', handleXAction);
  ipcMain.handle('x:other', handleXOther);
}

async function handleXAction(
  _: Electron.IpcMainInvokeEvent,
  data: SomeType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Implementation
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X] Action error:', error.message);
    return { success: false, error: error.message };
  }
}
```

## Benefits

1. **Single Responsibility**: Each file has one purpose
2. **Testability**: Can test handlers in isolation
3. **Maintainability**: Changes are localized
4. **Discoverability**: Easy to find handlers
5. **Code Review**: Smaller files = easier reviews

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Keep original file, test thoroughly before switch |
| Import issues | Use consistent path aliases |
| Handler conflicts | Ensure no duplicate registrations |
| Database queries | Keep `prepare()` pattern, consistent error handling |

## Progress Tracking

- [x] Phase 1: Create handler modules (agent, x-twitter)
- [x] Phase 1: Create refactored main.ts
- [ ] Phase 2: Extract remaining handlers
- [ ] Phase 3: Test and validate
- [ ] Phase 4: Switch to refactored version
- [ ] Phase 5: Archive legacy file

## Stats

| Metric | Before | After (Phase 1) | Target |
|--------|--------|-----------------|--------|
| main.ts lines | 9043 | ~300 | ~300 |
| Handler modules | 0 | 2 | 12 |
| Avg module size | - | ~200 | ~200 |
| Total files | 1 | 3 | 13 |
