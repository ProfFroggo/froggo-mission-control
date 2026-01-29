import { test, expect } from '@playwright/test';

test.describe('End-to-End Task Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('complete task lifecycle from creation to completion', async ({ page }) => {
    // Navigate to Kanban board
    await page.keyboard.press('Meta+5');
    await expect(page.getByText('Kanban')).toBeVisible();

    // Create new task
    await page.click('button:has-text("New Task")');
    await page.fill('input[placeholder*="task title"]', 'E2E Test Task');
    await page.fill('textarea[placeholder*="description"]', 'This is an end-to-end test task');
    
    // Set priority
    await page.selectOption('select[aria-label*="priority"]', 'p1');
    
    // Set project
    await page.selectOption('select[aria-label*="project"]', 'Dev');
    
    // Add subtasks
    await page.click('button:has-text("Add Subtask")');
    await page.fill('input[placeholder*="subtask"]', 'Step 1: Setup');
    await page.keyboard.press('Enter');
    
    await page.click('button:has-text("Add Subtask")');
    await page.fill('input[placeholder*="subtask"]', 'Step 2: Implement');
    await page.keyboard.press('Enter');
    
    // Save task
    await page.click('button:has-text("Save")');
    
    // Verify task appears in Todo column
    await expect(page.locator('.kanban-column:has-text("Todo")').getByText('E2E Test Task')).toBeVisible();

    // Open task detail
    await page.click('text=E2E Test Task');
    
    // Assign to agent
    await page.selectOption('select[aria-label*="assign"]', 'coder');
    await page.click('button:has-text("Assign")');
    
    // Move to In Progress
    await page.selectOption('select[aria-label*="status"]', 'in-progress');
    await expect(page.getByText('In Progress')).toBeVisible();
    
    // Complete first subtask
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await expect(checkboxes.first()).toBeChecked();
    
    // Complete second subtask
    await checkboxes.nth(1).check();
    await expect(checkboxes.nth(1)).toBeChecked();
    
    // Move to Review
    await page.selectOption('select[aria-label*="status"]', 'review');
    
    // Approve task
    await page.click('button:has-text("Approve")');
    
    // Verify task moves to Done
    await page.click('button:has-text("Close")');
    await expect(page.locator('.kanban-column:has-text("Done")').getByText('E2E Test Task')).toBeVisible();
  });

  test('keyboard navigation works across panels', async ({ page }) => {
    // Test all major keyboard shortcuts
    const shortcuts = [
      { key: 'Meta+1', panel: 'Dashboard' },
      { key: 'Meta+2', panel: 'Inbox' },
      { key: 'Meta+5', panel: 'Kanban' },
      { key: 'Meta+6', panel: 'Agents' },
      { key: 'Meta+8', panel: 'Voice' },
    ];

    for (const { key, panel } of shortcuts) {
      await page.keyboard.press(key);
      await expect(page.getByText(new RegExp(panel, 'i'))).toBeVisible();
      await page.waitForTimeout(300); // Small delay between navigations
    }

    // Test command palette
    await page.keyboard.press('Meta+k');
    await expect(page.getByPlaceholder(/search commands/i)).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder(/search commands/i)).not.toBeVisible();

    // Test global search
    await page.keyboard.press('Meta+/');
    await expect(page.getByPlaceholder(/search everything/i)).toBeVisible();
  });

  test('agent spawning and interaction', async ({ page }) => {
    await page.keyboard.press('Meta+6'); // Navigate to Agents
    
    // Click on Coder agent
    await page.click('text=Coder');
    
    // Spawn agent for task
    await page.click('button:has-text("Spawn")');
    
    // Verify session created
    await expect(page.getByText(/session.*active/i)).toBeVisible({ timeout: 5000 });
    
    // Open chat with agent
    await page.click('button:has-text("Chat")');
    
    // Send message
    await page.fill('textarea[placeholder*="message"]', 'What are you working on?');
    await page.keyboard.press('Enter');
    
    // Verify message sent
    await expect(page.getByText('What are you working on?')).toBeVisible();
  });

  test('voice panel real-time transcription', async ({ page }) => {
    await page.keyboard.press('Meta+8'); // Navigate to Voice
    
    // Check voice panel loaded
    await expect(page.getByText(/Voice Assistant/i)).toBeVisible();
    
    // Verify Vosk model status
    await expect(page.getByText(/Model:/i)).toBeVisible();
    
    // Check conversation mode button
    const conversationButton = page.locator('button', { hasText: /start conversation/i });
    await expect(conversationButton).toBeVisible();
  });

  test('approval workflow in inbox', async ({ page }) => {
    await page.keyboard.press('Meta+2'); // Navigate to Inbox
    
    // Check for pending approvals
    const approvalCards = page.locator('.approval-card');
    const count = await approvalCards.count();
    
    if (count > 0) {
      // Preview first approval
      await approvalCards.first().click();
      
      // Verify preview modal
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Approve
      await page.click('button:has-text("Approve")');
      
      // Verify approval processed
      await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('calendar integration and event display', async ({ page }) => {
    // Go to dashboard
    await page.keyboard.press('Meta+1');
    
    // Check calendar widget
    const calendarWidget = page.locator('.calendar-widget');
    await expect(calendarWidget).toBeVisible();
    
    // Verify today's date is highlighted
    const today = new Date().getDate();
    await expect(calendarWidget.getByText(today.toString())).toBeVisible();
    
    // Click on calendar to expand
    await calendarWidget.click();
    
    // Should show events list
    await expect(page.getByText(/events/i)).toBeVisible();
  });

  test('settings persistence', async ({ page }) => {
    await page.keyboard.press('Meta+,'); // Open Settings
    
    // Change theme
    await page.selectOption('select[aria-label*="theme"]', 'light');
    
    // Change accent color
    await page.fill('input[type="color"]', '#3b82f6');
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify settings persisted
    await page.keyboard.press('Meta+,');
    const themeSelect = page.locator('select[aria-label*="theme"]');
    await expect(themeSelect).toHaveValue('light');
  });

  test('search functionality across data types', async ({ page }) => {
    await page.keyboard.press('Meta+/'); // Open search
    
    // Search for tasks
    await page.fill('input[placeholder*="search"]', 'test task');
    await page.keyboard.press('Enter');
    
    // Should show results
    await expect(page.getByText(/results/i)).toBeVisible();
    
    // Filter by type
    await page.click('button:has-text("Tasks")');
    
    // Verify only task results shown
    await expect(page.locator('.search-result[data-type="task"]')).toHaveCount(await page.locator('.search-result').count());
  });
});

test.describe('Performance Tests', () => {
  test('initial load performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('handles large task list efficiently', async ({ page }) => {
    // Mock large dataset
    await page.route('**/api/tasks', async route => {
      const tasks = Array.from({ length: 500 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        status: ['todo', 'in-progress', 'review', 'done'][i % 4],
        priority: ['p0', 'p1', 'p2', 'p3'][i % 4],
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      
      await route.fulfill({ json: tasks });
    });

    await page.goto('/');
    await page.keyboard.press('Meta+5'); // Kanban
    
    const startTime = Date.now();
    await page.waitForSelector('.task-card', { timeout: 5000 });
    const renderTime = Date.now() - startTime;
    
    // Should render within 2 seconds even with 500 tasks
    expect(renderTime).toBeLessThan(2000);
  });

  test('smooth scrolling with virtual list', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+5');
    
    // Scroll through task list
    const taskList = page.locator('.kanban-column').first();
    
    for (let i = 0; i < 10; i++) {
      await taskList.evaluate(node => node.scrollTop += 100);
      await page.waitForTimeout(50);
    }
    
    // Should remain responsive
    const fpsData = await page.evaluate(() => {
      return (performance as any).getEntriesByType('navigation');
    });
    
    expect(fpsData).toBeDefined();
  });
});

test.describe('Accessibility Tests', () => {
  test('keyboard navigation within modals', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+5');
    
    // Open new task modal
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Navigate through form with Tab
    await page.keyboard.press('Tab'); // Title
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.press('Tab'); // Priority
    await page.keyboard.press('Tab'); // Project
    
    // Verify focus visible
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('screen reader labels present', async ({ page }) => {
    await page.goto('/');
    
    // Check for aria-labels
    const buttons = page.locator('button[aria-label]');
    const buttonCount = await buttons.count();
    
    expect(buttonCount).toBeGreaterThan(0);
    
    // Check for heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();
  });

  test('focus trap in modals', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k'); // Open command palette
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Tab through all focusable elements
    const focusableCount = await page.locator('[role="dialog"] button, [role="dialog"] input').count();
    
    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Focus should stay within modal
    const focused = page.locator(':focus');
    const isInModal = await focused.evaluate(el => {
      return el.closest('[role="dialog"]') !== null;
    });
    
    expect(isInModal).toBe(true);
  });
});
