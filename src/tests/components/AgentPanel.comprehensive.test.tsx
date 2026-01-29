import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentPanel from '../../components/AgentPanel';

const mockAgents = [
  {
    id: 'coder',
    name: 'Coder',
    status: 'busy',
    currentTask: 'task-1',
    lastActive: Date.now(),
    tasksCompleted: 15,
    avgResponseTime: 120,
  },
  {
    id: 'writer',
    name: 'Writer',
    status: 'idle',
    currentTask: null,
    lastActive: Date.now() - 300000, // 5 min ago
    tasksCompleted: 8,
    avgResponseTime: 180,
  },
  {
    id: 'researcher',
    name: 'Researcher',
    status: 'offline',
    currentTask: null,
    lastActive: Date.now() - 3600000, // 1 hour ago
    tasksCompleted: 22,
    avgResponseTime: 240,
  },
];

describe('Agent Panel - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).clawdbot.db.agents.list = vi.fn().mockResolvedValue(mockAgents);
  });

  describe('Initial Rendering', () => {
    it('renders all agents', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
        expect(screen.getByText('Writer')).toBeInTheDocument();
        expect(screen.getByText('Researcher')).toBeInTheDocument();
      });
    });

    it('displays agent status indicators', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/busy/i)).toBeInTheDocument();
        expect(screen.getByText(/idle/i)).toBeInTheDocument();
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
      });
    });

    it('shows agent statistics', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument(); // coder tasks
        expect(screen.getByText('8')).toBeInTheDocument(); // writer tasks
        expect(screen.getByText('22')).toBeInTheDocument(); // researcher tasks
      });
    });

    it('displays empty state when no agents exist', async () => {
      (window as any).clawdbot.db.agents.list = vi.fn().mockResolvedValue([]);
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/no agents configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('Agent Status', () => {
    it('shows green indicator for idle agents', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        const writerCard = screen.getByText('Writer').closest('div');
        const statusDot = within(writerCard!).getByTestId('status-indicator');
        expect(statusDot).toHaveClass('bg-green-500');
      });
    });

    it('shows yellow indicator for busy agents', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        const coderCard = screen.getByText('Coder').closest('div');
        const statusDot = within(coderCard!).getByTestId('status-indicator');
        expect(statusDot).toHaveClass('bg-yellow-500');
      });
    });

    it('shows gray indicator for offline agents', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        const researcherCard = screen.getByText('Researcher').closest('div');
        const statusDot = within(researcherCard!).getByTestId('status-indicator');
        expect(statusDot).toHaveClass('bg-gray-500');
      });
    });

    it('updates status in real-time', async () => {
      const { rerender } = render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });

      // Simulate agent status change
      const updatedAgents = [...mockAgents];
      updatedAgents[0].status = 'idle';
      updatedAgents[0].currentTask = null;
      
      (window as any).clawdbot.db.agents.list = vi.fn().mockResolvedValue(updatedAgents);
      
      rerender(<AgentPanel />);
      
      await waitFor(() => {
        const coderCard = screen.getByText('Coder').closest('div');
        expect(within(coderCard!).getByText(/idle/i)).toBeInTheDocument();
      });
    });
  });

  describe('Current Task Display', () => {
    it('shows current task for busy agents', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Implement feature X',
      };
      
      (window as any).clawdbot.db.tasks.get = vi.fn().mockResolvedValue(mockTask);
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Implement feature X')).toBeInTheDocument();
      });
    });

    it('shows no current task for idle agents', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        const writerCard = screen.getByText('Writer').closest('div');
        expect(within(writerCard!).getByText(/no current task/i)).toBeInTheDocument();
      });
    });

    it('links to current task detail', async () => {
      const user = userEvent.setup();
      const mockTask = {
        id: 'task-1',
        title: 'Implement feature X',
      };
      
      (window as any).clawdbot.db.tasks.get = vi.fn().mockResolvedValue(mockTask);
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Implement feature X')).toBeInTheDocument();
      });
      
      const taskLink = screen.getByText('Implement feature X');
      await user.click(taskLink);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Agent Actions', () => {
    it('assigns task to idle agent', async () => {
      const user = userEvent.setup();
      const assignMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.gateway.send = assignMock;
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Writer')).toBeInTheDocument();
      });
      
      const writerCard = screen.getByText('Writer').closest('div');
      const assignButton = within(writerCard!).getByRole('button', { name: /assign task/i });
      
      await user.click(assignButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      // Select a task
      const taskSelect = screen.getByLabelText(/select task/i);
      await user.selectOptions(taskSelect, 'task-1');
      
      const confirmButton = screen.getByRole('button', { name: /assign/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(assignMock).toHaveBeenCalled();
      });
    });

    it('cannot assign task to busy agent', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const coderCard = screen.getByText('Coder').closest('div');
      const assignButton = within(coderCard!).queryByRole('button', { name: /assign task/i });
      
      expect(assignButton).toBeDisabled();
    });

    it('terminates agent session', async () => {
      const user = userEvent.setup();
      const terminateMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.gateway.terminateSession = terminateMock;
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Writer')).toBeInTheDocument();
      });
      
      const writerCard = screen.getByText('Writer').closest('div');
      const menuButton = within(writerCard!).getByRole('button', { name: /menu/i });
      
      await user.click(menuButton);
      
      const terminateOption = screen.getByText(/terminate/i);
      await user.click(terminateOption);
      
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(terminateMock).toHaveBeenCalled();
      });
    });

    it('views agent details', async () => {
      const user = userEvent.setup();
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const coderCard = screen.getByText('Coder');
      await user.click(coderCard);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/task history/i)).toBeInTheDocument();
        expect(screen.getByText(/performance metrics/i)).toBeInTheDocument();
      });
    });
  });

  describe('Agent Spawning', () => {
    it('spawns new agent instance', async () => {
      const user = userEvent.setup();
      const spawnMock = vi.fn().mockResolvedValue({
        id: 'session-new',
        label: 'coder-task-123',
      });
      (window as any).clawdbot.gateway.spawnAgent = spawnMock;
      
      render(<AgentPanel />);
      
      const spawnButton = screen.getByRole('button', { name: /spawn agent/i });
      await user.click(spawnButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const agentSelect = screen.getByLabelText(/agent type/i);
      await user.selectOptions(agentSelect, 'coder');
      
      const taskInput = screen.getByLabelText(/task/i);
      await user.type(taskInput, 'Build feature Y');
      
      const spawnConfirmButton = screen.getByRole('button', { name: /spawn/i });
      await user.click(spawnConfirmButton);
      
      await waitFor(() => {
        expect(spawnMock).toHaveBeenCalledWith(
          expect.objectContaining({
            agent: 'coder',
            task: 'Build feature Y',
          })
        );
      });
    });

    it('validates spawn parameters', async () => {
      const user = userEvent.setup();
      render(<AgentPanel />);
      
      const spawnButton = screen.getByRole('button', { name: /spawn agent/i });
      await user.click(spawnButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const spawnConfirmButton = screen.getByRole('button', { name: /spawn/i });
      await user.click(spawnConfirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/agent type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/task is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Agent Metrics', () => {
    it('displays performance metrics', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const coderCard = screen.getByText('Coder').closest('div');
      
      expect(within(coderCard!).getByText(/15/)).toBeInTheDocument(); // tasks completed
      expect(within(coderCard!).getByText(/120s/)).toBeInTheDocument(); // avg response time
    });

    it('shows agent utilization percentage', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const coderCard = screen.getByText('Coder').closest('div');
      const utilization = within(coderCard!).getByText(/%/);
      
      expect(utilization).toBeInTheDocument();
    });

    it('displays last active time', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Researcher')).toBeInTheDocument();
      });
      
      const researcherCard = screen.getByText('Researcher').closest('div');
      
      expect(within(researcherCard!).getByText(/1 hour ago/i)).toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    it('filters agents by status', async () => {
      const user = userEvent.setup();
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
        expect(screen.getByText('Writer')).toBeInTheDocument();
        expect(screen.getByText('Researcher')).toBeInTheDocument();
      });
      
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const idleFilter = screen.getByRole('checkbox', { name: /idle/i });
      await user.click(idleFilter);
      
      await waitFor(() => {
        expect(screen.getByText('Writer')).toBeInTheDocument();
        expect(screen.queryByText('Coder')).not.toBeInTheDocument();
        expect(screen.queryByText('Researcher')).not.toBeInTheDocument();
      });
    });

    it('sorts agents by name', async () => {
      const user = userEvent.setup();
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const sortButton = screen.getByRole('button', { name: /sort/i });
      await user.click(sortButton);
      
      const nameOption = screen.getByText(/name/i);
      await user.click(nameOption);
      
      await waitFor(() => {
        const agentCards = screen.getAllByTestId('agent-card');
        expect(agentCards[0]).toHaveTextContent('Coder');
        expect(agentCards[1]).toHaveTextContent('Researcher');
        expect(agentCards[2]).toHaveTextContent('Writer');
      });
    });

    it('sorts agents by tasks completed', async () => {
      const user = userEvent.setup();
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const sortButton = screen.getByRole('button', { name: /sort/i });
      await user.click(sortButton);
      
      const tasksOption = screen.getByText(/tasks completed/i);
      await user.click(tasksOption);
      
      await waitFor(() => {
        const agentCards = screen.getAllByTestId('agent-card');
        expect(agentCards[0]).toHaveTextContent('Researcher'); // 22 tasks
        expect(agentCards[1]).toHaveTextContent('Coder'); // 15 tasks
        expect(agentCards[2]).toHaveTextContent('Writer'); // 8 tasks
      });
    });
  });

  describe('Real-time Updates', () => {
    it('updates agent status on WebSocket message', async () => {
      const { rerender } = render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      // Simulate WebSocket update
      const event = new CustomEvent('agent-status-update', {
        detail: {
          agentId: 'coder',
          status: 'idle',
          currentTask: null,
        },
      });
      
      window.dispatchEvent(event);
      
      rerender(<AgentPanel />);
      
      await waitFor(() => {
        const coderCard = screen.getByText('Coder').closest('div');
        expect(within(coderCard!).getByText(/idle/i)).toBeInTheDocument();
      });
    });

    it('shows notification when agent completes task', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      // Simulate task completion event
      const event = new CustomEvent('task-completed', {
        detail: {
          agentId: 'coder',
          taskId: 'task-1',
          taskTitle: 'Feature X',
        },
      });
      
      window.dispatchEvent(event);
      
      await waitFor(() => {
        expect(screen.getByText(/coder completed "feature x"/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when agents fail to load', async () => {
      const errorMock = vi.fn().mockRejectedValue(new Error('Database error'));
      (window as any).clawdbot.db.agents.list = errorMock;
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/error loading agents/i)).toBeInTheDocument();
      });
    });

    it('handles agent spawn failure gracefully', async () => {
      const user = userEvent.setup();
      const spawnMock = vi.fn().mockRejectedValue(new Error('Spawn failed'));
      (window as any).clawdbot.gateway.spawnAgent = spawnMock;
      
      render(<AgentPanel />);
      
      const spawnButton = screen.getByRole('button', { name: /spawn agent/i });
      await user.click(spawnButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const agentSelect = screen.getByLabelText(/agent type/i);
      await user.selectOptions(agentSelect, 'coder');
      
      const taskInput = screen.getByLabelText(/task/i);
      await user.type(taskInput, 'Build feature Y');
      
      const spawnConfirmButton = screen.getByRole('button', { name: /spawn/i });
      await user.click(spawnConfirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to spawn agent/i)).toBeInTheDocument();
      });
    });

    it('retries on network error', async () => {
      const listMock = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockAgents);
      
      (window as any).clawdbot.db.agents.list = listMock;
      
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
      
      const user = userEvent.setup();
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(listMock).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/agent list/i)).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const coderCard = screen.getByText('Coder').closest('button');
      coderCard?.focus();
      
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('announces status changes to screen readers', async () => {
      const { rerender } = render(<AgentPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Coder')).toBeInTheDocument();
      });
      
      const updatedAgents = [...mockAgents];
      updatedAgents[0].status = 'idle';
      
      (window as any).clawdbot.db.agents.list = vi.fn().mockResolvedValue(updatedAgents);
      
      rerender(<AgentPanel />);
      
      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/coder is now idle/i);
      });
    });
  });
});
