import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

/**
 * Integration Test: Agent Communication & Task Execution
 * Tests communication between dashboard and agents via gateway
 */
describe('Agent Communication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns agent and tracks task execution', async () => {
    const user = userEvent.setup();
    
    // Mock gateway communication
    const sendMock = vi.fn().mockResolvedValue({ success: true });
    const spawnMock = vi.fn().mockResolvedValue({
      id: 'session-coder-123',
      label: 'coder-task-456',
      status: 'active',
    });
    
    (window as any).clawdbot.gateway.send = sendMock;
    (window as any).clawdbot.gateway.spawnAgent = spawnMock;
    
    const tasks = [
      {
        id: 'task-456',
        title: 'Build feature X',
        status: 'todo',
        priority: 'p1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue(tasks);
    (window as any).clawdbot.db.tasks.get = vi.fn((id: string) => 
      Promise.resolve(tasks.find(t => t.id === id))
    );
    
    render(<App />);
    
    // Navigate to Agent Panel
    await user.keyboard('{Meta>}6{/Meta}'); // Cmd+6
    
    await waitFor(() => {
      expect(screen.getByText(/agents/i)).toBeInTheDocument();
    });
    
    // Spawn coder agent with task
    const spawnButton = screen.getByRole('button', { name: /spawn agent/i });
    await user.click(spawnButton);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    const agentSelect = screen.getByLabelText(/agent type/i);
    await user.selectOptions(agentSelect, 'coder');
    
    const taskSelect = screen.getByLabelText(/task/i);
    await user.selectOptions(taskSelect, 'task-456');
    
    const confirmButton = screen.getByRole('button', { name: /spawn/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expect(spawnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'coder',
          taskId: 'task-456',
          label: expect.stringContaining('coder-task-456'),
        })
      );
    });
    
    // Verify agent session appears
    await waitFor(() => {
      expect(screen.getByText(/session-coder-123/i)).toBeInTheDocument();
    });
  });

  it('receives real-time progress updates from agent', async () => {
    const user = userEvent.setup();
    
    const tasks = [
      {
        id: 'task-789',
        title: 'Research topic Y',
        status: 'in-progress',
        priority: 'p1',
        assignedTo: 'researcher',
        subtasks: [
          { id: 'sub-1', title: 'Step 1', completed: false },
          { id: 'sub-2', title: 'Step 2', completed: false },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue(tasks);
    (window as any).clawdbot.db.tasks.get = vi.fn((id: string) => 
      Promise.resolve(tasks.find(t => t.id === id))
    );
    
    render(<App />);
    
    // Navigate to task
    await user.keyboard('{Meta>}5{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText('Research topic Y')).toBeInTheDocument();
    });
    
    const taskCard = screen.getByText('Research topic Y');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/0\/2 subtasks/i)).toBeInTheDocument();
    });
    
    // Simulate agent progress update via WebSocket
    const progressEvent = new CustomEvent('task-progress', {
      detail: {
        taskId: 'task-789',
        subtaskId: 'sub-1',
        completed: true,
        message: 'Completed initial research',
      },
    });
    
    window.dispatchEvent(progressEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/1\/2 subtasks/i)).toBeInTheDocument();
      expect(screen.getByText(/completed initial research/i)).toBeInTheDocument();
    });
    
    // Second progress update
    const progressEvent2 = new CustomEvent('task-progress', {
      detail: {
        taskId: 'task-789',
        subtaskId: 'sub-2',
        completed: true,
        message: 'Finished analysis',
      },
    });
    
    window.dispatchEvent(progressEvent2);
    
    await waitFor(() => {
      expect(screen.getByText(/2\/2 subtasks/i)).toBeInTheDocument();
      expect(screen.getByText(/finished analysis/i)).toBeInTheDocument();
    });
  });

  it('handles agent conversational mode in task modal', async () => {
    const user = userEvent.setup();
    
    const sendMock = vi.fn()
      .mockResolvedValueOnce({
        reply: 'I can help with that. Let me break it down into steps.',
        suggestions: ['Start with unit tests', 'Add integration tests', 'Set up CI pipeline'],
      })
      .mockResolvedValueOnce({
        reply: 'Sure! I'll create subtasks for each step.',
      });
    
    (window as any).clawdbot.gateway.send = sendMock;
    
    const tasks = [
      {
        id: 'task-conv',
        title: 'Setup testing',
        status: 'todo',
        priority: 'p1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue(tasks);
    
    render(<App />);
    
    // Navigate to task
    await user.keyboard('{Meta>}5{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText('Setup testing')).toBeInTheDocument();
    });
    
    const taskCard = screen.getByText('Setup testing');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    // Enter conversational mode
    const chatButton = screen.getByRole('button', { name: /ask agent/i });
    await user.click(chatButton);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about this task/i)).toBeInTheDocument();
    });
    
    // Send message to agent
    const messageInput = screen.getByPlaceholderText(/ask about this task/i);
    await user.type(messageInput, 'How should I approach this task?');
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'How should I approach this task?',
          context: expect.objectContaining({
            taskId: 'task-conv',
            title: 'Setup testing',
          }),
        })
      );
    });
    
    // Verify agent response appears
    await waitFor(() => {
      expect(screen.getByText(/I can help with that/i)).toBeInTheDocument();
      expect(screen.getByText(/Start with unit tests/i)).toBeInTheDocument();
      expect(screen.getByText(/Add integration tests/i)).toBeInTheDocument();
    });
    
    // Click suggestion
    const suggestion = screen.getByText(/Start with unit tests/i);
    await user.click(suggestion);
    
    await waitFor(() => {
      expect(messageInput).toHaveValue('Start with unit tests');
    });
    
    // Send follow-up
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/I'll create subtasks/i)).toBeInTheDocument();
    });
  });

  it('terminates agent session and updates task status', async () => {
    const user = userEvent.setup();
    
    const terminateMock = vi.fn().mockResolvedValue({ success: true });
    (window as any).clawdbot.gateway.terminateSession = terminateMock;
    
    const sessions = [
      {
        id: 'session-coder-999',
        label: 'coder-task-999',
        agent: 'coder',
        taskId: 'task-999',
        status: 'active',
        createdAt: Date.now(),
      },
    ];
    
    const tasks = [
      {
        id: 'task-999',
        title: 'Task in progress',
        status: 'in-progress',
        priority: 'p1',
        assignedTo: 'coder',
        sessionId: 'session-coder-999',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.gateway.sessions = vi.fn().mockResolvedValue(sessions);
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue(tasks);
    
    render(<App />);
    
    // Navigate to sessions
    await user.keyboard('{Meta>}4{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText('session-coder-999')).toBeInTheDocument();
    });
    
    // Terminate session
    const sessionCard = screen.getByText('session-coder-999').closest('div');
    const menuButton = within(sessionCard!).getByRole('button', { name: /menu/i });
    
    await user.click(menuButton);
    
    const terminateOption = screen.getByText(/terminate/i);
    await user.click(terminateOption);
    
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expect(terminateMock).toHaveBeenCalledWith('session-coder-999');
    });
    
    // Verify task status updated
    await waitFor(() => {
      expect(tasks[0].status).toBe('todo');
      expect(tasks[0].assignedTo).toBeUndefined();
    });
  });

  it('handles gateway connection loss and reconnection', async () => {
    const user = userEvent.setup();
    
    let connectionState = 'connected';
    const sendMock = vi.fn().mockImplementation(() => {
      if (connectionState === 'disconnected') {
        return Promise.reject(new Error('Gateway offline'));
      }
      return Promise.resolve({ success: true });
    });
    
    (window as any).clawdbot.gateway.send = sendMock;
    (window as any).clawdbot.gateway.state = connectionState;
    
    render(<App />);
    
    // Simulate connection loss
    connectionState = 'disconnected';
    const disconnectEvent = new CustomEvent('gateway-disconnected');
    window.dispatchEvent(disconnectEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/gateway offline/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    
    // Try to send message while offline
    await user.keyboard('{Meta>}3{/Meta}'); // Navigate to chat
    
    const messageInput = screen.getByPlaceholderText(/type a message/i);
    await user.type(messageInput, 'Hello{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText(/message queued/i)).toBeInTheDocument();
    });
    
    // Simulate reconnection
    connectionState = 'connected';
    const reconnectEvent = new CustomEvent('gateway-connected');
    window.dispatchEvent(reconnectEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/gateway connected/i)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    
    // Verify queued message sent
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hello',
        })
      );
    });
  });

  it('syncs task updates bidirectionally between dashboard and agent', async () => {
    const user = userEvent.setup();
    
    const tasks = [
      {
        id: 'task-sync',
        title: 'Synced task',
        status: 'in-progress',
        priority: 'p1',
        description: 'Original description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue(tasks);
    (window as any).clawdbot.db.tasks.get = vi.fn((id: string) => 
      Promise.resolve(tasks.find(t => t.id === id))
    );
    (window as any).clawdbot.db.tasks.update = vi.fn((id: string, updates: any) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        Object.assign(task, updates, { updatedAt: Date.now() });
        return Promise.resolve(task);
      }
      return Promise.reject(new Error('Task not found'));
    });
    
    render(<App />);
    
    // Navigate to task
    await user.keyboard('{Meta>}5{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText('Synced task')).toBeInTheDocument();
    });
    
    const taskCard = screen.getByText('Synced task');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    // User updates description in dashboard
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    
    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'Updated by user in dashboard');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(tasks[0].description).toBe('Updated by user in dashboard');
    });
    
    // Simulate agent updating the same task
    const agentUpdateEvent = new CustomEvent('task-updated', {
      detail: {
        taskId: 'task-sync',
        updates: {
          description: 'Agent added more details: Updated by user in dashboard. Agent notes: implementation complete.',
        },
      },
    });
    
    window.dispatchEvent(agentUpdateEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Agent notes: implementation complete/i)).toBeInTheDocument();
    });
    
    // Verify both updates are preserved
    expect(tasks[0].description).toContain('Updated by user in dashboard');
    expect(tasks[0].description).toContain('Agent notes: implementation complete');
  });
});
