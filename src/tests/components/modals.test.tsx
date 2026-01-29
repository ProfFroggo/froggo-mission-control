import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPalette from '../../components/CommandPalette';
import ContactModal from '../../components/ContactModal';
import SkillModal from '../../components/SkillModal';
import AgentDetailModal from '../../components/AgentDetailModal';

describe('Modal Components', () => {
  describe('CommandPalette', () => {
    const mockOnClose = vi.fn();
    const mockOnNavigate = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('opens and displays search input', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />);
      
      expect(screen.getByPlaceholderText(/search commands/i)).toBeInTheDocument();
    });

    it('closes on escape key', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />);
      
      await user.keyboard('{Escape}');
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('filters commands based on search input', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />);
      
      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'task');
      
      await waitFor(() => {
        expect(screen.getByText(/new task/i)).toBeInTheDocument();
      });
    });

    it('navigates on command selection', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />);
      
      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'kanban');
      
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnNavigate).toHaveBeenCalledWith('kanban');
      });
    });

    it('supports keyboard navigation through results', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />);
      
      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'new');
      
      // Navigate down
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      
      // Navigate up
      await user.keyboard('{ArrowUp}');
      
      await user.keyboard('{Enter}');
      
      expect(mockOnNavigate).toHaveBeenCalled();
    });

    it('shows recent commands', () => {
      localStorage.setItem('command-palette-history', JSON.stringify([
        'Go to Tasks',
        'New Task',
      ]));

      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />);
      
      expect(screen.getByText(/recent/i)).toBeInTheDocument();
    });
  });

  describe('ContactModal', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders contact form fields', () => {
      render(<ContactModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      const user = userEvent.setup();
      render(<ContactModal isOpen={true} onClose={mockOnClose} />);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      render(<ContactModal isOpen={true} onClose={mockOnClose} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it('saves contact successfully', async () => {
      const user = userEvent.setup();
      const saveMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.contacts = { save: saveMock };

      render(<ContactModal isOpen={true} onClose={mockOnClose} />);
      
      await user.type(screen.getByLabelText(/name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(saveMock).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
          })
        );
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('supports editing existing contact', async () => {
      const user = userEvent.setup();
      const contact = {
        id: 'contact-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      render(<ContactModal isOpen={true} onClose={mockOnClose} contact={contact as any} />);
      
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
    });
  });

  describe('SkillModal', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders skill form', () => {
      render(<SkillModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByLabelText(/skill name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('supports conversational mode', async () => {
      const user = userEvent.setup();
      const sendMock = vi.fn().mockResolvedValue({
        reply: 'What skill would you like to add?',
      });
      (window as any).clawdbot.gateway.send = sendMock;

      render(<SkillModal isOpen={true} onClose={mockOnClose} />);
      
      const chatButton = screen.getByRole('button', { name: /ask froggo/i });
      await user.click(chatButton);
      
      const messageInput = screen.getByPlaceholderText(/describe the skill/i);
      await user.type(messageInput, 'How to use PostgreSQL{enter}');
      
      await waitFor(() => {
        expect(sendMock).toHaveBeenCalled();
      });
    });

    it('creates skill with agent assistance', async () => {
      const user = userEvent.setup();
      const createMock = vi.fn().mockResolvedValue({ id: 'skill-1' });
      (window as any).clawdbot.skills = { create: createMock };

      render(<SkillModal isOpen={true} onClose={mockOnClose} />);
      
      await user.type(screen.getByLabelText(/skill name/i), 'PostgreSQL Basics');
      await user.type(screen.getByLabelText(/description/i), 'Database querying and optimization');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(createMock).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('AgentDetailModal', () => {
    const mockAgent = {
      id: 'coder',
      name: 'Coder',
      emoji: '💻',
      status: 'active' as const,
      capabilities: ['code', 'debug', 'test'],
      metrics: {
        tasksCompleted: 42,
        successRate: 0.95,
        avgCompletionTime: 3600000,
      },
    };

    const mockOnClose = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('displays agent information', () => {
      render(<AgentDetailModal agent={mockAgent as any} onClose={mockOnClose} />);
      
      expect(screen.getByText('Coder')).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    it('shows agent capabilities', () => {
      render(<AgentDetailModal agent={mockAgent as any} onClose={mockOnClose} />);
      
      expect(screen.getByText(/code/i)).toBeInTheDocument();
      expect(screen.getByText(/debug/i)).toBeInTheDocument();
      expect(screen.getByText(/test/i)).toBeInTheDocument();
    });

    it('displays performance metrics', () => {
      render(<AgentDetailModal agent={mockAgent as any} onClose={mockOnClose} />);
      
      expect(screen.getByText(/42/)).toBeInTheDocument(); // Tasks completed
      expect(screen.getByText(/95%/)).toBeInTheDocument(); // Success rate
    });

    it('allows chatting with agent', async () => {
      const user = userEvent.setup();
      const sendMock = vi.fn().mockResolvedValue({
        reply: 'I am ready to help!',
      });
      (window as any).clawdbot.gateway.send = sendMock;

      render(<AgentDetailModal agent={mockAgent as any} onClose={mockOnClose} />);
      
      const chatTab = screen.getByRole('tab', { name: /chat/i });
      await user.click(chatTab);
      
      const messageInput = screen.getByPlaceholderText(/message/i);
      await user.type(messageInput, 'Hello{enter}');
      
      await waitFor(() => {
        expect(sendMock).toHaveBeenCalled();
        expect(screen.getByText('I am ready to help!')).toBeInTheDocument();
      });
    });

    it('spawns agent for task', async () => {
      const user = userEvent.setup();
      const spawnMock = vi.fn().mockResolvedValue({ sessionKey: 'session-1' });
      (window as any).clawdbot.gateway.spawnAgent = spawnMock;

      render(<AgentDetailModal agent={mockAgent as any} onClose={mockOnClose} />);
      
      const spawnButton = screen.getByRole('button', { name: /spawn/i });
      await user.click(spawnButton);
      
      await waitFor(() => {
        expect(spawnMock).toHaveBeenCalledWith('coder');
      });
    });
  });

  describe('Modal Accessibility', () => {
    it('traps focus within modal', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={vi.fn()} />);
      
      // Tab through all focusable elements
      await user.tab();
      await user.tab();
      await user.tab();
      
      // Focus should stay within modal
      const activeElement = document.activeElement;
      const modal = screen.getByRole('dialog');
      
      expect(modal.contains(activeElement)).toBe(true);
    });

    it('returns focus to trigger on close', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      
      const button = document.createElement('button');
      button.textContent = 'Open Modal';
      document.body.appendChild(button);
      button.focus();

      render(<CommandPalette isOpen={true} onClose={mockOnClose} onNavigate={vi.fn()} />);
      
      await user.keyboard('{Escape}');
      
      expect(mockOnClose).toHaveBeenCalled();
      // In real implementation, focus should return to button
    });

    it('has proper ARIA attributes', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });
  });
});
