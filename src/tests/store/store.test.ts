import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../../store/store';
import type { Task, Session } from '../../store/store';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store before each test using Zustand's setState
    useStore.setState({
      tasks: [],
      agents: [],
      sessions: [],
      activities: [],
      approvals: [],
    });
  });

  describe('Task Management', () => {
    it('adds task to store', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addTask({
          title: 'Test Task',
          description: 'Test description',
          status: 'todo',
          priority: 'p1',
          project: 'Dev',
        });
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('Test Task');
    });

    it('updates task status', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addTask({
          title: 'Test Task',
          status: 'todo',
          project: 'Dev',
        });
      });

      const taskId = result.current.tasks[0].id;

      act(() => {
        result.current.moveTask(taskId, 'in-progress');
      });

      expect(result.current.tasks[0].status).toBe('in-progress');
    });

    it('filters tasks by status', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addTask({ title: 'Task 1', status: 'todo', project: 'Dev' });
        result.current.addTask({ title: 'Task 2', status: 'in-progress', project: 'Dev' });
        result.current.addTask({ title: 'Task 3', status: 'done', project: 'Dev' });
      });

      const todoTasks = result.current.tasks.filter(t => t.status === 'todo');
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].title).toBe('Task 1');
    });

    it('filters tasks by priority', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addTask({ title: 'Task 1', status: 'todo', priority: 'p0', project: 'Dev' });
        result.current.addTask({ title: 'Task 2', status: 'todo', priority: 'p1', project: 'Dev' });
        result.current.addTask({ title: 'Task 3', status: 'todo', priority: 'p3', project: 'Dev' });
      });

      const urgentTasks = result.current.tasks.filter(t => t.priority === 'p0');
      expect(urgentTasks).toHaveLength(1);
      expect(urgentTasks[0].title).toBe('Task 1');
    });

    it('calculates task progress from subtasks', () => {
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

      useStore.setState({ tasks: [task] });

      const completedCount = task.subtasks!.filter(s => s.completed).length;
      const progress = (completedCount / task.subtasks!.length) * 100;

      expect(progress).toBeCloseTo(66.67, 1);
    });

    it('filters tasks by project', () => {
      useStore.setState({
        tasks: [
          { id: 't1', title: 'Task 1', status: 'todo', project: 'Frontend', createdAt: Date.now(), updatedAt: Date.now() },
          { id: 't2', title: 'Task 2', status: 'todo', project: 'Backend', createdAt: Date.now(), updatedAt: Date.now() },
          { id: 't3', title: 'Task 3', status: 'todo', project: 'Frontend', createdAt: Date.now(), updatedAt: Date.now() },
        ] as Task[],
      });

      const store = useStore.getState();
      const frontendTasks = store.tasks.filter(t => t.project === 'Frontend');
      expect(frontendTasks).toHaveLength(2);
    });

    it('updates task details', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addTask({ title: 'Original', status: 'todo', project: 'Dev' });
      });

      const taskId = result.current.tasks[0].id;

      act(() => {
        result.current.updateTask(taskId, { title: 'Updated Title', description: 'New desc' });
      });

      expect(result.current.tasks[0].title).toBe('Updated Title');
      expect(result.current.tasks[0].description).toBe('New desc');
    });
  });

  describe('Agent Management', () => {
    it('updates agent status', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        useStore.setState({
          agents: [{ id: 'coder', name: 'Coder', status: 'idle' as const }],
        });
      });

      expect(result.current.agents[0].status).toBe('idle');

      act(() => {
        result.current.updateAgentStatus('coder', 'busy');
      });

      expect(result.current.agents[0].status).toBe('busy');
    });

    it('assigns task to agent', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addTask({ title: 'Test Task', status: 'todo', project: 'Dev' });
      });

      useStore.setState({
        agents: [{ id: 'coder', name: 'Coder', status: 'idle' as const }],
      });

      const taskId = result.current.tasks[0].id;

      act(() => {
        result.current.assignTask(taskId, 'coder');
      });

      expect(result.current.tasks[0].assignedTo).toBe('coder');
    });
  });

  describe('Session Management', () => {
    it('tracks active sessions', () => {
      const { result } = renderHook(() => useStore());

      const session: Session = {
        key: 'session-1',
        agentId: 'coder',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 5,
      };

      act(() => {
        result.current.setSessions([session]);
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0].key).toBe('session-1');
    });

    it('identifies stale sessions', () => {
      const { result } = renderHook(() => useStore());

      const staleSession: Session = {
        key: 'session-old',
        createdAt: Date.now() - 600000,
        lastActivity: Date.now() - 600000,
        messageCount: 1,
      };

      act(() => {
        result.current.setSessions([staleSession]);
      });

      const stale = result.current.sessions.filter(s => Date.now() - s.lastActivity > 300000);
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

      act(() => {
        result.current.addApproval({
          type: 'tweet',
          title: 'Test tweet',
          content: 'Tweet content',
        });
      });

      expect(result.current.approvals).toHaveLength(1);
      expect(result.current.approvals[0].status).toBe('pending');
    });

    it('filters pending approvals', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.addApproval({ type: 'tweet', title: 'Tweet 1', content: 'content 1' });
        result.current.addApproval({ type: 'email', title: 'Email 1', content: 'content 2' });
        result.current.addApproval({ type: 'tweet', title: 'Tweet 2', content: 'content 3' });
      });

      // Approve one
      const emailId = result.current.approvals.find(a => a.type === 'email')!.id;
      act(() => {
        result.current.approveItem(emailId);
      });

      const pending = result.current.approvals.filter(a => a.status === 'pending');
      expect(pending).toHaveLength(2);
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const tasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        status: 'todo' as const,
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const start = performance.now();
      useStore.setState({ tasks });
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
      expect(useStore.getState().tasks).toHaveLength(1000);
    });

    it('filters large datasets quickly', () => {
      const tasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        status: i % 2 === 0 ? 'todo' as const : 'done' as const,
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      useStore.setState({ tasks });

      const start = performance.now();
      const todoTasks = useStore.getState().tasks.filter(t => t.status === 'todo');
      const end = performance.now();

      expect(end - start).toBeLessThan(10);
      expect(todoTasks).toHaveLength(500);
    });
  });
});
