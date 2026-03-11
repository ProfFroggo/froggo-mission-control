# Next.js Patterns — Mission Control Platform Reference

Platform: Next.js App Router (v16), React 18, TypeScript strict, Tailwind 3.4, Zustand, better-sqlite3

---

## App Router Fundamentals

### Server vs Client Components

The rule: **Server Components by default. Add `"use client"` only when you need browser APIs, event handlers, or React hooks.**

```
Server Components can:           Client Components can:
- fetch data directly            - use useState, useEffect, etc.
- access backend resources       - attach event listeners
- keep secrets on server         - use browser APIs (localStorage, etc.)
- reduce client JS bundle        - access React context

Server Components CANNOT:        Client Components CANNOT:
- use hooks                      - directly run server code
- attach event handlers          - access server-only resources
- use browser APIs
```

**Common mistake**: Adding `"use client"` to a component just because it imports a client component. You can render Client Components inside Server Components — the tree doesn't need to all be the same type.

**Pattern**: Push `"use client"` as far down the tree as possible. A page can be a Server Component that renders a Client Component only for the interactive button.

```tsx
// Good: Server Component page, only the interactive bit is client
// app/tasks/page.tsx (Server Component — no directive needed)
import { TaskList } from '@/components/TaskList'; // Server Component
import { CreateTaskButton } from '@/components/CreateTaskButton'; // Client Component

export default async function TasksPage() {
  const tasks = await db.getTasks(); // direct DB access fine here
  return (
    <>
      <TaskList tasks={tasks} />
      <CreateTaskButton />
    </>
  );
}
```

### Route Segments

```
app/
├── layout.tsx          — shared UI for all routes in this segment
├── page.tsx            — the route's UI
├── loading.tsx         — Suspense fallback for this segment
├── error.tsx           — error boundary for this segment
├── not-found.tsx       — 404 for this segment
└── (groupName)/        — route group (doesn't affect URL)
    └── page.tsx
```

**Layout persistence**: Layouts don't re-render on navigation between their child pages. State inside a layout survives route changes. Don't store per-page state in a layout.

### Metadata

```tsx
// Static metadata
export const metadata = {
  title: 'Mission Control',
  description: '...',
};

// Dynamic metadata
export async function generateMetadata({ params }) {
  const task = await getTask(params.id);
  return { title: task.title };
}
```

---

## Data Fetching Patterns

### Server Component Data Fetch

```tsx
// app/tasks/[id]/page.tsx
export default async function TaskPage({ params }: { params: { id: string } }) {
  // Direct async call — no useEffect, no loading state needed
  const task = await getTaskById(params.id);

  if (!task) notFound(); // triggers not-found.tsx

  return <TaskDetail task={task} />;
}
```

### Server Actions

Use Server Actions for mutations from forms and buttons — they run on the server, can directly access the DB, and handle revalidation.

```tsx
// actions/tasks.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assignedTo: z.string(),
});

export async function createTask(formData: FormData) {
  const parsed = CreateTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    assignedTo: formData.get('assignedTo'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  await db.createTask(parsed.data);
  revalidatePath('/tasks');
  return { success: true };
}
```

**When to use Server Actions vs API routes:**
- Server Action: form submissions, mutations triggered by UI interactions, no need for external consumers
- API Route: webhooks, MCP tool endpoints, external integrations, or when the caller isn't a React component

### API Routes

```tsx
// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const tasks = await getTasks({ status: status ?? undefined });
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // validate body before using
  const task = await createTask(body);
  return NextResponse.json(task, { status: 201 });
}
```

**Dynamic route handlers:**
```tsx
// app/api/tasks/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const task = await getTask(params.id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}
```

---

## Environment Variables

**NEVER use `process.env` directly in components or routes.** Always import from `src/lib/env.ts`.

```typescript
// src/lib/env.ts — the single source of truth
export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  // Add new vars here with proper validation
};
```

Client-accessible vars must be prefixed `NEXT_PUBLIC_`. All others are server-only.

---

## Zustand State Patterns

### Store Structure

```typescript
// src/store/taskStore.ts
import { create } from 'zustand';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignedTo: string | null;
}

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  isLoading: boolean;

  // Actions
  setTasks: (tasks: Task[]) => void;
  selectTask: (id: string | null) => void;
  updateTaskOptimistic: (id: string, updates: Partial<Task>) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  isLoading: false,

  setTasks: (tasks) => set({ tasks }),

  selectTask: (id) => set({ selectedTaskId: id }),

  updateTaskOptimistic: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),
}));
```

### Selectors to Prevent Re-renders

```typescript
// Bad: subscribes to entire store, re-renders on any change
const { tasks, isLoading } = useTaskStore();

// Good: selector returns stable reference if output hasn't changed
const tasks = useTaskStore((state) => state.tasks);
const task = useTaskStore((state) => state.tasks.find((t) => t.id === id));
```

### Optimistic Updates Pattern

```typescript
const updateTaskOptimistic = useTaskStore((s) => s.updateTaskOptimistic);
const setTasks = useTaskStore((s) => s.setTasks);

async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
  // 1. Apply immediately to UI
  updateTaskOptimistic(taskId, { status: newStatus });

  try {
    // 2. Persist to server
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
  } catch (error) {
    // 3. Rollback on failure
    updateTaskOptimistic(taskId, { status: previousStatus });
    // show error toast
  }
}
```

---

## Component Patterns

### Platform UI Rules

```tsx
// WRONG: emoji in UI
<button>✅ Complete</button>

// RIGHT: Lucide icon
import { CheckCircle } from 'lucide-react';
<button><CheckCircle size={16} /> Complete</button>
```

```tsx
// WRONG: hardcoded colors
<div className="bg-[#1a1a2e] text-white">

// RIGHT: CSS variables via design tokens
<div className="bg-mission-control-surface text-mission-control-text">
```

```tsx
// WRONG: one-off form styling
<input className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white" />

// RIGHT: global forms.css class
<input className="input" />  // styled by forms.css globally
```

### Component File Structure

```tsx
// components/TaskCard.tsx
'use client'; // only if needed

import { type FC } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onSelect?: (id: string) => void;
  className?: string;
}

export const TaskCard: FC<TaskCardProps> = ({ task, onSelect, className }) => {
  return (
    <div
      className={cn('rounded-lg p-4 bg-mission-control-surface', className)}
      onClick={() => onSelect?.(task.id)}
    >
      {/* ... */}
    </div>
  );
};
```

### Error Boundaries

```tsx
// app/tasks/error.tsx — catches errors in the tasks segment
'use client';

export default function TasksError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <p>Something went wrong loading tasks.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## Common Pitfalls in This Codebase

### Undefined Tailwind Tokens

The build fails silently on `bg-mission-control-bg1` — this token doesn't exist. Use `bg-mission-control-surface` instead. When in doubt, check `src/globals.css` for the actual CSS variable definitions.

### process.env in Client Components

`process.env.ANYTHING` in a Client Component that isn't prefixed `NEXT_PUBLIC_` will be `undefined` at runtime and won't throw a build error. Always use `src/lib/env.ts`.

### Missing "use client" on Event Handlers

A component with `onClick` that isn't marked `"use client"` will cause a cryptic runtime error, not a build error. Symptoms: "Event handlers cannot be passed to Client Component props."

### Stale Closures in useEffect

```typescript
// Bug: `taskId` captured at mount, never updates
useEffect(() => {
  poll(taskId); // stale if taskId prop changes
}, []); // missing dependency

// Fix: include all dependencies
useEffect(() => {
  poll(taskId);
}, [taskId]);
```

### SQLite Concurrency via MCP

Do not write directly to the SQLite database from Next.js code. All database access goes through the `mission-control_db` MCP tools to avoid write locks and concurrent access issues.

### API Route vs Server Action Confusion

If a mutation is called from a form or button click in a React component, prefer a Server Action. Only use an API route if: (a) an external system needs to call it, (b) the MCP server needs to call it, or (c) you need full control over the HTTP response.

---

## Testing Patterns for Next.js

### Unit Testing Utilities

```typescript
// vitest.config.ts — already configured, don't change
// Tests live in __tests__/ or *.test.ts(x) alongside source files

// Testing a pure utility
import { describe, it, expect } from 'vitest';
import { formatTaskStatus } from '@/lib/formatters';

describe('formatTaskStatus', () => {
  it('formats todo as "To Do"', () => {
    expect(formatTaskStatus('todo')).toBe('To Do');
  });
});
```

### Testing Server Actions

```typescript
import { createTask } from '@/actions/tasks';

it('returns error for missing title', async () => {
  const formData = new FormData();
  formData.set('assignedTo', 'coder');
  // title intentionally missing

  const result = await createTask(formData);
  expect(result.error).toBeDefined();
});
```

### Testing API Routes

```typescript
import { GET } from '@/app/api/tasks/route';
import { NextRequest } from 'next/server';

it('returns 404 for unknown task', async () => {
  const request = new NextRequest('http://localhost/api/tasks/nonexistent');
  const response = await GET(request, { params: { id: 'nonexistent' } });
  expect(response.status).toBe(404);
});
```
