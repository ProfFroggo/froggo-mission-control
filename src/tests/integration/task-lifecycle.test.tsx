import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

/**
 * Integration Test: Complete Task Lifecycle
 * Tests the full workflow from task creation to completion
 */
describe('Task Lifecycle Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes full task workflow: create → assign → work → review → done', async () => {
    const user = userEvent.setup();
    
    // Mock API responses
    let tasks: any[] = [];
    let taskId = 'task-' + Date.now();
    
    (window as any).clawdbot.db.tasks.list = vi.fn(() => Promise.resolve([...tasks]));
    (window as any).clawdbot.db.tasks.create = vi.fn((task: any) => {
      const newTask = {
        id: taskId,
        ...task,
        status: 'todo',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      tasks.push(newTask);
      return Promise.resolve(newTask);
    });
    (window as any).clawdbot.db.tasks.update = vi.fn((id: string, updates: any) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        Object.assign(task, updates, { updatedAt: Date.now() });
        return Promise.resolve(task);
      }
      return Promise.reject(new Error('Task not found'));
    });
    (window as any).clawdbot.db.tasks.get = vi.fn((id: string) => {
      const task = tasks.find(t => t.id === id);
      return Promise.resolve(task);
    });
    
    const spawnMock = vi.fn().mockResolvedValue({ id: 'session-agent' });
    (window as any).clawdbot.gateway.spawnAgent = spawnMock;
    
    render(<App />);
    
    // Step 1: Navigate to Kanban
    await user.keyboard('{Meta>}5{/Meta}'); // Cmd+5 shortcut
    
    await waitFor(() => {
      expect(screen.getByText(/kanban/i)).toBeInTheDocument();
    });
    
    // Step 2: Create a new task
    const newTaskButton = screen.getByRole('button', { name: /new task/i });
    await user.click(newTaskButton);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    const titleInput = screen.getByLabelText(/title/i);
    const descInput = screen.getByLabelText(/description/i);
    const prioritySelect = screen.getByLabelText(/priority/i);
    
    await user.type(titleInput, 'Build comprehensive test suite');
    await user.type(descInput, 'Create unit, integration, and E2E tests');
    await user.selectOptions(prioritySelect, 'p1');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Build comprehensive test suite')).toBeInTheDocument();
    });
    
    // Verify task was created in Todo column
    const todoColumn = screen.getByText(/^Todo$/i).closest('div');
    expect(within(todoColumn!).getByText('Build comprehensive test suite')).toBeInTheDocument();
    
    // Step 3: Assign to agent
    const taskCard = screen.getByText('Build comprehensive test suite');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    const assignButton = screen.getByRole('button', { name: /assign/i });
    await user.click(assignButton);
    
    const agentSelect = screen.getByLabelText(/agent/i);
    await user.selectOptions(agentSelect, 'coder');
    
    const confirmAssignButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmAssignButton);
    
    await waitFor(() => {
      expect(spawnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'coder',
          taskId: taskId,
        })
      );
    });
    
    // Step 4: Move to In Progress
    const inProgressButton = screen.getByRole('button', { name: /start task/i });
    await user.click(inProgressButton);
    
    await waitFor(() => {
      const inProgressColumn = screen.getByText(/^In Progress$/i).closest('div');
      expect(within(inProgressColumn!).getByText('Build comprehensive test suite')).toBeInTheDocument();
    });
    
    // Step 5: Add subtasks
    const addSubtaskButton = screen.getByRole('button', { name: /add subtask/i });
    
    await user.click(addSubtaskButton);
    const subtaskInput = screen.getByPlaceholderText(/subtask title/i);
    await user.type(subtaskInput, 'Write unit tests{enter}');
    
    await user.click(addSubtaskButton);
    await user.type(subtaskInput, 'Write integration tests{enter}');
    
    await user.click(addSubtaskButton);
    await user.type(subtaskInput, 'Write E2E tests{enter}');
    
    await waitFor(() => {
      expect(screen.getByText('Write unit tests')).toBeInTheDocument();
      expect(screen.getByText('Write integration tests')).toBeInTheDocument();
      expect(screen.getByText('Write E2E tests')).toBeInTheDocument();
    });
    
    // Step 6: Complete subtasks
    const subtaskCheckboxes = screen.getAllByRole('checkbox', { name: /subtask/i });
    
    for (const checkbox of subtaskCheckboxes) {
      await user.click(checkbox);
    }
    
    await waitFor(() => {
      expect(screen.getByText(/3\/3 subtasks complete/i)).toBeInTheDocument();
    });
    
    // Step 7: Move to Review
    const reviewButton = screen.getByRole('button', { name: /submit for review/i });
    await user.click(reviewButton);
    
    await waitFor(() => {
      const reviewColumn = screen.getByText(/^Review$/i).closest('div');
      expect(within(reviewColumn!).getByText('Build comprehensive test suite')).toBeInTheDocument();
    });
    
    // Step 8: Approve and mark as Done
    const approveButton = screen.getByRole('button', { name: /approve/i });
    await user.click(approveButton);
    
    await waitFor(() => {
      const doneColumn = screen.getByText(/^Done$/i).closest('div');
      expect(within(doneColumn!).getByText('Build comprehensive test suite')).toBeInTheDocument();
    });
    
    // Verify final state
    const task = tasks.find(t => t.id === taskId);
    expect(task.status).toBe('done');
    expect(task.assignedTo).toBe('coder');
    expect(task.subtasks.every((st: any) => st.completed)).toBe(true);
  });

  it('handles task rejection and rework', async () => {
    const user = userEvent.setup();
    
    let tasks = [
      {
        id: 'task-review',
        title: 'Task in review',
        status: 'review',
        priority: 'p1',
        assignedTo: 'coder',
        reviewerId: 'froggo',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.db.tasks.list = vi.fn(() => Promise.resolve([...tasks]));
    (window as any).clawdbot.db.tasks.update = vi.fn((id: string, updates: any) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        Object.assign(task, updates, { updatedAt: Date.now() });
        return Promise.resolve(task);
      }
      return Promise.reject(new Error('Task not found'));
    });
    
    render(<App />);
    
    // Navigate to Kanban
    await user.keyboard('{Meta>}5{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText('Task in review')).toBeInTheDocument();
    });
    
    // Open task
    const taskCard = screen.getByText('Task in review');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    // Reject with feedback
    const rejectButton = screen.getByRole('button', { name: /request changes/i });
    await user.click(rejectButton);
    
    const feedbackInput = screen.getByLabelText(/feedback/i);
    await user.type(feedbackInput, 'Please add more test coverage for edge cases');
    
    const confirmRejectButton = screen.getByRole('button', { name: /submit/i });
    await user.click(confirmRejectButton);
    
    await waitFor(() => {
      expect(tasks[0].status).toBe('in-progress');
      expect(tasks[0].reviewNotes).toContain('add more test coverage');
    });
    
    // Verify task moved back to In Progress
    const inProgressColumn = screen.getByText(/^In Progress$/i).closest('div');
    expect(within(inProgressColumn!).getByText('Task in review')).toBeInTheDocument();
  });

  it('prevents completion when subtasks are incomplete', async () => {
    const user = userEvent.setup();
    
    let tasks = [
      {
        id: 'task-incomplete',
        title: 'Task with incomplete subtasks',
        status: 'in-progress',
        priority: 'p1',
        subtasks: [
          { id: 'sub-1', title: 'Subtask 1', completed: true },
          { id: 'sub-2', title: 'Subtask 2', completed: false },
          { id: 'sub-3', title: 'Subtask 3', completed: false },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    (window as any).clawdbot.db.tasks.list = vi.fn(() => Promise.resolve([...tasks]));
    (window as any).clawdbot.db.tasks.update = vi.fn(() => 
      Promise.reject(new Error('Cannot complete: subtasks incomplete'))
    );
    
    render(<App />);
    
    // Navigate to Kanban
    await user.keyboard('{Meta>}5{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText('Task with incomplete subtasks')).toBeInTheDocument();
    });
    
    // Open task
    const taskCard = screen.getByText('Task with incomplete subtasks');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/1\/3 subtasks complete/i)).toBeInTheDocument();
    });
    
    // Try to submit for review
    const reviewButton = screen.getByRole('button', { name: /submit for review/i });
    await user.click(reviewButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/complete all subtasks first/i)).toBeInTheDocument();
    });
    
    // Status should not change
    expect(tasks[0].status).toBe('in-progress');
  });
});
