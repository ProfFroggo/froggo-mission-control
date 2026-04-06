# Roadmap: Platform Hardening — Production-Grade Quality Pass

## Overview

Full codebase review identified 23 issues across 5 layers (API, UI, dispatch engine, config, data flow). This milestone systematically fixes every issue from critical logic errors through consistency and polish, transforming MC from a working prototype into a production-grade platform.

## Domain Expertise

None — internal system architecture. All fixes are in existing codebase patterns.

## Phases

- [ ] **Phase 88.1: Dispatch Engine Critical Fixes (P0)** — activeDispatches counter, session key collision, double preemption, timestamp standardization
- [ ] **Phase 88.2: Data Integrity & Safety (P0)** — budgets PK, inbox spawn leak, recurrence race condition, missing transactions
- [ ] **Phase 88.3: Database Performance (P1)** — composite indexes, N+1 queries, unbounded queries
- [ ] **Phase 88.4: Real-Time Architecture (P1)** — wire SSE→Zustand, kill redundant polling, EventBus reconnection, connection status UI
- [ ] **Phase 88.5: API Consistency (P1)** — standardize error shapes, async file I/O, cache headers, response format unification
- [ ] **Phase 88.6: Context & Memory Optimization (P1)** — memory injection caps, KB injection limits, scratchpad MCP tools
- [ ] **Phase 88.7: UI Consistency & Performance (P2)** — PanelHeader migration, component extraction, list virtualization, task fetch deduplication
- [ ] **Phase 88.8: TypeScript & DX (P2)** — noImplicitAny, eslint scoping, pre-commit hooks, CSP tightening
- [ ] **Phase 88.9: Accessibility & Polish (P3)** — aria-labels, activity feed bounds, chatRoom artifact bounds, model pricing comment

## Phase Details

### Phase 88.1: Dispatch Engine Critical Fixes (P0)
**Goal**: Fix the 4 logic errors in taskDispatcher.ts that can break concurrency, corrupt sessions, or double-preempt.
**Depends on**: Nothing (most critical)
**Estimated effort**: 1 session
**Files**: `src/lib/taskDispatcher.ts`, `src/lib/database.ts`

Plans:
- [ ] 88.1-01: Fix activeDispatches tracking + session key collision + double preemption guard + timestamp standardization

**Tasks**:

1. **activeDispatches Set-based tracking** — Replace bare `activeDispatches++`/`--` counter with a `Set<string>` of tracked taskIds. Increment = `add(taskId)`, decrement = `delete(taskId)` + size check. Prevents negative counter and double-decrement from preemption+close race.
   - Files: `src/lib/taskDispatcher.ts` (lines 1157-1161, 1374, 1625, 1800, 1938, 1995, 2033)

2. **Session key includes agentId** — Change session persistence key from `'task:' + taskId` to `'task:' + taskId + ':' + agentId`. Prevents Agent B resuming Agent A's stale session after preemption reassignment.
   - Files: `src/lib/taskDispatcher.ts` (line 927 and all `'task:' + taskId` references)

3. **Guard double preemption** — Add a flag (`preemptionUsed`) after the first `preemptForP0()` call (line 1450). Skip the second call (line 1469) if preemption already freed a slot.
   - Files: `src/lib/taskDispatcher.ts` (lines 1450, 1469)

4. **Timestamp standardization** — Audit all `DEFAULT (unixepoch())` columns in database.ts. Change to `(unixepoch() * 1000)` for consistency. Add migration comment for existing data.
   - Files: `src/lib/database.ts` (lines 226, 862-863)

**Verify**: `npm run build:verify` passes. Manual: dispatch two tasks, preempt one with P0, verify counter stays correct.

---

### Phase 88.2: Data Integrity & Safety (P0)
**Goal**: Fix schema gaps and resource leaks that can corrupt data or crash the server.
**Depends on**: Nothing
**Estimated effort**: 1 session
**Files**: `src/lib/database.ts`, `app/api/inbox/route.ts`, `app/api/tasks/[id]/route.ts`, `app/api/inbox/[id]/convert-to-task/route.ts`, `app/api/projects/route.ts`

Plans:
- [ ] 88.2-01: budgets PK + inbox spawn guard + recurrence transaction + multi-step transactions

**Tasks**:

1. **Add PRIMARY KEY to budgets table** — Add `id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8))))` and `UNIQUE(agentId, period, name)` constraint.
   - Files: `src/lib/database.ts` (lines 1053-1060)

2. **Guard inbox process spawn** — Add error handler, 5-minute timeout, and concurrency limit (max 2 concurrent inbox agent spawns) to the fire-and-forget `spawn()` in inbox POST.
   - Files: `app/api/inbox/route.ts` (lines 101-109)

3. **Wrap recurrence creation in transaction** — Use `db.transaction()` around the check-then-insert for recurring tasks.
   - Files: `app/api/tasks/[id]/route.ts` (lines 357-359)

4. **Add transactions to multi-step mutations** — Wrap convert-to-task (INSERT task + UPDATE inbox) and project creation (INSERT project + members + chat room) in `db.transaction()`.
   - Files: `app/api/inbox/[id]/convert-to-task/route.ts` (lines 22-35), `app/api/projects/route.ts` (lines 75-114)

**Verify**: `npm run build:verify` passes. Grep for `writeFileSync` in api/ routes.

---

### Phase 88.3: Database Performance (P1)
**Goal**: Add missing indexes and fix N+1 queries. Measurable improvement on task/budget queries.
**Depends on**: Phase 88.2 (budgets schema fixed first)
**Estimated effort**: 30 min
**Files**: `src/lib/database.ts`, `app/api/projects/route.ts`, `app/api/campaigns/route.ts`

Plans:
- [ ] 88.3-01: Composite indexes + N+1 fix + unbounded query limits

**Tasks**:

1. **Add 3 composite indexes** —
   - `CREATE INDEX idx_token_usage_agent_ts ON token_usage(agentId, timestamp)`
   - `CREATE INDEX idx_task_activity_task_ts ON task_activity(taskId, timestamp DESC)`
   - `CREATE INDEX idx_tasks_assigned_status_updated ON tasks(assignedTo, status, updatedAt DESC)`
   - Files: `src/lib/database.ts`

2. **Fix N+1 in projects list** — Replace `projects.map(p => ({ ...p, members: memberStmt.all(p.id) }))` with a single JOIN query or batch fetch + in-memory group.
   - Files: `app/api/projects/route.ts` (lines 50-52)

3. **Fix N+1 in campaigns list** — Same pattern as projects.
   - Files: `app/api/campaigns/route.ts` (lines 54-57)

4. **Add LIMIT to unbounded queries** — Add `LIMIT 200` to `SELECT * FROM automations` and any other full-table scans missing limits.
   - Files: `app/api/automations/route.ts` (line 41)

**Verify**: `npm run build:verify` passes.

---

### Phase 88.4: Real-Time Architecture (P1)
**Goal**: Wire SSE events directly to Zustand store. Remove 6+ redundant polling loops. Add reconnection recovery and connection status indicator.
**Depends on**: Nothing
**Estimated effort**: 1-2 sessions
**Files**: `src/store/store.ts`, `src/lib/useEventBus.ts`, `src/components/TopBar.tsx`, `src/hooks/useNotifications.ts`, `src/hooks/useAgents.ts`, `src/components/Kanban.tsx`, `src/components/AgentPanel.tsx`, `src/components/Dashboard.tsx`, `src/components/CircuitBreakerStatus.tsx`, `src/components/ApprovalQueuePanel.tsx`

Plans:
- [ ] 88.4-01: SSE→Store bridge + kill redundant polls
- [ ] 88.4-02: EventBus reconnection fix + connection status UI + missing SSE events

**Tasks (Plan 01)**:

1. **Create SSE→Store bridge** — Add a `useSSEStoreSync()` hook that subscribes to EventBus events and dispatches Zustand actions:
   - `task.created` / `task.updated` → `store.updateTaskFromSSE(task)`
   - `agent.status` / `agent.updated` → `store.updateAgentFromSSE(agent)`
   - `notification.new` → `store.addNotification(notification)`
   - `budget.alert` / `budget.dispatch_blocked` → `store.addActivity(budgetEvent)`
   - Mount this hook once in App.tsx

2. **Remove redundant polling** — For every component that has a `setInterval` AND a matching SSE event, remove the interval. Keep polling only as a fallback when `eventSource.readyState !== OPEN`. Components to clean:
   - `Kanban.tsx:60` (60s task poll → SSE)
   - `useAgents.ts:223` (15s agent poll → SSE)
   - `useNotifications.ts:84` (10s notification poll → SSE)
   - `CircuitBreakerStatus.tsx:49` (120s circuit poll → SSE)
   - `AgentPanel.tsx:158` + `Dashboard.tsx:272` (30s gateway poll → keep, no SSE event yet)

3. **Add `loadTasksFromDB()` deduplication** — Add `inflightPromise` pattern (copy from `useInboxData.ts:43-64`) to prevent 3 simultaneous `/api/tasks` requests on mount.
   - Files: `src/store/store.ts` (lines 596-628)

**Tasks (Plan 02)**:

4. **Fix EventBus reconnection** — In `useEventBus.ts`, when `eventSource.readyState === CLOSED`, force-create a new EventSource instead of returning the dead one. Re-attach all `namedListeners`.
   - Files: `src/lib/useEventBus.ts` (lines 61-79)

5. **Add connection status indicator** — Add a small dot/badge in TopBar showing SSE connection state (green=connected, amber=reconnecting, red=disconnected). Use `eventSource.readyState`.
   - Files: `src/components/TopBar.tsx`

6. **Add missing SSE events** — Emit `approval.created`, `approval.updated` from approval API routes. Wire `ApprovalQueuePanel` to listen instead of 20s poll.
   - Files: `src/lib/sseEmitter.ts`, `app/api/approvals/route.ts`, `src/components/ApprovalQueuePanel.tsx`

**Verify**: `npm run build:verify`. Open 2 browser tabs — create task in one, verify it appears in the other without polling delay.

---

### Phase 88.5: API Consistency (P1)
**Goal**: Every API route returns the same error shape, uses async I/O, and has appropriate cache headers.
**Depends on**: Nothing
**Estimated effort**: 1 session
**Files**: All `app/api/**/route.ts`, `src/lib/api.ts`

Plans:
- [ ] 88.5-01: Error shape + async I/O + cache headers + response format

**Tasks**:

1. **Standardize error response shape** — All error responses must use `{ error: string }` with HTTP status code. Grep for `{ success: false`, `{ message:`, `{ ok: false }` and normalize. Create a helper: `apiError(message: string, status: number)`.
   - Files: All route files returning non-standard error shapes

2. **Replace sync file I/O with async** — Replace all `writeFileSync` / `mkdirSync` in API routes with `await writeFile()` / `await mkdir()` from `fs/promises`.
   - Files: `app/api/tasks/[id]/route.ts` (lines 215, 426), `app/api/projects/route.ts` (line 100), `app/api/campaigns/route.ts` (line 132)

3. **Add cache headers to read-only endpoints** — Add `Cache-Control: private, max-age=30, stale-while-revalidate=60` to list endpoints (tasks, agents already has it, projects, campaigns, notes).
   - Files: GET handlers in tasks, projects, campaigns, notes routes

4. **Unify jsonResponse vs NextResponse.json** — Pick one. Standardize on `NextResponse.json()` since only 2 files use `jsonResponse()`. Remove `jsonResponse` from those 2 files.
   - Files: `app/api/tasks/route.ts` (line 142), `app/api/inbox/route.ts` (lines 58, 67)

**Verify**: `npm run build:verify`. Grep for `writeFileSync` in `app/api/` — should be zero.

---

### Phase 88.6: Context & Memory Optimization (P1)
**Goal**: Dispatch system injects right-sized context. Agents can access scratchpad via MCP tools.
**Depends on**: Nothing
**Estimated effort**: 1 session
**Files**: `src/lib/taskDispatcher.ts`, `tools/mission-control-db-mcp/src/index.ts`

Plans:
- [ ] 88.6-01: Memory caps + KB caps + scratchpad MCP tools

**Tasks**:

1. **Cap memory injection** — In `loadRelevantMemory()`, skip files > 2KB, cap total injected text to 8KB, and limit to 3 most relevant files.
   - Files: `src/lib/taskDispatcher.ts` (lines 497-542)

2. **Cap KB injection** — In `loadRelevantKnowledge()`, limit pinned articles to 3, cap each article snippet to 400 chars, and only inject the section if there are results.
   - Files: `src/lib/taskDispatcher.ts` (lines 663-704)

3. **Add scratchpad MCP tools** — Add `scratchpad_list`, `scratchpad_read`, `scratchpad_write` tools to the MCP server. Root dir: `~/mission-control/scratchpad/`. Enforce max file size 10KB. Add to TOOLS AVAILABLE in TASK_SUFFIX.
   - Files: `tools/mission-control-db-mcp/src/index.ts`, `src/lib/taskDispatcher.ts` (TASK_SUFFIX tools list)

**Verify**: `npm run build:verify`. Test: create a file in scratchpad via MCP tool call.

---

### Phase 88.7: UI Consistency & Performance (P2)
**Goal**: All panels follow PanelHeader pattern. Expensive components memoized. Large lists virtualized.
**Depends on**: Nothing
**Estimated effort**: 1 session
**Files**: `src/components/FinancePanel.tsx`, `src/components/AgentPanel.tsx`, `src/components/InboxPanel.tsx`, `src/components/TaskDetailPanel.tsx`

Plans:
- [ ] 88.7-01: PanelHeader migration + component extraction + virtualization

**Tasks**:

1. **Migrate FinancePanel to PanelHeader + TabNav** — Replace the custom Flex header (lines 335-374) with the standard `PanelHeader` + `TabNav` pattern.
   - Files: `src/components/FinancePanel.tsx`

2. **Extract AvatarWithFallback** — Move from inline definition in AgentPanel to `src/components/AvatarWithFallback.tsx`, wrap with `React.memo`.
   - Files: `src/components/AgentPanel.tsx` (lines 43-74)

3. **Memoize FinancePanel helpers** — Wrap `formatCurrency`, `getProgressColor`, `getCategoryIcon` in `useCallback`.
   - Files: `src/components/FinancePanel.tsx` (lines 271-305)

4. **Virtualize InboxPanel list** — Use existing `VirtualList.tsx` component for inbox items.
   - Files: `src/components/InboxPanel.tsx`

5. **Bound activity feed** — Add `slice(-500)` in `addActivity` action to prevent unbounded growth.
   - Files: `src/store/store.ts` (lines 260-262)

6. **Bound chatRoom artifacts** — Add `slice(-MAX_ARTIFACTS)` in `addArtifact` action (messages already have this).
   - Files: `src/store/chatRoomStore.ts` (line 337)

**Verify**: `npm run build:verify`. Visually check FinancePanel header matches Library panel.

---

### Phase 88.8: TypeScript & DX (P2)
**Goal**: Stricter type checking, scoped linting, pre-commit safety net.
**Depends on**: Nothing
**Estimated effort**: 1 session
**Files**: `tsconfig.json`, `.eslintrc.cjs`, `package.json`, `next.config.js`

Plans:
- [ ] 88.8-01: noImplicitAny + eslint scoping + pre-commit hooks + CSP split

**Tasks**:

1. **Enable noImplicitAny** — Set `noImplicitAny: true` in tsconfig.json. Fix the ~17 remaining `any` casts (most are in test files — add explicit types or `unknown` where appropriate).
   - Files: `tsconfig.json` (line 12), then grep for errors

2. **Scope eslint-disable directives** — Replace file-level `/* eslint-disable react-hooks/exhaustive-deps */` with line-level disables with explanation comments.
   - Files: `src/components/MeetingTranscribe.tsx`, `src/components/NotificationSettingsModal.tsx`, and any others

3. **Add pre-commit hooks** — Install `husky` + `lint-staged`. Configure: `*.ts,*.tsx` → `eslint --fix --max-warnings=0` + `tsc --noEmit`.
   - Files: `package.json`, new `.husky/pre-commit`

4. **Split CSP for artifact preview** — Move `'unsafe-eval'` and CDN URLs to artifact-specific header config. Main app routes get strict CSP without eval.
   - Files: `next.config.js` (lines 36-47)

**Verify**: `npm run build:verify`. Commit a file with a type error — pre-commit hook should block it.

---

### Phase 88.9: Accessibility & Polish (P3)
**Goal**: Icon buttons have aria-labels, data structures are bounded, minor polish items resolved.
**Depends on**: Phases 88.7 (UI changes)
**Estimated effort**: 30 min
**Files**: Various components

Plans:
- [ ] 88.9-01: Aria labels + remaining bounds + minor polish

**Tasks**:

1. **Add aria-labels to icon-only buttons** — Audit and add `aria-label="Verb + Object"` to all icon-only buttons in ActivityFeed, NotesPanel, InboxPanel, and any others.
   - Files: `src/components/ActivityFeed.tsx` (line 146), `src/components/NotesPanel.tsx`, `src/components/InboxPanel.tsx`

2. **Add model pricing update comment** — Add `// UPDATE ANNUALLY — check Anthropic pricing page` above MODEL_PRICING in env.ts.
   - Files: `src/lib/env.ts` (line 156)

3. **Cache headers on remaining read endpoints** — Add appropriate `Cache-Control` to any GET routes still missing them (projects, campaigns, notes, finance).
   - Files: Various GET route handlers

**Verify**: `npm run build:verify`. Tab through UI with keyboard — all buttons should announce their purpose.

---

## Verification (Full Milestone)

1. `npm run build:verify` — clean build, zero errors
2. Dispatch 3 tasks, preempt 1 with P0 — activeDispatches counter stays accurate
3. Open 2 browser tabs — create/update task in one, appears in other via SSE (no polling)
4. SSE disconnect test — kill `/api/events`, verify UI shows disconnected indicator, auto-reconnects
5. Budget enforcement — set $0.01 limit, dispatch blocked with activity log
6. Scratchpad MCP — agent writes to scratchpad, second agent reads it
7. Pre-commit hook — introduce a type error, verify commit is blocked
8. Lighthouse accessibility audit — no missing aria-label warnings on interactive elements
