import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from '../../components/TaskModal';

const mockTask = {
  id: 'task-1',
  title: 'Test Task',
  description: 'This is a test task',
  status: 'todo',
  priority: 'p1',
  project: 'Dev',
  subtasks: [
    { id: 'sub-1', title: 'Subtask 1', completed: false },
    { id: 'sub-2', title: 'Subtask 2', completed: true },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('TaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task details', () => {
    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('This is a test task')).toBeInTheDocument();
  });

  it('displays subtasks with completion status', () => {
    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    expect(screen.getByText('Subtask 1')).toBeInTheDocument();
    expect(screen.getByText('Subtask 2')).toBeInTheDocument();
    
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).toBeChecked(); // Second subtask is completed
  });

  it('allows editing task title', async () => {
    const user = userEvent.setup();
    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    
    const titleInput = screen.getByDisplayValue('Test Task');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Task Title');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Task Title',
        })
      );
    });
  });

  it('toggles subtask completion', async () => {
    const user = userEvent.setup();
    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // Toggle first subtask
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('adds new subtask', async () => {
    const user = userEvent.setup();
    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    const addButton = screen.getByRole('button', { name: /add subtask/i });
    await user.click(addButton);
    
    const input = screen.getByPlaceholderText(/subtask title/i);
    await user.type(input, 'New subtask{enter}');
    
    await waitFor(() => {
      expect(screen.getByText('New subtask')).toBeInTheDocument();
    });
  });

  it('supports conversational mode with agent', async () => {
    const user = userEvent.setup();
    const sendMock = vi.fn().mockResolvedValue({
      reply: 'I can help with that!',
    });
    (window as any).clawdbot.gateway.send = sendMock;

    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    const chatButton = screen.getByRole('button', { name: /ask agent/i });
    await user.click(chatButton);
    
    const messageInput = screen.getByPlaceholderText(/ask about this task/i);
    await user.type(messageInput, 'How should I approach this?{enter}');
    
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalled();
      expect(screen.getByText('I can help with that!')).toBeInTheDocument();
    });
  });

  it('closes modal on escape key', async () => {
    const user = userEvent.setup();
    render(<TaskModal task={mockTask} onClose={mockOnClose} onSave={mockOnSave} />);
    
    await user.keyboard('{Escape}');
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});
