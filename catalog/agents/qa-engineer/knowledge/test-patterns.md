# Test Patterns — Mission Control Platform Reference

Stack: Vitest (unit/integration), Playwright (E2E), React Testing Library, TypeScript strict

---

## Testing Philosophy

### The Testing Pyramid

```
         ┌─────────────────┐
         │   E2E (few)     │  ← Critical user journeys only
         │   Playwright     │
        ─┼─────────────────┼─
        │  Integration     │  ← Data flow across boundaries
        │  Vitest + RTL    │
       ─┼──────────────────┼─
      │    Unit Tests      │  ← Pure logic, utilities, transformers
      │    Vitest          │
     ─┼────────────────────┼─
```

**Unit tests**: Fast, isolated, test one thing. Pure functions, utility logic, data transformers. No I/O, no component rendering.

**Integration tests**: Test how components and modules work together. Component rendering with realistic props, hook behavior with state, API route logic with a test database. Some mocking at external I/O boundaries.

**E2E tests**: Test complete user journeys through the browser. Only for critical flows — task creation, status transitions, agent assignment. Expensive to run and maintain; use sparingly.

---

## Vitest Setup

```typescript
// vitest.config.ts — already configured in platform repo
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});
```

### Running Tests

```bash
# Run all unit/integration tests
npx vitest run

# Run in watch mode (development)
npx vitest

# Run specific file
npx vitest run src/components/TaskCard.test.tsx

# Run with coverage
npx vitest run --coverage

# TypeScript check (always run before testing)
npx tsc --noEmit

# Build check
npm run build
```

---

## Unit Test Patterns

### Testing Pure Utilities

```typescript
// src/lib/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatTaskStatus, formatPriority, truncateTitle } from '@/lib/formatters';

describe('formatTaskStatus', () => {
  it('formats each status correctly', () => {
    expect(formatTaskStatus('todo')).toBe('To Do');
    expect(formatTaskStatus('in-progress')).toBe('In Progress');
    expect(formatTaskStatus('done')).toBe('Done');
    expect(formatTaskStatus('human-review')).toBe('Human Review');
  });

  it('handles unknown status gracefully', () => {
    // @ts-expect-error — testing runtime behavior with invalid input
    expect(formatTaskStatus('unknown')).toBe('Unknown');
  });
});

describe('truncateTitle', () => {
  it('returns title unchanged when under limit', () => {
    expect(truncateTitle('Short title', 50)).toBe('Short title');
  });

  it('truncates at word boundary with ellipsis', () => {
    const long = 'This is a very long title that exceeds the limit';
    expect(truncateTitle(long, 20)).toMatch(/\.\.\.$/);
    expect(truncateTitle(long, 20).length).toBeLessThanOrEqual(23); // 20 + '...'
  });

  it('handles empty string', () => {
    expect(truncateTitle('', 50)).toBe('');
  });

  it('handles exactly the limit length', () => {
    const exact = 'A'.repeat(50);
    expect(truncateTitle(exact, 50)).toBe(exact); // no truncation
  });
});
```

### Testing Data Transformers

```typescript
// Tests for functions that reshape data
describe('mapTaskFromDb', () => {
  it('maps all fields correctly', () => {
    const dbRow = {
      id: 1,
      uuid: 'abc-123',
      title: 'Fix login bug',
      status: 'todo',
      priority: 'high',
      assigned_to: 'coder',
      created_at: '2025-01-15T10:00:00Z',
    };

    const result = mapTaskFromDb(dbRow);

    expect(result).toEqual({
      id: 'abc-123',
      title: 'Fix login bug',
      status: 'todo',
      priority: 'high',
      assignedTo: 'coder',
      createdAt: new Date('2025-01-15T10:00:00Z'),
    });
  });

  it('handles null assignedTo', () => {
    const row = { ...validRow, assigned_to: null };
    expect(mapTaskFromDb(row).assignedTo).toBeNull();
  });
});
```

---

## Component Test Patterns (React Testing Library)

### Basic Component Rendering

```typescript
// src/components/TaskCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard';

const mockTask = {
  id: 'task-123',
  title: 'Implement dark mode',
  status: 'in-progress' as const,
  priority: 'high' as const,
  assignedTo: 'coder',
};

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Implement dark mode')).toBeInTheDocument();
  });

  it('shows correct status badge', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('calls onSelect with task id when clicked', async () => {
    const onSelect = vi.fn();
    render(<TaskCard task={mockTask} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('article'));

    expect(onSelect).toHaveBeenCalledWith('task-123');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders without crashing when onSelect is not provided', () => {
    expect(() => render(<TaskCard task={mockTask} />)).not.toThrow();
  });
});
```

### Testing Forms and User Interactions

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('CreateTaskForm', () => {
  it('shows validation error when title is empty on submit', async () => {
    render(<CreateTaskForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /create task/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });

  it('calls onSubmit with form values when valid', async () => {
    const onSubmit = vi.fn();
    render(<CreateTaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/title/i), 'Fix the bug');
    await userEvent.selectOptions(
      screen.getByLabelText(/assign to/i),
      'coder'
    );
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Fix the bug',
        assignedTo: 'coder',
      });
    });
  });

  it('clears form after successful submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<CreateTaskForm onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.type(titleInput, 'Fix the bug');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(titleInput).toHaveValue('');
    });
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';

describe('useTaskFilter', () => {
  it('filters tasks by status', () => {
    const tasks = [
      { id: '1', status: 'todo' },
      { id: '2', status: 'in-progress' },
      { id: '3', status: 'done' },
    ];

    const { result } = renderHook(() => useTaskFilter(tasks));

    act(() => {
      result.current.setFilter('todo');
    });

    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0].id).toBe('1');
  });

  it('returns all tasks when filter is "all"', () => {
    const { result } = renderHook(() => useTaskFilter(mockTasks));
    expect(result.current.filteredTasks).toHaveLength(mockTasks.length);
  });
});
```

### What to Mock vs What Not to Mock

**Mock**:
- `fetch` / HTTP calls to external APIs
- Date/time (`vi.useFakeTimers()`)
- Browser APIs not available in jsdom (e.g., `window.matchMedia`)
- File system access

**Do NOT mock**:
- Pure business logic functions
- React state and effects (test their behavior, not their internals)
- CSS-in-JS behavior (test by rendered output)
- The component's own dependencies unless they have side effects

---

## API Route Testing

```typescript
// app/api/tasks/route.test.ts
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('@/lib/database', () => ({
  db: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
  },
}));

import { db } from '@/lib/database';

describe('GET /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tasks with 200 status', async () => {
    const mockTasks = [{ id: '1', title: 'Task 1', status: 'todo' }];
    vi.mocked(db.getTasks).mockResolvedValue(mockTasks);

    const request = new NextRequest('http://localhost/api/tasks');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockTasks);
  });

  it('filters by status when query param provided', async () => {
    vi.mocked(db.getTasks).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/tasks?status=todo');
    await GET(request);

    expect(db.getTasks).toHaveBeenCalledWith(expect.objectContaining({ status: 'todo' }));
  });

  it('returns 500 when database throws', async () => {
    vi.mocked(db.getTasks).mockRejectedValue(new Error('DB connection failed'));

    const request = new NextRequest('http://localhost/api/tasks');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});
```

---

## Playwright E2E Patterns

### Setup

```typescript
// playwright.config.ts — platform configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Writing Stable E2E Tests

```typescript
// e2e/task-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
  });

  test('creates a new task and shows it in the list', async ({ page }) => {
    // Use data-testid for stable selectors
    await page.getByTestId('create-task-button').click();

    await page.getByLabel('Title').fill('Test task from E2E');
    await page.getByLabel('Assign to').selectOption('coder');
    await page.getByRole('button', { name: 'Create Task' }).click();

    // Wait for task to appear — use waitForSelector, not sleep
    await expect(page.getByText('Test task from E2E')).toBeVisible();
  });

  test('shows validation error for empty title', async ({ page }) => {
    await page.getByTestId('create-task-button').click();
    await page.getByRole('button', { name: 'Create Task' }).click();

    await expect(page.getByText(/title is required/i)).toBeVisible();
  });

  test('persists task after page refresh', async ({ page }) => {
    // Create task
    await page.getByTestId('create-task-button').click();
    await page.getByLabel('Title').fill('Persistent task test');
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText('Persistent task test')).toBeVisible();

    // Refresh and verify
    await page.reload();
    await expect(page.getByText('Persistent task test')).toBeVisible();
  });
});
```

### Selector Priority (most to least stable)

1. `getByRole` — matches by ARIA role, most accessible and resilient
2. `getByLabel` — matches form inputs by associated label
3. `getByTestId` — `data-testid` attribute on component
4. `getByText` — exact text content match
5. CSS selectors — avoid; breaks on refactors

**Never use**: Element position selectors (`nth-child`), layout-dependent selectors, class names that contain styling information.

---

## What the CI Runs

```bash
# Full CI test sequence (must all pass before merge):
npx tsc --noEmit          # TypeScript — zero errors
npm run build              # Next.js build — zero errors
npx vitest run             # Unit + integration tests — zero failures
npx playwright test        # E2E tests — zero failures (critical paths only)
```

Run this sequence locally before moving any task to `agent-review`.

---

## Edge Case Checklist

For every feature with a UI or API, test these scenarios before signing off:

### Input / Data
- [ ] Empty input / no data
- [ ] Single item (not just "multiple")
- [ ] Maximum length / maximum count
- [ ] Special characters in text fields: `<`, `>`, `"`, `'`, `&`, `\n`, unicode
- [ ] Numeric inputs: 0, negative numbers, very large numbers, non-numeric input in numeric field
- [ ] Date/time: past dates, future dates, timezone edge cases

### State and Timing
- [ ] State at start (fresh load vs returning user with existing data)
- [ ] Rapid consecutive actions (click submit twice quickly)
- [ ] Operation during loading (click something while a previous action is in flight)
- [ ] After an error (does the UI recover correctly after a failed action?)

### Permissions and Access
- [ ] Unauthenticated user accessing protected resource
- [ ] User attempting action on another user's data
- [ ] Expired session mid-action

### Error States
- [ ] Network failure / API returns 500
- [ ] API returns unexpected response shape
- [ ] Timeout / slow response

### Accessibility
- [ ] Keyboard navigation works for all interactive elements
- [ ] Focus management after modal open/close
- [ ] Error messages are announced to screen readers
- [ ] Color contrast meets WCAG AA

---

## Bug Report Template

```markdown
## Bug: [Short descriptive title]

**Severity**: P0 / P1 / P2 / P3
**Status**: Open
**Environment**: [Browser, OS, localhost:3000 / staging]
**Discovered during**: [Task ID or test run]

### Steps to Reproduce
1. [Exact step]
2. [Exact step]
3. [Exact step]

### Expected Behavior
[What should happen according to requirements]

### Actual Behavior
[What actually happens — be specific]

### Evidence
[Screenshot, error message, failing test output]

### Hypothesis
[If known: suspected root cause]

### Regression Risk
[What other features might be affected by a fix here]
```

**Severity Guide**:
- **P0**: Platform is down or data is corrupted. Fix immediately.
- **P1**: Core feature is broken. Users cannot complete primary workflows. Fix before next release.
- **P2**: Feature works with workaround. Fix in next sprint.
- **P3**: Minor issue, cosmetic, or rare edge case. Fix when convenient.
