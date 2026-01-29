import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../../components/Dashboard';

describe('Dashboard Component', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with main sections', () => {
    render(<Dashboard onNavigate={mockNavigate} />);
    
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
  });

  it('displays quick stats widgets', async () => {
    render(<Dashboard onNavigate={mockNavigate} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Tasks/i)).toBeInTheDocument();
    });
  });

  it('shows calendar widget with today events', async () => {
    (window as any).clawdbot.gateway.send = vi.fn().mockResolvedValue({
      events: [
        {
          id: 'event-1',
          summary: 'Team Meeting',
          start: { dateTime: new Date().toISOString() },
          end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
        },
      ],
    });

    render(<Dashboard onNavigate={mockNavigate} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Team Meeting/i)).toBeInTheDocument();
    });
  });

  it('navigates to tasks when clicking quick action', async () => {
    const user = userEvent.setup();
    render(<Dashboard onNavigate={mockNavigate} />);
    
    const taskButton = screen.getByRole('button', { name: /view all tasks/i });
    await user.click(taskButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('kanban');
  });

  it('displays activity feed', async () => {
    render(<Dashboard onNavigate={mockNavigate} />);
    
    await waitFor(() => {
      const activitySection = screen.getByText(/Recent Activity/i);
      expect(activitySection).toBeInTheDocument();
    });
  });

  it('shows email widget with unread count', async () => {
    (window as any).clawdbot.gateway.send = vi.fn().mockResolvedValue({
      messages: [
        { id: '1', subject: 'Test Email', unread: true },
      ],
    });

    render(<Dashboard onNavigate={mockNavigate} />);
    
    await waitFor(() => {
      expect(screen.getByText(/1/i)).toBeInTheDocument();
    });
  });
});
