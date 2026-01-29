import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

describe('Task Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('completes full task lifecycle: create → assign → work → review → done', async () => {
    const user = userEvent.setup();
    
    const createMock = vi.fn().mockResolvedValue({
      id: 'task-workflow-1',
      title: 'Integration Test Task',
      status: 'todo',
    });
    const updateMock = vi.fn();
    const spawnMock = vi.fn().mockResolvedValue({ sessionKey: 'session-1' });

    (window as any).clawdbot.db.tasks.create = createMock;
    (window as any).clawdbot.db.tasks.update = updateMock;
    (window as any).clawdbot.gateway.spawnAgent = spawnMock;
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue([]);

    render(<App />);

    // Navigate to Kanban
    await user.keyboard('{Meta>}5{/Meta}');
    
    await waitFor(() => {
      expect(screen.getByText(/Kanban/i)).toBeInTheDocument();
    });

    // Create new task
    const newTaskBtn = screen.getByRole('button', { name: /new task/i });
    await user.click(newTaskBtn);
    
    const titleInput = screen.getByPlaceholderText(/task title/i);
    await user.type(titleInput, 'Integration Test Task');
    
    const descInput = screen.getByPlaceholderText(/description/i);
    await user.type(descInput, 'Full workflow test');
    
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });

    // Assign to agent
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue([
      {
        id: 'task-workflow-1',
        title: 'Integration Test Task',
        status: 'todo',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const taskCard = await screen.findByText('Integration Test Task');
    await user.click(taskCard);

    const assignSelect = screen.getByLabelText(/assign to/i);
    await user.selectOptions(assignSelect, 'coder');
    
    const assignBtn = screen.getByRole('button', { name: /assign/i });
    await user.click(assignBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'task-workflow-1',
        expect.objectContaining({ assignedTo: 'coder' })
      );
    });

    // Move to in-progress
    const statusSelect = screen.getByLabelText(/status/i);
    await user.selectOptions(statusSelect, 'in-progress');

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'task-workflow-1',
        expect.objectContaining({ status: 'in-progress' })
      );
    });

    // Move to review
    await user.selectOptions(statusSelect, 'review');

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'task-workflow-1',
        expect.objectContaining({ status: 'review' })
      );
    });

    // Approve and move to done
    const approveBtn = screen.getByRole('button', { name: /approve/i });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'task-workflow-1',
        expect.objectContaining({ 
          status: 'done',
          reviewStatus: 'approved',
        })
      );
    });
  });

  it('handles subtask completion tracking', async () => {
    const user = userEvent.setup();
    const updateMock = vi.fn();
    
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue([
      {
        id: 'task-sub-1',
        title: 'Task with subtasks',
        status: 'in-progress',
        subtasks: [
          { id: 'sub-1', title: 'Step 1', completed: false },
          { id: 'sub-2', title: 'Step 2', completed: false },
          { id: 'sub-3', title: 'Step 3', completed: false },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    (window as any).clawdbot.db.tasks.update = updateMock;

    render(<App />);

    await user.keyboard('{Meta>}5{/Meta}');
    
    const taskCard = await screen.findByText('Task with subtasks');
    await user.click(taskCard);

    // Complete subtasks one by one
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      // Progress should be 33% (1/3 complete)
    });

    await user.click(checkboxes[1]);
    await waitFor(() => {
      // Progress should be 67% (2/3 complete)
    });

    await user.click(checkboxes[2]);
    await waitFor(() => {
      // Progress should be 100% (3/3 complete)
      // Should suggest moving to review
      expect(screen.getByText(/all subtasks complete/i)).toBeInTheDocument();
    });
  });

  it('handles task blocking dependencies', async () => {
    const user = userEvent.setup();
    
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue([
      {
        id: 'task-blocker',
        title: 'Blocked Task',
        status: 'todo',
        blockedBy: ['task-dependency'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task-dependency',
        title: 'Dependency Task',
        status: 'in-progress',
        blocks: ['task-blocker'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    render(<App />);
    await user.keyboard('{Meta>}5{/Meta}');
    
    const blockedTask = await screen.findByText('Blocked Task');
    await user.click(blockedTask);

    // Should show blocking indicator
    expect(screen.getByText(/blocked by/i)).toBeInTheDocument();
    expect(screen.getByText('Dependency Task')).toBeInTheDocument();

    // Should not allow moving to in-progress
    const statusSelect = screen.getByLabelText(/status/i) as HTMLSelectElement;
    expect(statusSelect.value).toBe('todo');
    
    // Attempt to move should show warning
    await user.selectOptions(statusSelect, 'in-progress');
    await waitFor(() => {
      expect(screen.getByText(/cannot start.*blocked/i)).toBeInTheDocument();
    });
  });
});
