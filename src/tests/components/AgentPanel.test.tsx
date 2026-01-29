import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentPanel from '../../components/AgentPanel';

const mockAgents = [
  {
    id: 'coder',
    name: 'Coder',
    emoji: '💻',
    status: 'active',
    currentTask: 'task-1',
    capabilities: ['code', 'debug', 'test'],
  },
  {
    id: 'writer',
    name: 'Writer',
    emoji: '✍️',
    status: 'idle',
    capabilities: ['write', 'edit', 'social'],
  },
  {
    id: 'researcher',
    name: 'Researcher',
    emoji: '🔍',
    status: 'busy',
    currentTask: 'task-2',
    capabilities: ['research', 'analyze'],
  },
];

describe('AgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).clawdbot.db.agents.list = vi.fn().mockResolvedValue(mockAgents);
  });

  it('renders all agents', async () => {
    render(<AgentPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Coder')).toBeInTheDocument();
      expect(screen.getByText('Writer')).toBeInTheDocument();
      expect(screen.getByText('Researcher')).toBeInTheDocument();
    });
  });

  it('displays agent status correctly', async () => {
    render(<AgentPanel />);
    
    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/idle/i)).toBeInTheDocument();
      expect(screen.getByText(/busy/i)).toBeInTheDocument();
    });
  });

  it('shows agent capabilities', async () => {
    render(<AgentPanel />);
    
    await waitFor(() => {
      expect(screen.getByText(/code/i)).toBeInTheDocument();
      expect(screen.getByText(/write/i)).toBeInTheDocument();
      expect(screen.getByText(/research/i)).toBeInTheDocument();
    });
  });

  it('opens agent detail modal on click', async () => {
    const user = userEvent.setup();
    render(<AgentPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Coder')).toBeInTheDocument();
    });

    const agentCard = screen.getByText('Coder').closest('div');
    await user.click(agentCard!);
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('spawns agent for task', async () => {
    const user = userEvent.setup();
    const spawnMock = vi.fn().mockResolvedValue({ sessionKey: 'session-1' });
    (window as any).clawdbot.gateway.spawnAgent = spawnMock;

    render(<AgentPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Coder')).toBeInTheDocument();
    });

    const spawnButton = screen.getByRole('button', { name: /spawn/i });
    await user.click(spawnButton);
    
    await waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });
  });

  it('displays agent metrics', async () => {
    render(<AgentPanel />);
    
    await waitFor(() => {
      // Check for metrics like tasks completed, success rate, etc.
      expect(screen.getByText(/Tasks Completed/i)).toBeInTheDocument();
    });
  });

  it('compares multiple agents', async () => {
    const user = userEvent.setup();
    render(<AgentPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Coder')).toBeInTheDocument();
    });

    const compareButton = screen.getByRole('button', { name: /compare/i });
    await user.click(compareButton);
    
    // Select agents to compare
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    
    await waitFor(() => {
      expect(screen.getByText(/Comparison/i)).toBeInTheDocument();
    });
  });
});
