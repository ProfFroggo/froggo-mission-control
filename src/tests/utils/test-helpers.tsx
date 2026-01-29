import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Custom render function with providers if needed
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, options),
  };
}

// Mock data generators
export const mockTask = (overrides = {}) => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Task',
  status: 'todo' as const,
  project: 'Dev',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

export const mockAgent = (overrides = {}) => ({
  id: `agent-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Agent',
  status: 'idle' as const,
  ...overrides,
});

export const mockApproval = (overrides = {}) => ({
  id: `approval-${Math.random().toString(36).substr(2, 9)}`,
  type: 'tweet',
  content: 'Test content',
  status: 'pending',
  timestamp: Date.now(),
  ...overrides,
});

export const mockSession = (overrides = {}) => ({
  key: `session-${Math.random().toString(36).substr(2, 9)}`,
  kind: 'direct' as const,
  updatedAt: Date.now(),
  ageMs: 1000,
  sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
  type: 'main' as const,
  displayName: 'Test Session',
  isActive: true,
  ...overrides,
});

// Keyboard shortcut helpers
export const shortcuts = {
  commandPalette: '{Meta>}k{/Meta}',
  globalSearch: '{Meta>}/{/Meta}',
  help: '{Meta>}?{/Meta}',
  dashboard: '{Meta>}1{/Meta}',
  inbox: '{Meta>}2{/Meta}',
  kanban: '{Meta>}5{/Meta}',
  agents: '{Meta>}6{/Meta}',
  voice: '{Meta>}8{/Meta}',
  settings: '{Meta>},{/Meta}',
  escape: '{Escape}',
};

// Wait for condition helper
export const waitForCondition = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

// Mock gateway responses
export const mockGatewayResponse = (data: any) => {
  return Promise.resolve(data);
};

export const mockGatewayError = (error: string) => {
  return Promise.reject(new Error(error));
};

// Performance measurement helper
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Accessibility helpers
export const checkAccessibility = (container: HTMLElement) => {
  const checks = {
    hasHeadings: container.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
    hasAriaLabels: container.querySelectorAll('[aria-label]').length > 0,
    hasAltText: Array.from(container.querySelectorAll('img')).every(
      img => img.hasAttribute('alt')
    ),
    hasFocusableElements: container.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]'
    ).length > 0,
  };
  
  return checks;
};

// Create batch of mock tasks
export const createMockTasks = (count: number, baseOverrides = {}) => {
  return Array.from({ length: count }, (_, i) => mockTask({
    title: `Task ${i + 1}`,
    ...baseOverrides,
  }));
};

// Create batch of mock agents
export const createMockAgents = (count: number) => {
  const agentNames = ['Coder', 'Writer', 'Researcher', 'Chief'];
  return Array.from({ length: count }, (_, i) => mockAgent({
    name: agentNames[i % agentNames.length],
    id: agentNames[i % agentNames.length].toLowerCase(),
  }));
};

// Local storage helpers
export const clearLocalStorage = () => {
  localStorage.clear();
};

export const setLocalStorageItem = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getLocalStorageItem = (key: string) => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
};
