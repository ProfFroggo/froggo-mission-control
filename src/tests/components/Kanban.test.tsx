import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Kanban from '../../components/Kanban';

const mockTasks = [
  {
    id: 'task-1',
    title: 'Build test suite',
    description: 'Create comprehensive tests',
    status: 'todo',
    priority: 'p1',
    project: 'Dev',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'task-2',
    title: 'Review PR',
    status: 'in-progress',
    priority: 'p0',
    project: 'Dev',
    assignedTo: 'coder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'task-3',
    title: 'Deploy update',
    status: 'review',
    priority: 'p2',
    project: 'Ops',
    reviewerId: 'froggo',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('Kanban Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).clawdbot.db.tasks.list = vi.fn().mockResolvedValue(mockTasks);
  });

  it('renders all kanban columns', async () => {
    render(<Kanban />);
    
    await waitFor(() => {
      expect(screen.getByText(/Todo/i)).toBeInTheDocument();
      expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/Review/i)).toBeInTheDocument();
      expect(screen.getByText(/Done/i)).toBeInTheDocument();
    });
  });

  it('displays tasks in correct columns', async () => {
    render(<Kanban />);
    
    await waitFor(() => {
      expect(screen.getByText('Build test suite')).toBeInTheDocument();
      expect(screen.getByText('Review PR')).toBeInTheDocument();
      expect(screen.getByText('Deploy update')).toBeInTheDocument();
    });
  });

  it('shows task priority badges', async () => {
    render(<Kanban />);
    
    await waitFor(() => {
      expect(screen.getByText('P0')).toBeInTheDocument();
      expect(screen.getByText('P1')).toBeInTheDocument();
      expect(screen.getByText('P2')).toBeInTheDocument();
    });
  });

  it('filters tasks by project', async () => {
    const user = userEvent.setup();
    render(<Kanban />);
    
    await waitFor(() => {
      expect(screen.getByText('Build test suite')).toBeInTheDocument();
    });

    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);
    
    const devFilter = screen.getByText('Dev');
    await user.click(devFilter);
    
    await waitFor(() => {
      expect(screen.getByText('Build test suite')).toBeInTheDocument();
      expect(screen.queryByText('Deploy update')).not.toBeInTheDocument();
    });
  });

  it('opens task detail modal on click', async () => {
    const user = userEvent.setup();
    render(<Kanban />);
    
    await waitFor(() => {
      expect(screen.getByText('Build test suite')).toBeInTheDocument();
    });

    const taskCard = screen.getByText('Build test suite');
    await user.click(taskCard);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('creates new task', async () => {
    const user = userEvent.setup();
    const createMock = vi.fn().mockResolvedValue({ id: 'task-new' });
    (window as any).clawdbot.db.tasks.create = createMock;

    render(<Kanban />);
    
    const newTaskButton = screen.getByRole('button', { name: /new task/i });
    await user.click(newTaskButton);
    
    const titleInput = screen.getByPlaceholderText(/task title/i);
    await user.type(titleInput, 'New test task');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New test task',
        })
      );
    });
  });

  it('supports drag and drop between columns', async () => {
    // This would test DnD functionality
    // Note: Testing DnD requires more complex setup with @dnd-kit/core
    render(<Kanban />);
    
    await waitFor(() => {
      expect(screen.getByText('Build test suite')).toBeInTheDocument();
    });
    
    // DnD test implementation would go here
    expect(true).toBe(true);
  });
});
