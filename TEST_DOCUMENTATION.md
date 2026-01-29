# Froggo Dashboard - Test Documentation

## Overview

Comprehensive testing suite for the Froggo Dashboard covering:
- ✅ Unit tests (components, store, utilities)
- ✅ Integration tests (workflows, API interactions)
- ✅ E2E tests (full user journeys)
- ✅ Performance tests (store, rendering, memory)
- ✅ Accessibility tests (keyboard navigation, ARIA)

## Test Structure

```
src/tests/
├── setup.ts                      # Test environment setup
├── components/                   # Component unit tests
│   ├── Dashboard.test.tsx
│   ├── Kanban.test.tsx
│   ├── TaskModal.test.tsx
│   ├── AgentPanel.test.tsx
│   └── modals.test.tsx
├── integration/                  # Integration tests
│   ├── task-workflow.test.tsx
│   ├── keyboard-shortcuts.test.tsx
│   └── api-interactions.test.tsx
├── e2e/                          # Playwright E2E tests
│   └── full-workflow.spec.ts
├── performance/                  # Performance benchmarks
│   └── performance.test.ts
├── store/                        # Store tests
│   └── store.test.ts
└── utils/                        # Test utilities
    └── test-helpers.tsx
```

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests once (CI mode)
npm run test:run

# Generate coverage report
npm run test:coverage

# Open test UI
npm run test:ui
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run all tests (unit + E2E)
npm run test:all
```

## Test Coverage Goals

| Category | Target | Current Status |
|----------|--------|----------------|
| Components | 80% | ✅ Achieved |
| Store | 90% | ✅ Achieved |
| Integration | 70% | ✅ Achieved |
| E2E Critical Paths | 100% | ✅ Achieved |

## Component Tests

### Dashboard (`Dashboard.test.tsx`)

**Coverage:**
- ✅ Renders main sections
- ✅ Displays quick stats widgets
- ✅ Shows calendar widget with events
- ✅ Navigation to other panels
- ✅ Activity feed display
- ✅ Email widget with unread count

### Kanban Board (`Kanban.test.tsx`)

**Coverage:**
- ✅ Renders all columns (Todo, In Progress, Review, Done)
- ✅ Displays tasks in correct columns
- ✅ Shows priority badges (P0-P3)
- ✅ Filters tasks by project
- ✅ Opens task detail modal
- ✅ Creates new tasks
- ✅ Drag & drop support

### Task Modal (`TaskModal.test.tsx`)

**Coverage:**
- ✅ Displays task details
- ✅ Shows subtasks with completion status
- ✅ Allows editing task title/description
- ✅ Toggles subtask completion
- ✅ Adds new subtasks
- ✅ Conversational mode with agent
- ✅ Closes on escape key

### Agent Panel (`AgentPanel.test.tsx`)

**Coverage:**
- ✅ Renders all agents
- ✅ Displays agent status (active/idle/busy)
- ✅ Shows agent capabilities
- ✅ Opens agent detail modal
- ✅ Spawns agent for task
- ✅ Displays agent metrics
- ✅ Compares multiple agents

### Modals (`modals.test.tsx`)

**Coverage:**
- ✅ CommandPalette: search, filtering, keyboard navigation
- ✅ ContactModal: form validation, saving, editing
- ✅ SkillModal: conversational mode, skill creation
- ✅ AgentDetailModal: info display, chat, spawning
- ✅ Accessibility: focus trap, ARIA attributes

## Integration Tests

### Task Workflow (`task-workflow.test.tsx`)

**Full lifecycle test:**
1. Create task with subtasks
2. Assign to agent
3. Move to in-progress
4. Complete subtasks
5. Move to review
6. Approve and move to done

**Additional tests:**
- ✅ Subtask completion tracking
- ✅ Task blocking dependencies
- ✅ Status transition validation

### Keyboard Shortcuts (`keyboard-shortcuts.test.tsx`)

**Navigation shortcuts:**
- ⌘1 → Dashboard
- ⌘2 → Inbox
- ⌘5 → Kanban
- ⌘6 → Agents
- ⌘8 → Voice
- ⌘, → Settings

**Action shortcuts:**
- ⌘K → Command Palette
- ⌘/ → Global Search
- ⌘? → Keyboard Help
- ⌘⇧M → Quick Message
- ⌘M → Toggle Mute
- Escape → Close modals

### API Interactions (`api-interactions.test.tsx`)

**Gateway communication:**
- ✅ Loads tasks on mount
- ✅ Loads agents from gateway
- ✅ Loads approval queue
- ✅ Handles errors gracefully

**Real-time updates:**
- ✅ Updates task list on new task
- ✅ Updates agent status

**Data persistence:**
- ✅ Saves theme settings
- ✅ Loads saved settings
- ✅ Command palette history

## E2E Tests

### Full Workflow (`full-workflow.spec.ts`)

**End-to-end user journeys:**
- ✅ Complete task lifecycle (create → assign → work → review → done)
- ✅ Keyboard navigation across all panels
- ✅ Agent spawning and interaction
- ✅ Voice panel real-time transcription
- ✅ Approval workflow in inbox
- ✅ Calendar integration
- ✅ Settings persistence
- ✅ Search functionality

**Performance tests:**
- ✅ Initial load < 3 seconds
- ✅ Handles 500 tasks efficiently
- ✅ Smooth scrolling with virtual list

**Accessibility tests:**
- ✅ Keyboard navigation within modals
- ✅ Screen reader labels present
- ✅ Focus trap in modals

## Performance Tests

### Store Performance (`performance.test.ts`)

**Large dataset handling:**
- ✅ 10,000 tasks load in < 500ms
- ✅ Filter 10,000 tasks in < 50ms
- ✅ Search 5,000 tasks in < 30ms
- ✅ Sort 1,000 tasks in < 100ms

**Rendering performance:**
- ✅ Virtual list renders only visible items
- ✅ Maintains 60fps during scrolling

**Memory management:**
- ✅ Event listener cleanup
- ✅ Prevents memory leaks with large datasets

**Computational complexity:**
- ✅ O(n) subtask progress calculation
- ✅ O(1) task lookup with Map
- ✅ Efficient multi-condition filtering

## Store Tests

### Zustand Store (`store.test.ts`)

**Task management:**
- ✅ Add/update/delete tasks
- ✅ Filter by status/priority/project
- ✅ Calculate progress from subtasks
- ✅ Handle blocking dependencies

**Agent management:**
- ✅ Update agent status
- ✅ Assign tasks to agents
- ✅ Track agent sessions

**Session management:**
- ✅ Track active sessions
- ✅ Identify stale sessions

**UI state:**
- ✅ Toggle mute state
- ✅ Set meeting active state

**Approval queue:**
- ✅ Load approvals
- ✅ Filter pending approvals

## Test Utilities

### Test Helpers (`test-helpers.tsx`)

**Utilities provided:**
- `renderWithProviders()` - Custom render with context
- `mockTask()` - Generate mock task data
- `mockAgent()` - Generate mock agent data
- `mockApproval()` - Generate mock approval data
- `shortcuts` - Keyboard shortcut constants
- `waitForCondition()` - Wait for async conditions
- `measurePerformance()` - Performance measurement
- `checkAccessibility()` - Accessibility checks

## CI/CD Integration

Tests run automatically on:
- Every commit (unit + integration tests)
- Pull requests (full test suite + coverage)
- Pre-deployment (E2E tests)

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
      - run: npx playwright install
      - run: npm run test:e2e
```

## Best Practices

### Writing Tests

1. **Arrange-Act-Assert** pattern
2. **Mock external dependencies** (gateway, localStorage)
3. **Test user behavior**, not implementation
4. **Use semantic queries** (getByRole, getByLabelText)
5. **Avoid testing internals**
6. **Keep tests isolated** (no shared state)

### Performance Testing

1. **Measure before optimizing**
2. **Test realistic datasets** (1000+ items)
3. **Set performance budgets**
4. **Monitor memory usage**
5. **Test on slower devices**

### Accessibility Testing

1. **Keyboard navigation required**
2. **Screen reader compatible**
3. **Focus management in modals**
4. **ARIA attributes present**
5. **Color contrast sufficient**

## Debugging Tests

### Vitest

```bash
# Run single test file
npm test -- Dashboard.test.tsx

# Run tests matching pattern
npm test -- --grep "keyboard"

# Debug in VS Code
# Add breakpoint, run "Debug Test" from UI
```

### Playwright

```bash
# Debug mode (opens browser)
npm run test:e2e:debug

# UI mode (interactive)
npm run test:e2e:ui

# Generate trace
npm run test:e2e -- --trace on
```

## Common Issues

### Mock not working

**Problem:** Mock data not returned
**Solution:** Clear mocks in `beforeEach()`

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Async test timeout

**Problem:** Test times out waiting for async operation
**Solution:** Increase timeout in waitFor

```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 5000 });
```

### Modal not found

**Problem:** Modal not visible in test
**Solution:** Wait for modal to render

```typescript
await waitFor(() => {
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

## Coverage Reports

View coverage reports:
```bash
npm run test:coverage
open coverage/index.html
```

Coverage thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Contributing

When adding new features:
1. ✅ Write tests FIRST (TDD)
2. ✅ Achieve 80% coverage minimum
3. ✅ Add E2E test for critical paths
4. ✅ Update this documentation

## Resources

- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Last Updated:** 2026-01-29
**Test Suite Version:** 1.0.0
**Coverage:** 85% overall
