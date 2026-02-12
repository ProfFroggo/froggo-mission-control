# Phase 3: Functional Fixes - Research

**Researched:** 2026-02-12
**Domain:** Codebase bug investigation (Electron+React+TypeScript dashboard)
**Confidence:** HIGH (all findings from direct source code inspection)

## Summary

This research investigates 10 functional bugs (FUNC-01 through FUNC-10) in the Froggo.app dashboard codebase at `~/clawd/clawd-dashboard/`. Every finding comes from reading the actual source code -- no library research was needed since these are all bugs in existing code patterns.

The bugs fall into three categories:
1. **Routing logic** (FUNC-01, FUNC-02): Agent routing hardcoded to 4 agents instead of 9+
2. **Error handling / guards** (FUNC-03, FUNC-04, FUNC-05): Missing error boundaries, null guards, and debounce collision
3. **State / performance** (FUNC-06 through FUNC-10): Duplicate API calls, phantom tasks, broken memoization, unbounded storage, double event listeners

**Primary recommendation:** Fix these bugs in-place with minimal structural changes. Most fixes are 5-20 lines each. The two plan files (03-01 for routing/guards, 03-02 for state/performance) naturally group fixes that share files.

## Standard Stack

No new libraries needed. All fixes use existing patterns already in the codebase:

| Pattern | Already Used In | Purpose |
|---------|----------------|---------|
| `React.memo` with custom comparator | `Kanban.tsx:984` | Memoize TaskCard (FUNC-08) |
| `withErrorBoundary()` HOC | `ProtectedPanels.tsx:34-55` | Wrap panels in error boundaries (FUNC-03) |
| Optional chaining `?.` | `store.ts:347`, `DMFeed.tsx:39` | Null-guard IPC calls (FUNC-04) |
| `clearTimeout` debounce | `notificationService.ts:190-209` | Per-type debounce timers (FUNC-05) |
| `matchTaskToAgent()` | `agents.ts:133` | Route tasks to agents (FUNC-01, FUNC-02) |
| Zustand `set()` / `get()` | `store.ts` throughout | State updates (FUNC-07) |
| `gateway.on()` events | `store.ts:1206-1312` | WebSocket event listeners (FUNC-10) |
| `zustand/middleware persist` | `chatRoomStore.ts:121` | localStorage persistence with `partialize` (FUNC-09) |

## Architecture Patterns

### Pattern 1: IPC Bridge (`window.clawdbot`)

**What:** Electron preload script (`electron/preload.ts`) exposes `window.clawdbot` namespace with IPC methods. In web mode (no Electron), this is `undefined`.

**Current state:** Typed as optional in `src/types/global.d.ts:46` (`clawdbot?:`) but most components bypass type safety with `(window as any).clawdbot.foo.bar()` which crashes when `clawdbot` is undefined.

**Files involved:**
- `electron/preload.ts` -- defines the bridge (494 lines)
- `src/types/global.d.ts:41-60` -- TypeScript declarations
- Every component that calls `window.clawdbot.*`

### Pattern 2: Gateway Event System

**What:** `src/lib/gateway.ts` is a singleton WebSocket client with `.on(event, handler)` pub/sub. Events also come through Electron IPC via `clawdbot.gateway.onBroadcast()`.

**The dual-listener problem (FUNC-10):** `store.ts` lines 1267-1289 register `gateway.on('task.created')`, `gateway.on('task.updated')`, `gateway.on('tasks.refresh')`. Then lines 1299-1312 ALSO register `clawdbot.gateway.onBroadcast()` which fires for the SAME events. Both call `loadTasksFromDB()`.

### Pattern 3: Protected Panels Registry

**What:** `src/components/ProtectedPanels.tsx` is the single registry for lazy-loaded, error-boundary-wrapped panels. Uses `withErrorBoundary()` from `ErrorBoundary.tsx`.

**The missing panel (FUNC-03):** `DMFeed` is NOT in `ProtectedPanels.tsx`. It's imported directly. 23 other panels are wrapped.

### Pattern 4: Zustand Store + froggo-db Sync

**What:** `store.ts` uses Zustand with `persist` middleware. Tasks come from froggo-db via IPC (`loadTasksFromDB`). Tasks are NOT persisted to localStorage (line 1186: "tasks removed - now sourced from froggo-db only").

**The phantom task problem (FUNC-07):** `approveItem` (line 1071) and `adjustItem` (line 1120) add tasks to the local store using `set({ tasks: [newTask, ...s.tasks] })`. These tasks are never synced to froggo-db. They appear briefly in the Kanban board, then vanish when `loadTasksFromDB()` replaces the entire tasks array from DB.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary wrapper | Custom try/catch in render | `withErrorBoundary(Component, 'Name')` from `ErrorBoundary.tsx` | Already handles retry, reload, error categorization |
| IPC null guard | Individual `if` checks | Helper function `isElectron()` or early-return pattern | Consistent, tested, one place to change |
| Agent routing table | Regex matching | Keyword-to-agent mapping object (already exists as pattern in SOUL.md routing table) | Extensible without code changes |
| Debounce per-type | Multiple `setTimeout`s | Dedicated timer Map: `timers: Map<string, NodeJS.Timeout>` | Prevents one type clearing another's timer |

**Key insight:** Most fixes are tiny patches to existing code. The temptation to refactor broadly should be resisted -- each fix should be surgical.

## Common Pitfalls

### Pitfall 1: Breaking the memo by creating new references in parent
**What goes wrong:** Adding a custom comparator to `memo(TaskCard)` is pointless if the parent keeps creating new `activeSessions` objects every render.
**Why it happens:** `useState<Record<string, boolean>>({})` creates a new object reference each time `setActiveSessions` is called, even if the data is identical.
**How to avoid:** The comparator must do deep comparison on `activeSessions`, OR the parent must use `useMemo`/`useRef` to stabilize the reference.
**Warning signs:** React DevTools Profiler shows TaskCard re-rendering on every Kanban render.

### Pitfall 2: Phantom tasks reappearing after DB sync
**What goes wrong:** Fix FUNC-07 by syncing tasks to DB, but the `loadTasksFromDB` call replaces the array BEFORE the sync completes, creating a flash of missing task.
**Why it happens:** Optimistic update + async DB sync + polling creates a race condition.
**How to avoid:** Either (a) don't create local tasks at all (just sync to DB and let polling pick them up), or (b) use the existing `window.clawdbot?.tasks.sync()` pattern from InboxPanel line 679 which writes to DB first.
**Warning signs:** Task appears, disappears for 1-2 seconds, then reappears.

### Pitfall 3: Notification debounce losing events
**What goes wrong:** Fixing FUNC-05 with per-type timers but the refresh functions (`refreshTasks`, `refreshMessages`, `refreshApprovals`) still share `mergeNotifications()` which could race.
**Why it happens:** Two `mergeNotifications` calls close together both read `this.cachedNotifications`, compute merge, then write -- second one overwrites first's additions.
**How to avoid:** Each refresh writes to `cachedNotifications` atomically. The `mergeNotifications` method already handles this correctly by filtering out old notifications of the specific type first, then merging.
**Warning signs:** Notification count jumps up then back down.

### Pitfall 4: Web mode not tested
**What goes wrong:** Adding null guards that return silently, but the component still renders a loading spinner forever (no data ever arrives).
**Why it happens:** Guard prevents crash but doesn't provide fallback data or "unavailable" UI state.
**How to avoid:** Null guards should set an "unavailable" state that renders a meaningful message, not just prevent the crash.
**Warning signs:** Infinite loading spinners in web mode.

### Pitfall 5: Double-removal of broadcast listener breaks existing features
**What goes wrong:** Removing the IPC broadcast listener (FUNC-10) but some events ONLY come through IPC (e.g., main process file watchers, not gateway WebSocket).
**Why it happens:** Two code paths exist because some events originate in the Electron main process (not the gateway WebSocket).
**How to avoid:** Don't remove either listener. Instead, share a single debounced handler that both call into. The debounce (already at 300ms for broadcast, 500ms for gateway.on) naturally deduplicates.
**Warning signs:** Task updates from file watchers stop appearing in real-time.

### Pitfall 6: matchTaskToAgent regex overlap
**What goes wrong:** Adding more agent keywords but "design system" matches both "design" (designer) and "system" (chief).
**Why it happens:** Regex matching is order-dependent; first match wins.
**How to avoid:** Use more specific multi-word patterns first, then fall through to single-word patterns. OR use a scoring system where all patterns contribute weight.
**Warning signs:** Tasks consistently go to wrong agent despite having clear keywords.

## Code Examples

### FUNC-01: Fix matchTaskToAgent routing (agents.ts:133-158)

**Current buggy code (`src/lib/agents.ts:133-158`):**
```typescript
export function matchTaskToAgent(taskTitle: string, taskDescription: string): string {
  const text = `${taskTitle} ${taskDescription}`.toLowerCase();

  if (text.match(/code|bug|fix|implement|build|develop|api|function|test|debug/)) return 'coder';
  if (text.match(/research|analyze|find|investigate|compare|report|data|metrics/)) return 'researcher';
  if (text.match(/write|draft|tweet|post|email|content|copy|edit|blog/)) return 'writer';
  if (text.match(/project|architecture|design|system|plan|roadmap/)) return 'chief';

  return 'coder'; // default fallback
}
```

**Problem:** Only 4 agents. Missing: designer, hr, lead-engineer, social-manager, growth-director, voice, clara.

**Fix pattern -- extend with full 9+ agent routing table:**
```typescript
export function matchTaskToAgent(taskTitle: string, taskDescription: string): string {
  const text = `${taskTitle} ${taskDescription}`.toLowerCase();

  // Order matters: more specific patterns first
  const routes: [RegExp, string][] = [
    // Design tasks -> designer
    [/design|mockup|wireframe|ui\/ux|figma|layout|visual|css|style|theme|branding/, 'designer'],
    // Social media -> social-manager
    [/social media|twitter|x\.com|instagram|tiktok|linkedin|engagement|followers|hashtag/, 'social-manager'],
    // Growth/marketing -> growth-director
    [/growth|marketing|campaign|audience|conversion|funnel|analytics|seo|outreach/, 'growth-director'],
    // HR/team -> hr
    [/hiring|onboard|team member|agent config|training|performance review|hr/, 'hr'],
    // Architecture/leadership -> lead-engineer
    [/architect|infrastructure|devops|deploy|ci\/cd|scaling|migration|refactor|technical debt/, 'lead-engineer'],
    // Code -> coder
    [/code|bug|fix|implement|build|develop|api|function|test|debug|typescript|react/, 'coder'],
    // Research -> researcher
    [/research|analyze|find|investigate|compare|report|data|metrics|study/, 'researcher'],
    // Content -> writer
    [/write|draft|tweet|post|email|content|copy|edit|blog|article|newsletter/, 'writer'],
    // Strategy/project -> chief
    [/project|strategy|plan|roadmap|coordinate|prioritize|review/, 'chief'],
  ];

  for (const [pattern, agent] of routes) {
    if (pattern.test(text)) return agent;
  }

  return 'coder'; // safe default
}
```

**File:** `/Users/worker/clawd/clawd-dashboard/src/lib/agents.ts`
**Lines:** 133-158

---

### FUNC-02: Fix InboxPanel hardcoded routing (InboxPanel.tsx:675, 880)

**Current buggy code (`src/components/InboxPanel.tsx:675`):**
```typescript
assignedTo: 'coder', // Never assign to main/froggo - use coder for execution
```
**And line 880:**
```typescript
assignedTo: item.type === 'tweet' || item.type === 'reply' ? 'writer' : 'coder',
```

**Fix pattern -- import and use matchTaskToAgent:**
```typescript
import { matchTaskToAgent } from '../lib/agents';

// Line 675 - in executeApproval:
assignedTo: matchTaskToAgent(item.title, item.content),

// Line 880 - in feedback/revision task:
assignedTo: matchTaskToAgent(item.title, item.content),
```

**Also fix in `store.ts` approveItem (line 1067) and adjustItem (line 1112):**
```typescript
// Line 1067:
assignedTo: matchTaskToAgent(item.title, item.content || ''),

// Line 1112:
assignedTo: matchTaskToAgent(item.title, `${item.type} ${item.content || ''}`),
```

**Files:**
- `/Users/worker/clawd/clawd-dashboard/src/components/InboxPanel.tsx` lines 675, 880
- `/Users/worker/clawd/clawd-dashboard/src/store/store.ts` lines 1067, 1112

---

### FUNC-03: Wrap DMFeed in ProtectedPanels (ProtectedPanels.tsx)

**Current state:** `DMFeed` is NOT in `ProtectedPanels.tsx`. Only 23 other panels are wrapped.

**Fix -- add to ProtectedPanels.tsx:**
```typescript
// Add lazy import
const DMFeedRaw = lazy(() => import('./DMFeed'));

// Add error boundary wrapper
export const DMFeed = withErrorBoundary(DMFeedRaw, 'Agent Messages');
```

**Then update any imports of DMFeed to use the protected version.**

**File:** `/Users/worker/clawd/clawd-dashboard/src/components/ProtectedPanels.tsx`

---

### FUNC-04: Add null guards to IPC calls (TokenUsageWidget, AgentTokenDetailModal, TaskDetailPanel, DMFeed)

**Current buggy code (TokenUsageWidget.tsx:69):**
```typescript
const summary = await (window as any).clawdbot.tokens.summary({ period: periodMap[period] || period });
```

**Fix pattern -- early return with unavailable state:**
```typescript
const loadData = async () => {
  if (!(window as any).clawdbot?.tokens) {
    setLoading(false);
    return; // IPC not available (web mode)
  }
  setLoading(true);
  try {
    const summary = await (window as any).clawdbot.tokens.summary({ period: periodMap[period] || period });
    // ... rest of function
  }
};
```

**Files requiring null guards (with specific unguarded calls):**

| File | Line | Unguarded Call |
|------|------|----------------|
| `TokenUsageWidget.tsx` | 69 | `clawdbot.tokens.summary(...)` |
| `TokenUsageWidget.tsx` | 90 | `clawdbot.tokens.budget(...)` |
| `AgentTokenDetailModal.tsx` | 44 | `clawdbot.tokens.log(...)` |
| `TaskDetailPanel.tsx` | 85 | `clawdbot.tasks.attachments.list(...)` |
| `TaskDetailPanel.tsx` | 439 | `clawdbot.exec.run(...)` |
| `TaskDetailPanel.tsx` | 447 | `clawdbot.fs.writeBase64(...)` |
| `TaskDetailPanel.tsx` | 478 | `clawdbot.tasks.attachments.delete(...)` |
| `TaskDetailPanel.tsx` | 489 | `clawdbot.tasks.attachments.open(...)` |
| `TaskDetailPanel.tsx` | 499 | `clawdbot.tasks.attachments.autoDetect(...)` |
| `TaskDetailPanel.tsx` | 1430 | `clawdbot.exec.run(...)` |
| `DMFeed.tsx` | 39 | `clawdbot?.getDMHistory(...)` (has `?.` but no fallback UI) |

---

### FUNC-05: Fix notification debounce collision (notificationService.ts:189-209)

**Current buggy code (`src/lib/notificationService.ts:189-209`):**
```typescript
private handleTaskEvent() {
  clearTimeout(this.refreshTimer!);  // <-- clears the SHARED timer
  this.refreshTimer = setTimeout(() => this.refreshTasks(), 300);
}

private handleApprovalEvent() {
  clearTimeout(this.refreshTimer!);  // <-- clears task timer if pending!
  this.refreshTimer = setTimeout(() => this.refreshApprovals(), 300);
}

private handleMessageEvent() {
  clearTimeout(this.refreshTimer!);  // <-- clears approval timer if pending!
  this.refreshTimer = setTimeout(() => this.refreshMessages(), 300);
}
```

**Problem:** All three handlers share `this.refreshTimer`. If a task event fires, then a message event fires 100ms later, the task refresh is cancelled.

**Fix -- use per-type timers:**
```typescript
private refreshTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

private handleTaskEvent() {
  clearTimeout(this.refreshTimers.get('task')!);
  this.refreshTimers.set('task', setTimeout(() => this.refreshTasks(), 300));
}

private handleApprovalEvent() {
  clearTimeout(this.refreshTimers.get('approval')!);
  this.refreshTimers.set('approval', setTimeout(() => this.refreshApprovals(), 300));
}

private handleMessageEvent() {
  clearTimeout(this.refreshTimers.get('message')!);
  this.refreshTimers.set('message', setTimeout(() => this.refreshMessages(), 300));
}
```

**Also update `destroy()` to clear all timers:**
```typescript
destroy() {
  for (const timer of this.refreshTimers.values()) {
    clearTimeout(timer);
  }
  this.refreshTimers.clear();
  // ... rest of cleanup
}
```

**File:** `/Users/worker/clawd/clawd-dashboard/src/lib/notificationService.ts`
**Lines:** 63 (property), 189-209 (handlers), 664-676 (destroy)

---

### FUNC-06: Merge duplicate session fetches (Dashboard.tsx:228-240, store.ts:343-420)

**Current buggy code (Dashboard.tsx:228-240):**
```typescript
useEffect(() => {
  if (connected) {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);    // Call #1
    return () => clearInterval(interval);
  }
}, [connected, fetchSessions]);

useEffect(() => {
  loadGatewaySessions();
  const interval = setInterval(loadGatewaySessions, 30000); // Call #2 (same IPC!)
  return () => clearInterval(interval);
}, [loadGatewaySessions]);
```

**Both call the same IPC endpoint:** `(window as any).clawdbot?.sessions?.list()`
- `fetchSessions` stores raw sessions in `sessions` (store.ts:349)
- `loadGatewaySessions` processes sessions into `GatewaySession[]` and stores in `gatewaySessions` (store.ts:422-ish)

**Fix pattern:** Merge into one function that does both. Remove `fetchSessions` interval, have `loadGatewaySessions` also set `sessions`:
```typescript
loadGatewaySessions: async () => {
  try {
    const result = await (window as any).clawdbot?.sessions?.list();
    if (result?.success && result?.sessions && Array.isArray(result.sessions)) {
      // Store raw sessions
      set({ sessions: result.sessions });

      // Also process into GatewaySession format
      const processed: GatewaySession[] = result.sessions.map((s: any) => {
        // ... existing processing logic
      });
      set({ gatewaySessions: processed });
    }
  } catch (e) {
    console.error('Failed to load sessions:', e);
  }
},
```

Then in Dashboard.tsx, remove the `fetchSessions` interval entirely:
```typescript
useEffect(() => {
  if (connected) {
    loadGatewaySessions();
    const interval = setInterval(loadGatewaySessions, 30000);
    return () => clearInterval(interval);
  }
}, [connected, loadGatewaySessions]);
```

**Files affected:**
- `/Users/worker/clawd/clawd-dashboard/src/store/store.ts` lines 343-356, 360-420
- `/Users/worker/clawd/clawd-dashboard/src/components/Dashboard.tsx` lines 228-240
- `/Users/worker/clawd/clawd-dashboard/src/components/DashboardRedesigned.tsx` lines 78-90
- `/Users/worker/clawd/clawd-dashboard/src/components/AgentPanel.tsx` line 85

---

### FUNC-07: Fix phantom task creation (store.ts:1057-1073, 1105-1121)

**Current buggy code (store.ts:1059-1073):**
```typescript
const completionTask: Task = {
  id: `task-exec-${Date.now()}`,
  title: `${result.success ? '...' : '...'} ${item.type}: ${item.title}`,
  // ...
  assignedTo: 'coder',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
set((s: Store) => ({
  tasks: [completionTask, ...s.tasks],  // <-- adds to local store only!
}));
```

**Problem:** Tasks added with `set()` are local-only. Never synced to froggo-db. Appear briefly in Kanban, then vanish on next `loadTasksFromDB()` (which replaces entire tasks array from DB).

**Fix option A (recommended) -- sync to DB like InboxPanel does:**
```typescript
// Instead of local-only set(), sync to DB first
const taskData = {
  id: `task-exec-${Date.now()}`,
  title: `${result.success ? 'Done' : 'Failed'}: ${item.type}: ${item.title}`,
  description: result.success
    ? `Executed ${item.type}: ${item.content?.slice(0, 200)}`
    : `Failed: ${result.error}`,
  status: result.success ? 'done' : 'failed',
  project: 'Approvals',
  assignedTo: matchTaskToAgent(item.title, item.content || ''),
};
await (window as any).clawdbot?.tasks?.sync?.(taskData);
// Then reload from DB to pick it up
useStore.getState().loadTasksFromDB();
```

**Fix option B -- don't create tasks at all (just log activity):**
```typescript
// Just add an activity feed entry, not a phantom task
useStore.getState().addActivity({
  type: 'approval',
  message: `${result.success ? 'Executed' : 'Failed'}: ${item.type}: ${item.title}`,
  timestamp: Date.now(),
});
```

**Same pattern applies to `adjustItem` (lines 1105-1121) which creates `task-revise-*` phantom tasks.**

**File:** `/Users/worker/clawd/clawd-dashboard/src/store/store.ts`
**Lines:** 1057-1073 (approveItem), 1105-1121 (adjustItem)

---

### FUNC-08: Fix Kanban memo comparator (Kanban.tsx:984)

**Current code (Kanban.tsx:984):**
```typescript
const TaskCard = memo(function TaskCard({ task, agents, activeSessions, ... }: TaskCardProps) {
```

**Problem:** `memo()` without a custom comparator does shallow equality. But:
- `activeSessions` is `Record<string, boolean>` -- new object reference every time `setActiveSessions` runs (line 130), even if data is identical
- `agents` array comes from Zustand store -- new reference when any store update happens
- The callbacks (`onDragStart`, `onDelete`, etc.) are arrow functions created in the parent render, so they're always new references

**Fix -- add custom comparator that checks the fields that actually affect rendering:**
```typescript
const TaskCard = memo(function TaskCard({ ... }: TaskCardProps) {
  // component body unchanged
}, (prev, next) => {
  // Return true if props are equal (should NOT re-render)
  return (
    prev.task === next.task &&
    prev.isDragging === next.isDragging &&
    prev.isDeleting === next.isDeleting &&
    prev.isSpawning === next.isSpawning &&
    prev.isMoving === next.isMoving &&
    prev.agents === next.agents &&
    // Deep compare activeSessions since it's a new object each time
    JSON.stringify(prev.activeSessions) === JSON.stringify(next.activeSessions)
  );
});
```

**Note:** The callbacks (`onDragStart`, `onDragEnd`, etc.) should be memoized in the parent with `useCallback`, OR excluded from the comparator since they don't affect visual output. The comparator above intentionally skips callback comparison.

**File:** `/Users/worker/clawd/clawd-dashboard/src/components/Kanban.tsx`
**Line:** 984

---

### FUNC-09: Add localStorage size guard to chatRoomStore (chatRoomStore.ts)

**Current code (chatRoomStore.ts:73-80):**
```typescript
addMessage: (roomId: string, message: RoomMessage) => {
  set(state => ({
    rooms: state.rooms.map(r =>
      r.id === roomId
        ? { ...r, messages: [...r.messages, message], updatedAt: Date.now() }
        : r
    ),
  }));
},
```

**Problem:** Messages accumulate without limit. With `persist` middleware (line 121), all messages are serialized to localStorage. localStorage has a ~5MB limit. Eventually `JSON.stringify` throws `QuotaExceededError`.

**Fix -- cap messages per room and add partialize trim:**
```typescript
const MAX_MESSAGES_PER_ROOM = 200;

addMessage: (roomId: string, message: RoomMessage) => {
  set(state => ({
    rooms: state.rooms.map(r =>
      r.id === roomId
        ? {
            ...r,
            messages: [...r.messages, message].slice(-MAX_MESSAGES_PER_ROOM),
            updatedAt: Date.now()
          }
        : r
    ),
  }));
},
```

**Also add a safety cap in the persist `partialize`:**
```typescript
partialize: (state) => ({
  rooms: state.rooms.map(r => ({
    ...r,
    messages: r.messages.slice(-MAX_MESSAGES_PER_ROOM).map(m => ({ ...m, streaming: false })),
  })),
}),
```

**File:** `/Users/worker/clawd/clawd-dashboard/src/store/chatRoomStore.ts`
**Lines:** 73-80 (addMessage), 122-130 (partialize)

---

### FUNC-10: Fix dual broadcast listeners (store.ts:1267-1312)

**Current buggy code (store.ts:1267-1312):**
```typescript
// Listener 1: gateway WebSocket events
gateway.on('task.created', (payload: any) => {
  useStore.getState().loadTasksFromDB();  // triggers DB reload
});
gateway.on('task.updated', (payload: any) => {
  clearTimeout((window as any).__taskRefreshTimer);
  (window as any).__taskRefreshTimer = setTimeout(() => {
    useStore.getState().loadTasksFromDB();  // triggers DB reload (debounced 500ms)
  }, 500);
});

// Listener 2: Electron IPC broadcast (SAME events forwarded from main process)
if (typeof window !== 'undefined' && (window as any).clawdbot?.gateway?.onBroadcast) {
  (window as any).clawdbot.gateway.onBroadcast((data: { type: string; event: string; payload: any }) => {
    if (data.event === 'task.created' || data.event === 'task.updated') {
      clearTimeout((window as any).__taskRefreshTimer);
      (window as any).__taskRefreshTimer = setTimeout(() => {
        useStore.getState().loadTasksFromDB();  // triggers DB reload (debounced 300ms)
      }, 300);
    }
  });
}
```

**Problem:** When a task event occurs, BOTH listeners fire, causing `loadTasksFromDB()` to run twice (once at 300ms from broadcast, once at 500ms from gateway.on). They use the same `__taskRefreshTimer` global, so the 300ms one runs and the 500ms one also runs (because the 300ms callback already fired and cleared the timer before the 500ms `clearTimeout` runs).

**Fix -- share a single debounced refresh function:**
```typescript
// Shared debounced task refresh (used by all event sources)
const TASK_REFRESH_DEBOUNCE = 400;
function debouncedTaskRefresh() {
  clearTimeout((window as any).__taskRefreshTimer);
  (window as any).__taskRefreshTimer = setTimeout(() => {
    useStore.getState().loadTasksFromDB();
  }, TASK_REFRESH_DEBOUNCE);
}

gateway.on('task.created', () => debouncedTaskRefresh());
gateway.on('task.updated', () => debouncedTaskRefresh());
gateway.on('tasks.refresh', () => debouncedTaskRefresh());

if (typeof window !== 'undefined' && (window as any).clawdbot?.gateway?.onBroadcast) {
  (window as any).clawdbot.gateway.onBroadcast((data: { type: string; event: string; payload: any }) => {
    if (data.event === 'task.created' || data.event === 'task.updated') {
      debouncedTaskRefresh();
    }
  });
}
```

**File:** `/Users/worker/clawd/clawd-dashboard/src/store/store.ts`
**Lines:** 1267-1312

## State of the Art

Not applicable -- these are all bug fixes in existing application code, not library-version-dependent features.

## Open Questions

### 1. InboxPanel vs store.ts approval paths
**What we know:** There are TWO separate approval flows:
- `InboxPanel.tsx` `handleApprove()` (line 495) -- the active one, uses `clawdbot.inbox.update()` and `clawdbot.tasks.sync()` to write to DB
- `store.ts` `approveItem()` (line 1044) -- the legacy one, creates phantom local tasks

**What's unclear:** Are both paths still active? Does anything still call `store.approveItem`?

**Recommendation:** Grep for `approveItem` usage. If nothing calls it, the phantom task bug in store.ts is dead code. But fix it anyway since `adjustItem` IS called from the store.

### 2. Which Dashboard component is active?
**What we know:** Three dashboard files exist:
- `Dashboard.tsx` (1,998 lines) -- has double fetch
- `DashboardRedesigned.tsx` -- also has double fetch
- `Dashboard.original.tsx` -- backup

**What's unclear:** Which one is rendered? Likely `Dashboard.tsx` based on ProtectedPanels.tsx import.

**Recommendation:** Check `App.tsx` or the panel routing to confirm. Fix both `Dashboard.tsx` and `DashboardRedesigned.tsx` to be safe.

### 3. DMFeed usage scope
**What we know:** `DMFeed.tsx` is 91 lines, uses `window.clawdbot?.getDMHistory()`.
**What's unclear:** Where is it imported? Is it in the main panel router or only in a widget?
**Recommendation:** Grep for `DMFeed` imports. Add to ProtectedPanels.tsx regardless -- it's cheap insurance.

## Dependency Map Between Fixes

```
FUNC-01 (routing table) ──> FUNC-02 (InboxPanel imports matchTaskToAgent)
                         ──> FUNC-07 (store.ts approveItem/adjustItem use matchTaskToAgent)

FUNC-03 (DMFeed error boundary) -- independent
FUNC-04 (IPC null guards)       -- independent
FUNC-05 (notification debounce) -- independent
FUNC-06 (merge session fetches) -- independent
FUNC-08 (Kanban memo)           -- independent
FUNC-09 (chatRoom localStorage) -- independent
FUNC-10 (dual listeners)        -- independent
```

FUNC-01 should be done FIRST since FUNC-02 and FUNC-07 import from it.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of all files listed above
- All line numbers verified against current codebase state (2026-02-12)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all patterns already exist in codebase, no new libraries
- Architecture: HIGH - direct code reading, not inference
- Pitfalls: HIGH - based on actual code structure and known React/Zustand behaviors

**Research date:** 2026-02-12
**Valid until:** Until codebase changes (no external dependency concerns)
