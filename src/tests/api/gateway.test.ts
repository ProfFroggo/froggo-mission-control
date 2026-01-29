import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateway } from '../../lib/gateway';

describe('Gateway API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection', () => {
    it('connects to gateway on startup', async () => {
      const connectMock = vi.fn().mockResolvedValue({ status: 'connected' });
      (window as any).clawdbot.gateway.connect = connectMock;

      await gateway.connect();
      
      expect(connectMock).toHaveBeenCalled();
    });

    it('handles connection errors', async () => {
      const connectMock = vi.fn().mockRejectedValue(new Error('Connection failed'));
      (window as any).clawdbot.gateway.connect = connectMock;

      await expect(gateway.connect()).rejects.toThrow('Connection failed');
    });

    it('reconnects on disconnect', async () => {
      const reconnectMock = vi.fn().mockResolvedValue({ status: 'reconnected' });
      (window as any).clawdbot.gateway.reconnect = reconnectMock;

      await gateway.reconnect();
      
      expect(reconnectMock).toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    it('sends message to gateway', async () => {
      const sendMock = vi.fn().mockResolvedValue({
        reply: 'Message received',
      });
      (window as any).clawdbot.gateway.send = sendMock;

      const response = await gateway.send('Hello Froggo');
      
      expect(sendMock).toHaveBeenCalledWith('Hello Froggo');
      expect(response.reply).toBe('Message received');
    });

    it('handles send errors', async () => {
      const sendMock = vi.fn().mockRejectedValue(new Error('Send failed'));
      (window as any).clawdbot.gateway.send = sendMock;

      await expect(gateway.send('test')).rejects.toThrow('Send failed');
    });

    it('queues messages when offline', async () => {
      const queueMock = vi.fn();
      (window as any).clawdbot.gateway.queue = queueMock;

      gateway.queueMessage('Offline message');
      
      expect(queueMock).toHaveBeenCalledWith('Offline message');
    });
  });

  describe('Session Management', () => {
    it('lists active sessions', async () => {
      const sessionsMock = vi.fn().mockResolvedValue([
        {
          key: 'session-1',
          kind: 'direct',
          updatedAt: Date.now(),
          sessionId: 'session-1',
        },
      ]);
      (window as any).clawdbot.gateway.sessions = sessionsMock;

      const sessions = await gateway.sessions();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].kind).toBe('direct');
    });

    it('spawns agent session', async () => {
      const spawnMock = vi.fn().mockResolvedValue({
        sessionKey: 'agent-session-1',
      });
      (window as any).clawdbot.gateway.spawnAgent = spawnMock;

      const result = await gateway.spawnAgent('coder', 'task-1');
      
      expect(spawnMock).toHaveBeenCalledWith('coder', 'task-1');
      expect(result.sessionKey).toBe('agent-session-1');
    });

    it('terminates session', async () => {
      const terminateMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.gateway.terminateSession = terminateMock;

      await gateway.terminateSession('session-1');
      
      expect(terminateMock).toHaveBeenCalledWith('session-1');
    });
  });

  describe('Task Operations', () => {
    it('creates task via gateway', async () => {
      const createMock = vi.fn().mockResolvedValue({
        id: 'task-new',
        title: 'New Task',
      });
      (window as any).clawdbot.db.tasks.create = createMock;

      const task = await gateway.createTask({
        title: 'New Task',
        status: 'todo',
        project: 'Dev',
      });
      
      expect(createMock).toHaveBeenCalled();
      expect(task.id).toBe('task-new');
    });

    it('updates task', async () => {
      const updateMock = vi.fn().mockResolvedValue({
        id: 'task-1',
        status: 'in-progress',
      });
      (window as any).clawdbot.db.tasks.update = updateMock;

      await gateway.updateTask('task-1', { status: 'in-progress' });
      
      expect(updateMock).toHaveBeenCalledWith('task-1', { status: 'in-progress' });
    });

    it('deletes task', async () => {
      const deleteMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.db.tasks.delete = deleteMock;

      await gateway.deleteTask('task-1');
      
      expect(deleteMock).toHaveBeenCalledWith('task-1');
    });

    it('fetches task by ID', async () => {
      const getMock = vi.fn().mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
      });
      (window as any).clawdbot.db.tasks.get = getMock;

      const task = await gateway.getTask('task-1');
      
      expect(getMock).toHaveBeenCalledWith('task-1');
      expect(task.title).toBe('Test Task');
    });
  });

  describe('Real-time Events', () => {
    it('subscribes to task updates', () => {
      const subscribeMock = vi.fn();
      (window as any).clawdbot.gateway.subscribe = subscribeMock;

      const callback = vi.fn();
      gateway.subscribe('task:updated', callback);
      
      expect(subscribeMock).toHaveBeenCalledWith('task:updated', callback);
    });

    it('unsubscribes from events', () => {
      const unsubscribeMock = vi.fn();
      (window as any).clawdbot.gateway.unsubscribe = unsubscribeMock;

      const callback = vi.fn();
      gateway.unsubscribe('task:updated', callback);
      
      expect(unsubscribeMock).toHaveBeenCalledWith('task:updated', callback);
    });

    it('receives real-time task updates', async () => {
      const callback = vi.fn();
      
      // Mock event subscription
      (window as any).clawdbot.gateway.subscribe = (event: string, cb: Function) => {
        if (event === 'task:updated') {
          // Simulate event
          setTimeout(() => {
            cb({ taskId: 'task-1', status: 'done' });
          }, 100);
        }
      };

      gateway.subscribe('task:updated', callback);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(callback).toHaveBeenCalledWith({ taskId: 'task-1', status: 'done' });
    });
  });

  describe('Error Handling', () => {
    it('retries failed requests', async () => {
      const sendMock = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ reply: 'Success' });

      (window as any).clawdbot.gateway.send = sendMock;

      const response = await gateway.sendWithRetry('test message', 3);
      
      expect(sendMock).toHaveBeenCalledTimes(3);
      expect(response.reply).toBe('Success');
    });

    it('gives up after max retries', async () => {
      const sendMock = vi.fn().mockRejectedValue(new Error('Network error'));
      (window as any).clawdbot.gateway.send = sendMock;

      await expect(gateway.sendWithRetry('test', 3)).rejects.toThrow('Network error');
      
      expect(sendMock).toHaveBeenCalledTimes(3);
    });

    it('handles timeout errors', async () => {
      const sendMock = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (window as any).clawdbot.gateway.send = sendMock;

      await expect(
        gateway.sendWithTimeout('test', 1000)
      ).rejects.toThrow('Timeout');
    });
  });

  describe('Batch Operations', () => {
    it('batches multiple task updates', async () => {
      const batchUpdateMock = vi.fn().mockResolvedValue({
        updated: 3,
      });
      (window as any).clawdbot.db.tasks.batchUpdate = batchUpdateMock;

      await gateway.batchUpdateTasks([
        { id: 'task-1', status: 'done' },
        { id: 'task-2', status: 'done' },
        { id: 'task-3', status: 'done' },
      ]);
      
      expect(batchUpdateMock).toHaveBeenCalled();
    });

    it('handles partial batch failures', async () => {
      const batchUpdateMock = vi.fn().mockResolvedValue({
        updated: 2,
        failed: ['task-3'],
      });
      (window as any).clawdbot.db.tasks.batchUpdate = batchUpdateMock;

      const result = await gateway.batchUpdateTasks([
        { id: 'task-1', status: 'done' },
        { id: 'task-2', status: 'done' },
        { id: 'task-3', status: 'done' },
      ]);
      
      expect(result.failed).toEqual(['task-3']);
    });
  });

  describe('Caching', () => {
    it('caches task list responses', async () => {
      const listMock = vi.fn().mockResolvedValue([
        { id: 'task-1', title: 'Task 1' },
      ]);
      (window as any).clawdbot.db.tasks.list = listMock;

      // First call - should hit API
      await gateway.getTasks();
      expect(listMock).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await gateway.getTasks();
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache on update', async () => {
      const listMock = vi.fn().mockResolvedValue([
        { id: 'task-1', title: 'Task 1' },
      ]);
      const updateMock = vi.fn().mockResolvedValue({ success: true });
      
      (window as any).clawdbot.db.tasks.list = listMock;
      (window as any).clawdbot.db.tasks.update = updateMock;

      // Get tasks (cache)
      await gateway.getTasks();
      expect(listMock).toHaveBeenCalledTimes(1);

      // Update task (invalidate cache)
      await gateway.updateTask('task-1', { status: 'done' });

      // Get tasks again (should re-fetch)
      await gateway.getTasks();
      expect(listMock).toHaveBeenCalledTimes(2);
    });
  });
});
