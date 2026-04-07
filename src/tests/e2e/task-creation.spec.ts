// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// E2E tests for the Mission Control task creation flow.
//
// Test scope:
//   - API contract: POST /api/tasks — happy path (201), missing title (400),
//     empty/whitespace title (400), title > 500 chars (400)
//   - API contract: GET /api/tasks — returns array; newly created task visible in list
//   - UI happy path: navigate to Tasks board → open modal → fill title → submit → task in board
//   - UI edge cases: Create Task button disabled when title is empty; re-enables on input
//
// Tests target the dev server at localhost:3000. The playwright.config.ts
// webServer block starts it automatically if not already running.
// Auth (INTERNAL_API_TOKEN) is disabled in local dev — no token needed.
// If auth IS enabled, API tests skip gracefully via test.skip().

import { test, expect, type Page } from '@playwright/test';

// ── Stable unique prefix so test tasks are easy to identify and don't collide ──
const RUN_ID = `E2E-${Date.now()}`;

// ── UI Helpers ────────────────────────────────────────────────────────────────

/**
 * Navigate to the Tasks (Kanban) board.
 * Waits for the React app to hydrate — the sidebar's data-view="kanban" button
 * is rendered by the lazy-loaded App component, not the SSR skeleton.
 *
 * On first load the app shows an onboarding wizard ("Welcome to Mission Control").
 * We dismiss it via "Skip Setup" before interacting with the task board.
 */
async function goToTasksBoard(page: Page) {
  await page.goto('/');
  // Wait for the App to hydrate: sidebar nav button for kanban view
  await page.waitForSelector('[data-view="kanban"]', { timeout: 25000 });

  // Dismiss the onboarding wizard if it appears (shown on fresh browser contexts)
  const skipSetup = page.getByRole('link', { name: /Skip Setup/i }).or(
    page.getByRole('button', { name: /Skip Setup/i })
  );
  // Allow up to 3s for the wizard to appear; if it doesn't, we're already past it
  try {
    await skipSetup.waitFor({ timeout: 3000 });
    await skipSetup.click();
    // Wait for the overlay to close
    await page.waitForSelector('[class*="fixed inset-0"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
  } catch {
    // Wizard not present — continue
  }

  await page.locator('[data-view="kanban"]').click();
  // Wait for the kanban toolbar — the "New Task" button is the canonical signal
  await page.waitForSelector('button:has-text("New Task")', { timeout: 15000 });
}

/**
 * Open the task creation modal and switch it to Manual Entry mode.
 * The modal is lazy-loaded via React Suspense, so we wait for the heading.
 */
async function openTaskModalManual(page: Page) {
  // The button text is "New Task" (may include a <kbd> child — text match is sufficient)
  await page.click('button:has-text("New Task")');
  // Modal is lazy-loaded — wait for the heading
  await expect(page.getByRole('heading', { name: 'Create New Task' })).toBeVisible({ timeout: 10000 });
  // Switch from the default Chat mode to Manual Entry
  await page.getByRole('button', { name: /Manual Entry/i }).click();
  // Confirm the title field is now visible
  await expect(page.locator('#task-title')).toBeVisible({ timeout: 5000 });
}

// ── API: POST /api/tasks ──────────────────────────────────────────────────────

test.describe('API: POST /api/tasks — happy path', () => {
  test('creates a task and returns 201 with id, title, and status', async ({ request }) => {
    const title = `${RUN_ID} api-happy-path`;

    const res = await request.post('/api/tasks', {
      data: { title, status: 'todo', priority: 'p3' },
    });

    // If auth is enforced in this environment, skip gracefully
    if (res.status() === 401 || res.status() === 403) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('string');
    expect(body.id).toMatch(/^task-/);
    expect(body).toHaveProperty('title', title);
    expect(body).toHaveProperty('status', 'todo');
    expect(body).toHaveProperty('priority', 'p3');
    // reviewerId defaults to 'clara' when unset
    expect(body).toHaveProperty('reviewerId', 'clara');
  });
});

test.describe('API: POST /api/tasks — validation errors', () => {
  test('returns 400 when title field is absent', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { status: 'todo' },
    });

    if (res.status() === 401 || res.status() === 403) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/title/i);
  });

  test('returns 400 when title is an empty string', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: '', status: 'todo' },
    });

    if (res.status() === 401 || res.status() === 403) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/title/i);
  });

  test('returns 400 when title is whitespace-only', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: '   \n   ', status: 'todo' },
    });

    if (res.status() === 401 || res.status() === 403) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when title exceeds 500 characters', async ({ request }) => {
    const longTitle = 'T'.repeat(501);

    const res = await request.post('/api/tasks', {
      data: { title: longTitle, status: 'todo' },
    });

    if (res.status() === 401 || res.status() === 403) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/500/i);
  });
});

// ── API: GET /api/tasks ───────────────────────────────────────────────────────

test.describe('API: GET /api/tasks', () => {
  test('returns HTTP 200 and an array', async ({ request }) => {
    const res = await request.get('/api/tasks');

    if (res.status() === 401 || res.status() === 403) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('newly created task is visible in GET /api/tasks list', async ({ request }) => {
    const title = `${RUN_ID} round-trip-visibility`;

    // Create
    const createRes = await request.post('/api/tasks', {
      data: { title, status: 'todo', priority: 'p3' },
    });

    if (createRes.status() === 401 || createRes.status() === 403) {
      test.skip();
      return;
    }

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created).toHaveProperty('id');

    // Retrieve list and confirm the task is present
    const listRes = await request.get('/api/tasks');
    expect(listRes.status()).toBe(200);
    const tasks = await listRes.json() as Record<string, unknown>[];

    const match = tasks.find((t) => t['id'] === created.id);
    expect(match).toBeDefined();
    expect(match!['title']).toBe(title);
    expect(match!['status']).toBe('todo');
  });
});

// ── UI: Task creation — happy path ────────────────────────────────────────────

test.describe('UI: Task creation — happy path', () => {
  test('creates a task via modal and it appears in the kanban board', async ({ page }) => {
    const title = `${RUN_ID} ui-happy-path`;

    await goToTasksBoard(page);
    await openTaskModalManual(page);

    // Fill in the task title
    await page.locator('#task-title').fill(title);

    // The submit button should now be enabled
    const submitBtn = page.locator('form button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });

    // Submit
    await submitBtn.click();

    // Modal should close on successful creation
    await expect(
      page.getByRole('heading', { name: 'Create New Task' })
    ).not.toBeVisible({ timeout: 12000 });

    // The new task card must appear in the kanban board.
    // Kanban renders task cards with aria-label="Task: {title}, status: {status}".
    await expect(
      page.locator(`[aria-label="Task: ${title}, status: todo"]`)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ── UI: Task creation — edge cases ────────────────────────────────────────────

test.describe('UI: Task creation — edge cases', () => {
  test('Create Task button is disabled when title field is empty', async ({ page }) => {
    await goToTasksBoard(page);
    await openTaskModalManual(page);

    const titleInput = page.locator('#task-title');
    const submitBtn = page.locator('form button[type="submit"]');

    // Confirm title is empty (default state)
    await expect(titleInput).toHaveValue('');

    // Submit button must be disabled — form must not be submittable without a title
    await expect(submitBtn).toBeDisabled();
  });

  test('Create Task button enables when title is typed then disables when title is cleared', async ({ page }) => {
    await goToTasksBoard(page);
    await openTaskModalManual(page);

    const titleInput = page.locator('#task-title');
    const submitBtn = page.locator('form button[type="submit"]');

    // Start disabled
    await expect(submitBtn).toBeDisabled();

    // Type a title — button must enable
    await titleInput.fill('A valid task title for edge case testing');
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });

    // Clear the title — button must disable again
    await titleInput.clear();
    await expect(submitBtn).toBeDisabled({ timeout: 3000 });
  });
});
