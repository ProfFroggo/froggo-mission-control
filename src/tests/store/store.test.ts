import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../../store/store';
import type { Task } from '../../store/store';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.tasks = [];
      result.current.agents = [];
      result.current.sessions = [];
      result.current.activities = [];
    });
  });

  describe('Task Management', () => {
    it('adds task to store', () => {
      const { result } = renderHook(() => useStore());
      
      const newTask: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test description',
        status: 'todo',
        priority: 'p1',
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.setTasks([newTask]);
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('Test Task');
    });

    it('updates task status', () => {
      const { result } = renderHook(() => useStore());
      
      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        status: 'todo',
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.setTasks([task]);
      });

      act(() => {
        const updated = { ...task, status: 'in-progress' as const };
        result.current.setTasks([updated]);
      });

      expect(result.current.tasks[0].status).toBe('in-progress');
    });

    it('filters tasks by status', () => {
      const { result } = renderHook(() => useStore());
      
      const tasks: Task[] = [
        { id: 'task-1', title: 'Task 1', status: 'todo', project: 'Dev', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'task-2', title: 'Task 2', status: 'in-progress', project: 'Dev', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'task-3', title: 'Task 3', status: 'done', project: 'Dev', createdAt: Date.now(), updatedAt: Date.now() },
      ];

      act(() => {
        result.current.setTasks(tasks);
      });

      const todoTasks = result.current.tasks.filter(t => t.status === 'todo');
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].title).toBe('Task 1');
    });

    it('filters tasks by priority', () => {
      const { result } = renderHook(() => useStore());
      
      const tasks: Task[] = [
        { id: 'task-1', title: 'Task 1', status: 'todo', priority: 'p0', project: 'Dev', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'task-2', title: 'Task 2', status: 'todo', priority: 'p1', project: 'Dev', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'task-3', title: 'Task 3', status: 'todo', priority: 'p3', project: 'Dev', createdAt: Date.now(), updatedAt: Date.now() },
      ];

      act(() => {
        result.current.setTasks(tasks);
      });

      const urgentTasks = result.current.tasks.filter(t => t.priority === 'p0');
      expect(urgentTasks).toHaveLength(1);
      expect(urgentTasks[0].title).toBe('Task 1');
    });

    it('calculates task progress from subtasks', () => {
      const { result } = renderHook(() => useStore());
      
      const task: Task = {
        id: 'task-1',
        title: 'Task with subtasks',
        status: 'in-progress',
        project: 'Dev',
        subtasks: [
          { id: 'sub-1', title: 'Subtask 1', completed: true },
          { id: 'sub-2', title: 'Subtask 2', completed: true },
          { id: 'sub-3', title: 'Subtask 3', completed: false },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.setTasks([task]);
      });

      const completedCount = task.subtasks!.filter(s => s.completed).length;
      const progress = (completedCount / task.subtasks!.length) * 100;
      
      expect(progress).toBe(66.66666666666666);
    });
  });

  describe('Agent Management', () => {
    it('updates agent status', () => {
      const { result } = renderHook(() => useStore());
      
      const agent = {
        id: 'coder',
        name: 'Coder',
        status: 'idle' as const,
      };

      act(() => {
        result.current.setAgents([agent]);
      });

      expect(result.current.agents[0].status).toBe('idle');

      act(() => {
        result.current.setAgents([{ ...agent, status: 'busy' as const }]);
      });

      expect(result.current.agents[0].status).toBe('busy');
    });

    it('assigns task to agent', () => {
      const { result } = renderHook(() => useStore());
      
      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        status: 'todo',
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const agent = {
        id: 'coder',
        name: 'Coder',
        status: 'idle' as const,
      };

      act(() => {
        result.current.setTasks([task]);
        result.current.setAgents([agent]);
      });

      act(() => {
        const updated = { ...task, assignedTo: 'coder' };
        result.current.setTasks([updated]);
      });

      expect(result.current.tasks[0].assignedTo).toBe('coder');
    });
  });

  describe('Session Management', () => {
    it('tracks active sessions', () => {
      const { result } = renderHook(() => useStore());
      
      const session = {
        key: 'session-1',
        kind: 'direct' as const,
        updatedAt: Date.now(),
        ageMs: 1000,
        sessionId: 'session-1',
        type: 'main' as const,
        displayName: 'Main Session',
        isActive: true,
      };

      act(() => {
        result.current.setSessions([session]);
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0].isActive).toBe(true);
    });

    it('identifies stale sessions', () => {
      const { result } = renderHook(() => useStore());
      
      const staleSession = {
        key: 'session-old',
        kind: 'direct' as const,
        updatedAt: Date.now() - 600000, // 10 minutes ago
        ageMs: 600000,
        sessionId: 'session-old',
        type: 'main' as const,
        displayName: 'Old Session',
        isActive: false,
      };

      act(() => {
        result.current.setSessions([staleSession]);
      });

      const stale = result.current.sessions.filter(s => !s.isActive);
      expect(stale).toHaveLength(1);
    });
  });

  describe('UI State', () => {
    it('toggles mute state', () => {
      const { result } = renderHook(() => useStore());
      
      const initialMute = result.current.isMuted;

      act(() => {
        result.current.toggleMuted();
      });

      expect(result.current.isMuted).toBe(!initialMute);
    });

    it('sets meeting active state', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.setMeetingActive(true);
      });

      expect(result.current.isMeetingActive).toBe(true);

      act(() => {
        result.current.setMeetingActive(false);
      });

      expect(result.current.isMeetingActive).toBe(false);
    });
  });

  describe('Approval Queue', () => {
    it('loads approvals', () => {
      const { result } = renderHook(() => useStore());
      
      const approvals = [
        {
          id: 'approval-1',
          type: 'tweet',
          content: 'Test tweet',
          status: 'pending',
          timestamp: Date.now(),
        },
      ];

      act(() => {
        result.current.setApprovals(approvals as any);
      });

      expect(result.current.approvals).toHaveLength(1);
    });

    it('filters pending approvals', () => {
      const { result } = renderHook(() => useStore());
      
      const approvals = [
        { id: '1', type: 'tweet', content: 'Tweet 1', status: 'pending', timestamp: Date.now() },
        { id: '2', type: 'email', content: 'Email 1', status: 'approved', timestamp: Date.now() },
        { id: '3', type: 'tweet', content: 'Tweet 2', status: 'pending', timestamp: Date.now() },
      ];

      act(() => {
        result.current.setApprovals(approvals as any);
      });

      const pending = result.current.approvals.filter(a => a.status === 'pending');
      expect(pending).toHaveLength(2);
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const { result } = renderHook(() => useStore());
      
      const tasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        status: 'todo' as const,
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const start = performance.now();
      
      act(() => {
        result.current.setTasks(tasks);
      });

      const end = performance.now();
      const duration = end - start;

      // Should set 1000 tasks in less than 100ms
      expect(duration).toBeLessThan(100);
      expect(result.current.tasks).toHaveLength(1000);
    });

    it('filters large datasets quickly', () => {
      const { result } = renderHook(() => useStore());
      
      const tasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        status: i % 2 === 0 ? 'todo' as const : 'done' as const,
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      act(() => {
        result.current.setTasks(tasks);
      });

      const start = performance.now();
      const todoTasks = result.current.tasks.filter(t => t.status === 'todo');
      const end = performance.now();
      const duration = end - start;

      // Should filter in less than 10ms
      expect(duration).toBeLessThan(10);
      expect(todoTasks).toHaveLength(500);
    });
  });
});
