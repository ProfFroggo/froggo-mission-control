# Architecture Patterns — Mission Control Platform Reference

Platform: Next.js App Router (v16), React 18, TypeScript strict, better-sqlite3 (SQLite), Zustand, MCP tools

---

## Architecture Decision Records (ADR)

### ADR Template

Use this format when documenting any significant architecture decision. Save to task activity and memory.

```markdown
# ADR-NNNN: [Short Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
**Deciders**: [Chief, Senior Coder, etc.]

## Context

What is the situation that requires a decision? What constraints exist?
What options were considered?

## Decision

What was decided? State it clearly.

## Consequences

**Positive**: What becomes easier, better, or possible?
**Negative**: What becomes harder, worse, or is the accepted trade-off?
**Risks**: What could go wrong, and how will we know?

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Option A | ... | ... | ... |
| Option B | ... | ... | ... |
```

---

## System Design Principles

### Layering

The platform follows a clear layering model. Dependencies only point inward:

```
HTTP/MCP Layer (routes, MCP tool handlers)
       ↓
Application Layer (actions, orchestration)
       ↓
Domain Layer (business logic, validation)
       ↓
Data Layer (database access via MCP, SQLite)
```

**Violations to avoid**:
- Database queries in React components (goes through MCP or API routes)
- Business logic in API route handlers (should be in domain layer functions)
- UI state affecting data persistence directly (Zustand manages UI state; server manages data state)

### Coupling Guidelines

**Tight coupling is OK when**:
- Two things always change together
- They are in the same domain concept
- Separating them would require unnecessary indirection

**Loose coupling is required when**:
- Components change at different rates (UI vs business logic)
- A change in one should not require a change in the other
- The consumer doesn't need to know about implementation details

**Warning signs of over-coupling**:
- Changing one component requires reading three others to understand the impact
- A "simple" feature requires touching files in unrelated directories
- Tests require setting up state that isn't relevant to what's being tested

### Cohesion Guidelines

Group things that change together. In the Mission Control codebase:

```
src/
├── components/          — UI components (change with design)
│   └── [feature]/       — co-locate sub-components with their feature
├── store/               — client state (change with UI interaction patterns)
├── lib/                 — utilities and cross-cutting concerns
│   ├── database.ts      — DB access wrapper
│   ├── env.ts           — environment variable access
│   └── utils.ts         — general utilities
├── actions/             — Server Actions (change with business rules)
└── app/
    └── api/             — API routes (change with external interface contracts)
```

---

## Database Schema Patterns

### SQLite via better-sqlite3

The platform uses SQLite accessed via the `mission-control_db` MCP server. Never access the DB file directly from Next.js code.

**Schema design principles for SQLite**:

```sql
-- Always use INTEGER PRIMARY KEY (implicit rowid alias, fastest)
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index columns you filter/join on
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- Use TEXT for datetimes in ISO 8601 format (SQLite has no native date type)
-- Use TEXT for enums (validate at application layer)
-- Use INTEGER 0/1 for booleans
```

**Migration strategy**: Each schema change gets a numbered migration file. Migrations run in order, never skip, never modify an existing migration. Use the MCP migration tools to apply.

**N+1 query prevention**: If loading a list with related data, use a JOIN or two separate queries with `WHERE id IN (...)`, not a query per row.

```sql
-- Bad: N+1 pattern
SELECT * FROM tasks;
-- then for each task:
SELECT * FROM task_activity WHERE task_id = ?;

-- Good: single join
SELECT t.*, ta.id as activity_id, ta.message
FROM tasks t
LEFT JOIN task_activity ta ON ta.task_id = t.id
WHERE t.status = 'in-progress';
```

### Common Schema Gotchas

- SQLite does not enforce foreign keys by default. Enable with `PRAGMA foreign_keys = ON` at connection time.
- `TEXT` comparisons are case-sensitive in SQLite unless you use `COLLATE NOCASE`.
- `NULL != NULL` in SQL — use `IS NULL` / `IS NOT NULL` for null checks in WHERE clauses.
- Concurrent writes to SQLite will fail if the file is locked. The MCP server serializes writes — don't bypass it.

---

## API Design Patterns

### REST Conventions

```
GET    /api/tasks              — list (supports ?status=, ?assignedTo= query params)
GET    /api/tasks/:id          — single resource
POST   /api/tasks              — create (returns 201 with created resource)
PATCH  /api/tasks/:id          — partial update (returns updated resource)
DELETE /api/tasks/:id          — delete (returns 204 no content)
```

**Error responses**: Always return structured errors, never raw strings.

```typescript
// Consistent error shape
interface ApiError {
  error: string;          // human-readable message
  code?: string;          // machine-readable code for client handling
  details?: unknown;      // validation errors, etc.
}

// Usage
return NextResponse.json(
  { error: 'Task not found', code: 'TASK_NOT_FOUND' },
  { status: 404 }
);
```

**Validation**: Validate input at the API boundary using Zod. Never trust incoming data.

```typescript
import { z } from 'zod';

const UpdateTaskSchema = z.object({
  status: z.enum(['todo', 'internal-review', 'in-progress', 'agent-review', 'human-review', 'done']).optional(),
  title: z.string().min(1).max(200).optional(),
  assignedTo: z.string().nullable().optional(),
}).strict(); // reject unknown keys
```

### API Versioning

Not currently used. If a breaking change is needed, prefix with `/api/v2/`. The default `/api/` is implicitly v1.

---

## Performance Profiling Approach

### React Render Performance

**Tools**:
- React DevTools Profiler — measure component render time and frequency
- `why-did-you-render` — flag unnecessary re-renders in development

**Common causes of unnecessary re-renders**:

```typescript
// Problem: new object/array created on every render
function Parent() {
  const config = { theme: 'dark' }; // new reference every render
  return <Child config={config} />;
}

// Fix: useMemo for objects, useCallback for functions
function Parent() {
  const config = useMemo(() => ({ theme: 'dark' }), []);
  return <Child config={config} />;
}

// Problem: Zustand selector returns new array each time
const activeTasks = useStore((s) => s.tasks.filter((t) => t.active)); // new array every call

// Fix: use shallow equality or memoize selector
import { shallow } from 'zustand/shallow';
const activeTasks = useStore((s) => s.tasks.filter((t) => t.active), shallow);
```

### Bundle Size

**Check**: `npm run build` output shows page sizes. Investigate pages over 100kB first-load JS.

**Common causes**:
- Importing from a large library when only one function is needed
- `import * as` instead of named imports
- Not using dynamic imports for heavy components

```typescript
// Heavy component loaded lazily
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <ChartSkeleton />,
});
```

### SQLite Query Performance

**Profile**: The MCP tools log query times. Look for queries over 100ms.

**Common issues**:
- Missing index on filtered column (check with `EXPLAIN QUERY PLAN`)
- Loading all columns when only a few are needed (`SELECT *` vs `SELECT id, title`)
- Reading all rows and filtering in JavaScript instead of in SQL

---

## Complexity Cost Estimation

Use this framework when evaluating whether to build a feature a given way:

### The "Future Engineer" Test

Before finalizing an implementation, ask: if a new engineer joined today and had to maintain this, what would they need to understand that isn't in the code?

- If the answer is "nothing unexpected" — the complexity is appropriate
- If the answer is "a lot of context about why we did X instead of Y" — document that context or simplify the approach

### Complexity Budget

Every system has a finite complexity budget. Each abstraction layer spends some of it.

| Pattern | Complexity Cost | Earns Back |
|---------|----------------|------------|
| New abstraction layer | High | Justified if 3+ concrete uses |
| New shared utility | Medium | Justified if DRY gain is real |
| Inline implementation | Low | Justified if unique to one context |
| New external dependency | High | Justified if it handles something genuinely hard |
| New DB table | Medium | Justified if the data has distinct semantics |

**Rule of three**: Do not abstract until there are three concrete, similar cases. Two similar things might be a coincidence. Three is a pattern.

---

## Refactor vs Rewrite Decision Framework

**Refactor when**:
- The fundamental data model is sound
- The interfaces are correct, the implementation is messy
- Tests exist and can guide the cleanup
- Changes can be made incrementally without breaking things

**Rewrite when**:
- The data model is fundamentally wrong
- The interface is broken and requires changes across many consumers
- The code cannot be tested without running the whole system
- A rewrite would take less time than understanding the current code well enough to fix it safely

**Warning**: Rewrites almost always take longer than estimated. The estimate ignores all the edge cases the original implementation handled that aren't visible from the outside. If rewriting, do it incrementally with a strangler fig pattern — run old and new in parallel, migrate consumers one at a time.

---

## Multi-Agent System Design Notes

The Mission Control platform is itself a multi-agent system. Architectural decisions in the platform affect how agents coordinate. Key principles:

### Agent State Isolation

Each agent's workspace (`~/mission-control/agents/{id}/`) is their private state. The shared state is the task database. Agents communicate via:
- Task status changes (visible to all via MCP query)
- Task activity log (audit trail)
- Chat room messages (async communication)

### Task as Coordination Primitive

Tasks are the unit of work handoff between agents. A well-formed task has:
- Clear acceptance criteria
- Explicit assignee
- All context needed to start (no "tribal knowledge" required)
- Subtasks for phases longer than 1hr

**Anti-pattern**: Implicit coordination via shared mutable state outside the task database. If two agents need to coordinate, they do it via task activity comments and explicit status transitions, not via filesystem side-effects.

### Idempotency

Agent operations should be idempotent where possible — running the same task twice should produce the same result, not duplicate data or double-apply effects. Design database operations accordingly (upsert over insert where appropriate).
