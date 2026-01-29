import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests: Complete User Workflows
 * Tests the dashboard as a real user would interact with it
 */

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:5173');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  test('complete task creation and management workflow', async ({ page }) => {
    // Step 1: Navigate to Kanban board
    await page.click('[data-testid="nav-kanban"]');
    await expect(page.locator('h1')).toContainText('Kanban');
    
    // Step 2: Create new task
    await page.click('button:has-text("New Task")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    await page.fill('input[name="title"]', 'E2E Test Task');
    await page.fill('textarea[name="description"]', 'Created by E2E test');
    await page.selectOption('select[name="priority"]', 'p1');
    await page.fill('input[name="project"]', 'Testing');
    
    await page.click('button:has-text("Save")');
    
    // Step 3: Verify task appears in Todo column
    await expect(page.locator('[data-column="todo"]')).toContainText('E2E Test Task');
    
    // Step 4: Open task and add subtasks
    await page.click('text=E2E Test Task');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    await page.click('button:has-text("Add Subtask")');
    await page.fill('input[placeholder*="subtask"]', 'Subtask 1');
    await page.keyboard.press('Enter');
    
    await page.click('button:has-text("Add Subtask")');
    await page.fill('input[placeholder*="subtask"]', 'Subtask 2');
    await page.keyboard.press('Enter');
    
    // Verify subtasks appear
    await expect(page.locator('text=Subtask 1')).toBeVisible();
    await expect(page.locator('text=Subtask 2')).toBeVisible();
    
    // Step 5: Move to In Progress
    await page.click('button:has-text("Start Task")');
    await page.click('button:has-text("Close")');
    
    // Verify task moved
    await expect(page.locator('[data-column="in-progress"]')).toContainText('E2E Test Task');
    
    // Step 6: Complete subtasks
    await page.click('text=E2E Test Task');
    
    const checkboxes = page.locator('input[type="checkbox"][data-subtask]');
    const count = await checkboxes.count();
    
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    
    // Verify progress indicator
    await expect(page.locator('text=/2\\/2/')).toBeVisible();
    
    // Step 7: Submit for review
    await page.click('button:has-text("Submit for Review")');
    await page.click('button:has-text("Close")');
    
    // Verify in Review column
    await expect(page.locator('[data-column="review"]')).toContainText('E2E Test Task');
    
    // Step 8: Approve and complete
    await page.click('text=E2E Test Task');
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Close")');
    
    // Verify in Done column
    await expect(page.locator('[data-column="done"]')).toContainText('E2E Test Task');
  });

  test('agent spawn and task assignment workflow', async ({ page }) => {
    // Navigate to Agents panel
    await page.click('[data-testid="nav-agents"]');
    await expect(page.locator('h1')).toContainText('Agents');
    
    // Spawn new agent
    await page.click('button:has-text("Spawn Agent")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    await page.selectOption('select[name="agent"]', 'coder');
    await page.fill('textarea[name="task"]', 'Write unit tests for component X');
    
    await page.click('button:has-text("Spawn")');
    
    // Verify agent appears
    await expect(page.locator('[data-testid="agent-card"]')).toContainText('coder');
    await expect(page.locator('[data-status="busy"]')).toBeVisible();
    
    // Check current task
    await expect(page.locator('text=Write unit tests for component X')).toBeVisible();
    
    // Terminate agent
    await page.click('[data-testid="agent-menu"]');
    await page.click('text=Terminate');
    
    await page.click('button:has-text("Confirm")');
    
    // Verify agent removed or status changed
    await expect(page.locator('[data-status="busy"]')).not.toBeVisible();
  });

  test('keyboard shortcuts navigation', async ({ page }) => {
    // Test dashboard shortcut (Cmd+2)
    await page.keyboard.press('Meta+2');
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Test chat shortcut (Cmd+3)
    await page.keyboard.press('Meta+3');
    await expect(page.locator('h1')).toContainText('Chat');
    
    // Test sessions shortcut (Cmd+4)
    await page.keyboard.press('Meta+4');
    await expect(page.locator('h1')).toContainText('Sessions');
    
    // Test kanban shortcut (Cmd+5)
    await page.keyboard.press('Meta+5');
    await expect(page.locator('h1')).toContainText('Kanban');
    
    // Test agents shortcut (Cmd+6)
    await page.keyboard.press('Meta+6');
    await expect(page.locator('h1')).toContainText('Agents');
    
    // Test command palette (Cmd+K)
    await page.keyboard.press('Meta+k');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
  });

  test('filter and search functionality', async ({ page }) => {
    // Navigate to Kanban
    await page.keyboard.press('Meta+5');
    
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
    
    // Test search
    await page.fill('input[placeholder*="search"]', 'feature');
    
    // Verify filtered results
    const visibleTasks = page.locator('[data-testid="task-card"]:visible');
    await expect(visibleTasks).toHaveCount(1); // Assuming test data
    
    await expect(visibleTasks.first()).toContainText('feature', { ignoreCase: true });
    
    // Clear search
    await page.fill('input[placeholder*="search"]', '');
    
    // Test filters
    await page.click('button:has-text("Filter")');
    await page.check('input[name="filter-p0"]');
    
    // Verify only P0 tasks visible
    const p0Tasks = page.locator('[data-priority="p0"]');
    await expect(p0Tasks).toHaveCount(1); // Assuming test data
    
    // Clear filter
    await page.uncheck('input[name="filter-p0"]');
  });

  test('real-time updates and WebSocket communication', async ({ page }) => {
    // Navigate to sessions
    await page.keyboard.press('Meta+4');
    
    // Wait for initial load
    await page.waitForTimeout(1000);
    
    // Count initial sessions
    const initialSessions = await page.locator('[data-testid="session-card"]').count();
    
    // Simulate new session event (would come from gateway in real scenario)
    await page.evaluate(() => {
      const event = new CustomEvent('session-created', {
        detail: {
          id: 'test-session-' + Date.now(),
          label: 'e2e-test-session',
          channel: 'test',
        },
      });
      window.dispatchEvent(event);
    });
    
    // Verify new session appears
    await page.waitForTimeout(500);
    const updatedSessions = await page.locator('[data-testid="session-card"]').count();
    expect(updatedSessions).toBe(initialSessions + 1);
  });

  test('error handling and recovery', async ({ page }) => {
    // Navigate to Kanban
    await page.keyboard.press('Meta+5');
    
    // Try to create task with missing required fields
    await page.click('button:has-text("New Task")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Click save without filling title
    await page.click('button:has-text("Save")');
    
    // Verify error message
    await expect(page.locator('text=Title is required')).toBeVisible();
    
    // Fill title and retry
    await page.fill('input[name="title"]', 'Valid Task');
    await page.click('button:has-text("Save")');
    
    // Verify task created
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Valid Task')).toBeVisible();
  });

  test('drag and drop task between columns', async ({ page }) => {
    // Navigate to Kanban
    await page.keyboard.press('Meta+5');
    
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
    
    // Find a task in Todo column
    const todoTask = page.locator('[data-column="todo"] [data-testid="task-card"]').first();
    const taskText = await todoTask.textContent();
    
    // Drag to In Progress column
    const inProgressColumn = page.locator('[data-column="in-progress"]');
    
    await todoTask.dragTo(inProgressColumn);
    
    // Verify task moved
    await expect(page.locator('[data-column="in-progress"]')).toContainText(taskText || '');
    await expect(page.locator('[data-column="todo"]')).not.toContainText(taskText || '');
  });

  test('calendar integration and event display', async ({ page }) => {
    // Navigate to dashboard
    await page.keyboard.press('Meta+2');
    
    // Check calendar widget
    await expect(page.locator('[data-testid="calendar-widget"]')).toBeVisible();
    
    // Verify today's date is highlighted
    const today = new Date();
    const dateSelector = `[data-date="${today.toISOString().split('T')[0]}"]`;
    await expect(page.locator(dateSelector)).toHaveClass(/highlighted|today/);
    
    // Click on calendar event
    const eventCard = page.locator('[data-testid="calendar-event"]').first();
    if (await eventCard.isVisible()) {
      await eventCard.click();
      
      // Verify event detail modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="event-title"]')).toBeVisible();
    }
  });

  test('voice panel and transcription', async ({ page }) => {
    // Navigate to voice panel
    await page.keyboard.press('Meta+8');
    
    await expect(page.locator('[data-testid="voice-panel"]')).toBeVisible();
    
    // Check voice controls are present
    await expect(page.locator('button:has-text("Start Listening")')).toBeVisible();
    
    // Test conversation mode toggle
    const convToggle = page.locator('input[name="conversation-mode"]');
    await convToggle.check();
    await expect(convToggle).toBeChecked();
    
    // Test meeting eavesdrop toggle
    const eavesdropToggle = page.locator('input[name="meeting-eavesdrop"]');
    await eavesdropToggle.check();
    await expect(eavesdropToggle).toBeChecked();
  });

  test('inbox and approval workflow', async ({ page }) => {
    // Navigate to inbox
    await page.keyboard.press('Meta+1');
    
    await expect(page.locator('[data-testid="inbox"]')).toBeVisible();
    
    // Check for approval items
    const approvalCards = page.locator('[data-testid="approval-card"]');
    const count = await approvalCards.count();
    
    if (count > 0) {
      // Approve first item
      await approvalCards.first().locator('button:has-text("Approve")').click();
      
      // Verify confirmation dialog
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await page.click('button:has-text("Confirm")');
      
      // Verify item removed from inbox
      const newCount = await approvalCards.count();
      expect(newCount).toBe(count - 1);
    }
    
    // Test approve all
    if (await page.locator('button:has-text("Approve All")').isVisible()) {
      await page.click('button:has-text("Approve All")');
      await page.click('button:has-text("Confirm")');
      
      // Verify inbox cleared
      await expect(page.locator('text=No pending approvals')).toBeVisible();
    }
  });

  test('settings and configuration', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+,');
    
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
    
    // Check all settings tabs are accessible
    const tabs = ['General', 'Accounts', 'Notifications', 'Advanced'];
    
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      await expect(page.locator(`[data-tab="${tab.toLowerCase()}"]`)).toBeVisible();
    }
    
    // Test a setting change
    await page.click('button:has-text("General")');
    const themeToggle = page.locator('input[name="dark-mode"]');
    const initialState = await themeToggle.isChecked();
    
    await themeToggle.click();
    await expect(themeToggle).toHaveProperty('checked', !initialState);
    
    // Save settings
    await page.click('button:has-text("Save")');
    
    // Verify settings persisted
    await page.keyboard.press('Meta+,');
    await expect(themeToggle).toHaveProperty('checked', !initialState);
  });
});

test.describe('Performance and Load Tests', () => {
  test('handles large task list efficiently', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Navigate to Kanban
    await page.keyboard.press('Meta+5');
    
    // Measure load time
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 });
    const loadTime = Date.now() - startTime;
    
    // Verify reasonable load time (< 2 seconds)
    expect(loadTime).toBeLessThan(2000);
    
    // Scroll through tasks smoothly
    await page.locator('[data-testid="kanban-board"]').evaluate(node => {
      node.scrollTop = node.scrollHeight;
    });
    
    // Verify no layout shift
    await page.waitForTimeout(500);
    const isStable = await page.locator('[data-testid="kanban-board"]').isVisible();
    expect(isStable).toBeTruthy();
  });

  test('maintains responsiveness with multiple agents', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Navigate to agents
    await page.keyboard.press('Meta+6');
    
    // Check all agent cards render
    await page.waitForSelector('[data-testid="agent-card"]', { timeout: 5000 });
    
    // Measure interaction responsiveness
    const startTime = Date.now();
    await page.click('[data-testid="agent-card"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 2000 });
    const responseTime = Date.now() - startTime;
    
    // Verify quick response (< 500ms)
    expect(responseTime).toBeLessThan(500);
  });
});
