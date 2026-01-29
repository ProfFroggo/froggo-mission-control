# Froggo Dashboard Testing Quick Start

## Installation

```bash
cd ~/clawd/clawd-dashboard
npm install
```

## Quick Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Watch mode (auto-rerun on changes)
npm run test:watch

# Run specific test file
npm test -- Dashboard.test.tsx
```

## Using the Test Runner Script

```bash
# Run all tests
./scripts/run-tests.sh all

# Run with coverage
./scripts/run-tests.sh all coverage

# Run specific test suites
./scripts/run-tests.sh unit
./scripts/run-tests.sh e2e
./scripts/run-tests.sh performance

# Watch mode
./scripts/run-tests.sh watch

# CI mode (for automated testing)
./scripts/run-tests.sh ci
```

## Test Coverage Breakdown

### ✅ Components (14 test files)
- Dashboard.test.tsx
- Kanban.test.tsx
- TaskModal.test.tsx
- AgentPanel.test.tsx
- VoicePanel.test.tsx
- modals.test.tsx
- And more...

### ✅ Integration (3 test files)
- task-workflow.test.tsx - Full task lifecycle
- keyboard-shortcuts.test.tsx - All shortcuts
- api-interactions.test.tsx - Gateway API

### ✅ E2E (1 comprehensive suite)
- full-workflow.spec.ts - Complete user journeys
  - Task creation to completion
  - Agent spawning and interaction
  - Voice transcription
  - Approval workflow
  - Settings persistence
  - Performance benchmarks
  - Accessibility checks

### ✅ Performance (1 test file)
- performance.test.ts - Benchmarks for:
  - Large dataset handling (10,000+ items)
  - Filtering & searching
  - Rendering performance
  - Memory management

### ✅ Store (1 test file)
- store.test.ts - Zustand store tests
  - Task management
  - Agent management
  - Session tracking
  - UI state

### ✅ API (1 test file)
- gateway.test.ts - Gateway API client
  - Connection handling
  - Message sending
  - Session management
  - Error handling
  - Caching

## What's Tested

### Panels & Views
- ✅ Dashboard with widgets
- ✅ Kanban board with drag & drop
- ✅ Agent panel with metrics
- ✅ Voice panel with Vosk transcription
- ✅ Inbox with approval queue
- ✅ Settings panel

### Modals
- ✅ Command Palette
- ✅ Task Modal with conversational mode
- ✅ Contact Modal
- ✅ Skill Modal
- ✅ Agent Detail Modal

### Workflows
- ✅ Complete task lifecycle
- ✅ Agent spawning and assignment
- ✅ Subtask completion tracking
- ✅ Task blocking dependencies
- ✅ Approval workflows

### Keyboard Shortcuts
- ✅ All navigation shortcuts (⌘1-9)
- ✅ Command palette (⌘K)
- ✅ Global search (⌘/)
- ✅ Quick actions (⌘⇧M, ⌘⇧N)
- ✅ Escape to close modals

### API Interactions
- ✅ Gateway communication
- ✅ Task CRUD operations
- ✅ Agent session management
- ✅ Real-time updates
- ✅ Error handling & retries
- ✅ Offline mode

### Data Persistence
- ✅ LocalStorage for settings
- ✅ Theme persistence
- ✅ Command history
- ✅ Task state

### Performance
- ✅ Large datasets (10,000+ items)
- ✅ Efficient filtering & search
- ✅ Virtual scrolling
- ✅ Memory leak prevention
- ✅ 60fps scrolling

### Accessibility
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ ARIA attributes
- ✅ Screen reader support

## Viewing Test Results

### Unit Test Coverage
```bash
npm run test:coverage
open coverage/index.html
```

### E2E Test Report
```bash
npm run test:e2e
npx playwright show-report
```

### Test UI (Interactive)
```bash
npm run test:ui
```

## Writing New Tests

### Component Test Template
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../../components/MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText(/my component/i)).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/clicked/i)).toBeInTheDocument();
    });
  });
});
```

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test';

test('user can complete workflow', async ({ page }) => {
  await page.goto('/');
  
  // Navigate
  await page.keyboard.press('Meta+5');
  
  // Interact
  await page.click('button:has-text("New Task")');
  await page.fill('input[placeholder*="task"]', 'Test Task');
  await page.click('button:has-text("Save")');
  
  // Assert
  await expect(page.getByText('Test Task')).toBeVisible();
});
```

## Debugging Tests

### Vitest
```bash
# Run single test file
npm test -- MyComponent.test.tsx

# Run with specific pattern
npm test -- --grep "keyboard shortcuts"

# Use test UI for debugging
npm run test:ui
```

### Playwright
```bash
# Debug mode (opens browser)
npm run test:e2e:debug

# UI mode (interactive)
npm run test:e2e:ui

# With trace
npm run test:e2e -- --trace on
```

## CI/CD

Tests run automatically on:
- Every commit (unit + integration)
- Pull requests (full suite + coverage)
- Pre-deployment (E2E)

See `.github/workflows/tests.yml` for CI configuration.

## Test Utilities

Common test helpers available in `src/tests/utils/test-helpers.tsx`:

```typescript
import { 
  mockTask, 
  mockAgent, 
  shortcuts,
  measurePerformance 
} from '../utils/test-helpers';

// Generate mock data
const task = mockTask({ title: 'My Task' });

// Use keyboard shortcuts
await user.keyboard(shortcuts.commandPalette);

// Measure performance
const duration = await measurePerformance(async () => {
  // Code to measure
});
```

## Troubleshooting

### Tests fail with "Cannot find module"
```bash
npm install
```

### Playwright browsers not installed
```bash
npx playwright install --with-deps
```

### Tests timeout
Increase timeout in test file:
```typescript
await waitFor(() => {
  // assertion
}, { timeout: 5000 });
```

### Mock not working
Clear mocks in beforeEach:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Resources

- Full documentation: `TEST_DOCUMENTATION.md`
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- Testing Library: https://testing-library.com/

---

**Total Test Files:** 22
**Total Test Cases:** 200+
**Coverage Target:** 85%
**Test Execution Time:** ~2 minutes (all tests)
