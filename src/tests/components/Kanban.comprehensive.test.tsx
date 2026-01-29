import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Kanban from '../../components/Kanban';

describe('Kanban Board - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders all kanban columns with correct titles', async () => {
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText(/Todo/i)).toBeInTheDocument();
        expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
        expect(screen.getByText(/Review/i)).toBeInTheDocument();
        expect(screen.getByText(/Done/i)).toBeInTheDocument();
      });
    });

    it('loads and displays tasks from database', async () => {
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
        expect(screen.getByText('Test Task 2')).toBeInTheDocument();
      });
    });

    it('displays task count in each column header', async () => {
      render(<Kanban />);
      
      await waitFor(() => {
        const todoColumn = screen.getByText(/Todo/i).closest('div');
        expect(todoColumn).toContainHTML('1'); // 1 task in todo
      });
    });

    it('shows empty state when no tasks exist', async () => {
      (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue([]);
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task Cards', () => {
    it('displays task with priority badge', async () => {
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('P1')).toBeInTheDocument();
        expect(screen.getByText('P0')).toBeInTheDocument();
      });
    });

    it('shows project tag on task cards', async () => {
      render(<Kanban />);
      
      await waitFor(() => {
        const devTags = screen.getAllByText('Dev');
        expect(devTags.length).toBeGreaterThan(0);
      });
    });

    it('displays assigned agent on task card', async () => {
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText(/coder/i)).toBeInTheDocument();
      });
    });

    it('shows subtask progress indicator', async () => {
      const mockWithSubtasks = vi.fn().mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task with subtasks',
          status: 'in-progress',
          priority: 'p1',
          subtasks: [
            { id: 'sub-1', title: 'Subtask 1', completed: true },
            { id: 'sub-2', title: 'Subtask 2', completed: false },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      
      (window as any).clawdbot.db.tasks.list = mockWithSubtasks;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText(/1\/2/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('filters tasks by priority', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const p0Filter = screen.getByRole('checkbox', { name: /P0/i });
      await user.click(p0Filter);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 2')).toBeInTheDocument();
        expect(screen.queryByText('Test Task 1')).not.toBeInTheDocument();
      });
    });

    it('filters tasks by project', async () => {
      const user = userEvent.setup();
      const mockMultiProject = vi.fn().mockResolvedValue([
        {
          id: 'task-1',
          title: 'Dev Task',
          status: 'todo',
          priority: 'p1',
          project: 'Dev',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'task-2',
          title: 'Ops Task',
          status: 'todo',
          priority: 'p1',
          project: 'Ops',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      
      (window as any).clawdbot.db.tasks.list = mockMultiProject;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Dev Task')).toBeInTheDocument();
        expect(screen.getByText('Ops Task')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const devFilter = screen.getByRole('checkbox', { name: /Dev/i });
      await user.click(devFilter);
      
      await waitFor(() => {
        expect(screen.getByText('Dev Task')).toBeInTheDocument();
        expect(screen.queryByText('Ops Task')).not.toBeInTheDocument();
      });
    });

    it('searches tasks by title', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      await user.type(searchInput, 'Task 2');
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 2')).toBeInTheDocument();
        expect(screen.queryByText('Test Task 1')).not.toBeInTheDocument();
      });
    });

    it('combines multiple filters', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const p1Filter = screen.getByRole('checkbox', { name: /P1/i });
      const devFilter = screen.getByRole('checkbox', { name: /Dev/i });
      
      await user.click(p1Filter);
      await user.click(devFilter);
      
      await waitFor(() => {
        // Should only show P1 Dev tasks
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Task 2')).not.toBeInTheDocument();
      });
    });
  });

  describe('Task Creation', () => {
    it('opens create task modal', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });
    });

    it('creates new task with all fields', async () => {
      const user = userEvent.setup();
      const createMock = vi.fn().mockResolvedValue({
        id: 'task-new',
        title: 'New Task',
        description: 'Test description',
        status: 'todo',
        priority: 'p1',
        project: 'Dev',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      (window as any).clawdbot.db.tasks.create = createMock;
      
      render(<Kanban />);
      
      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByLabelText(/title/i);
      const descInput = screen.getByLabelText(/description/i);
      const prioritySelect = screen.getByLabelText(/priority/i);
      const projectInput = screen.getByLabelText(/project/i);
      
      await user.type(titleInput, 'New Task');
      await user.type(descInput, 'Test description');
      await user.selectOptions(prioritySelect, 'p1');
      await user.type(projectInput, 'Dev');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(createMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Task',
            description: 'Test description',
            priority: 'p1',
            project: 'Dev',
          })
        );
      });
    });

    it('validates required fields', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task Editing', () => {
    it('opens task detail modal on card click', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });
      
      const taskCard = screen.getByText('Test Task 1');
      await user.click(taskCard);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Task 1')).toBeInTheDocument();
      });
    });

    it('updates task details', async () => {
      const user = userEvent.setup();
      const updateMock = vi.fn().mockResolvedValue({
        id: 'task-1',
        title: 'Updated Task',
        status: 'todo',
        priority: 'p0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      (window as any).clawdbot.db.tasks.update = updateMock;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });
      
      const taskCard = screen.getByText('Test Task 1');
      await user.click(taskCard);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByDisplayValue('Test Task 1');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Task');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          'task-1',
          expect.objectContaining({
            title: 'Updated Task',
          })
        );
      });
    });

    it('closes modal on cancel', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });
      
      const taskCard = screen.getByText('Test Task 1');
      await user.click(taskCard);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Task Status Changes', () => {
    it('moves task to next status', async () => {
      const user = userEvent.setup();
      const updateMock = vi.fn().mockResolvedValue({
        id: 'task-1',
        title: 'Test Task 1',
        status: 'in-progress',
        priority: 'p1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      (window as any).clawdbot.db.tasks.update = updateMock;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });
      
      const taskCard = screen.getByText('Test Task 1').closest('div');
      const moveButton = within(taskCard!).getByRole('button', { name: /move/i });
      
      await user.click(moveButton);
      
      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          'task-1',
          expect.objectContaining({
            status: 'in-progress',
          })
        );
      });
    });
  });

  describe('Task Deletion', () => {
    it('confirms before deleting task', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });
      
      const taskCard = screen.getByText('Test Task 1');
      await user.click(taskCard);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
    });

    it('deletes task after confirmation', async () => {
      const user = userEvent.setup();
      const deleteMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.db.tasks.delete = deleteMock;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      });
      
      const taskCard = screen.getByText('Test Task 1');
      await user.click(taskCard);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(deleteMock).toHaveBeenCalledWith('task-1');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('opens new task modal with keyboard shortcut', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      await user.keyboard('{Meta>}n{/Meta}');
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('closes modal with Escape key', async () => {
      const user = userEvent.setup();
      render(<Kanban />);
      
      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when task load fails', async () => {
      const errorMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (window as any).clawdbot.db.tasks.list = errorMock;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByText(/error loading tasks/i)).toBeInTheDocument();
      });
    });

    it('displays error when task creation fails', async () => {
      const user = userEvent.setup();
      const createMock = vi.fn().mockRejectedValue(new Error('Creation failed'));
      (window as any).clawdbot.db.tasks.create = createMock;
      
      render(<Kanban />);
      
      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Task');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to create task/i)).toBeInTheDocument();
      });
    });

    it('retries on network error', async () => {
      const listMock = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);
      
      (window as any).clawdbot.db.tasks.list = listMock;
      
      render(<Kanban />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
      
      const user = userEvent.setup();
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(listMock).toHaveBeenCalledTimes(2);
      });
    });
  });
});
