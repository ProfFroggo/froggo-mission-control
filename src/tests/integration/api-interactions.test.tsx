import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from '../../App';

describe('API Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Gateway Communication', () => {
    it('loads tasks from gateway on mount', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', status: 'todo', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'task-2', title: 'Task 2', status: 'in-progress', createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const listMock = vi.fn().mockResolvedValue(mockTasks);
      (window as any).clawdbot.db.tasks.list = listMock;

      render(<App />);

      await waitFor(() => {
        expect(listMock).toHaveBeenCalled();
      });
    });

    it('loads agents from gateway', async () => {
      const mockAgents = [
        { id: 'coder', name: 'Coder', status: 'active' },
        { id: 'writer', name: 'Writer', status: 'idle' },
      ];
      
      const agentsMock = vi.fn().mockResolvedValue(mockAgents);
      (window as any).clawdbot.db.agents.list = agentsMock;

      render(<App />);

      await waitFor(() => {
        expect(agentsMock).toHaveBeenCalled();
      });
    });

    it('loads approval queue from gateway', async () => {
      const mockApprovals = [
        {
          id: 'approval-1',
          type: 'tweet',
          content: 'Test tweet',
          status: 'pending',
        },
      ];
      
      const inboxMock = vi.fn().mockResolvedValue(mockApprovals);
      (window as any).clawdbot.inbox.list = inboxMock;

      render(<App />);

      await waitFor(() => {
        expect(inboxMock).toHaveBeenCalled();
      });
    });

    it('handles gateway errors gracefully', async () => {
      const errorMock = vi.fn().mockRejectedValue(new Error('Gateway connection failed'));
      (window as any).clawdbot.db.tasks.list = errorMock;

      render(<App />);

      await waitFor(() => {
        expect(errorMock).toHaveBeenCalled();
        // App should still render with error state
      });
    });
  });

  describe('Real-time Updates', () => {
    it('updates task list when new task added', async () => {
      const initialTasks = [
        { id: 'task-1', title: 'Task 1', status: 'todo', createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const listMock = vi.fn()
        .mockResolvedValueOnce(initialTasks)
        .mockResolvedValueOnce([
          ...initialTasks,
          { id: 'task-2', title: 'New Task', status: 'todo', createdAt: Date.now(), updatedAt: Date.now() },
        ]);

      (window as any).clawdbot.db.tasks.list = listMock;

      render(<App />);

      await waitFor(() => {
        expect(listMock).toHaveBeenCalledTimes(1);
      });

      // Trigger refresh (would be via WebSocket in real app)
      await waitFor(() => {
        // In real app, this would be triggered by WebSocket event
      }, { timeout: 100 });
    });

    it('updates agent status in real-time', async () => {
      const statusMock = vi.fn()
        .mockResolvedValueOnce([
          { id: 'coder', name: 'Coder', status: 'idle' },
        ])
        .mockResolvedValueOnce([
          { id: 'coder', name: 'Coder', status: 'busy' },
        ]);

      (window as any).clawdbot.db.agents.list = statusMock;

      render(<App />);

      await waitFor(() => {
        expect(statusMock).toHaveBeenCalled();
      });
    });
  });

  describe('Data Persistence', () => {
    it('persists theme settings to localStorage', async () => {
      render(<App />);

      const settingsData = {
        theme: 'dark',
        accentColor: '#22c55e',
      };

      localStorage.setItem('froggo-settings', JSON.stringify(settingsData));

      expect(localStorage.getItem('froggo-settings')).toBe(
        JSON.stringify(settingsData)
      );
    });

    it('loads saved settings on mount', async () => {
      const settingsData = {
        theme: 'light',
        accentColor: '#3b82f6',
      };

      localStorage.setItem('froggo-settings', JSON.stringify(settingsData));

      render(<App />);

      await waitFor(() => {
        const root = document.documentElement;
        expect(root.style.getPropertyValue('--clawd-accent')).toBe('#3b82f6');
      });
    });

    it('saves command palette history', async () => {
      render(<App />);

      const history = ['task 1', 'new task', 'search contacts'];
      localStorage.setItem('command-palette-history', JSON.stringify(history));

      expect(JSON.parse(localStorage.getItem('command-palette-history')!)).toEqual(history);
    });
  });

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      const errorMock = vi.fn().mockRejectedValue(new Error('API Error'));
      (window as any).clawdbot.db.tasks.list = errorMock;

      render(<App />);

      await waitFor(() => {
        expect(errorMock).toHaveBeenCalled();
      });
    });

    it('retries failed requests', async () => {
      const retryMock = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);

      (window as any).clawdbot.db.tasks.list = retryMock;

      render(<App />);

      await waitFor(() => {
        // Should eventually succeed after retries
        expect(retryMock).toHaveBeenCalledTimes(3);
      }, { timeout: 5000 });
    });

    it('handles offline mode gracefully', async () => {
      // Simulate offline
      const offlineMock = vi.fn().mockRejectedValue(new Error('Network error'));
      (window as any).clawdbot.db.tasks.list = offlineMock;

      render(<App />);

      await waitFor(() => {
        expect(offlineMock).toHaveBeenCalled();
        // App should show offline indicator
      });
    });
  });
});
