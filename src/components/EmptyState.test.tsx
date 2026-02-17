/**
 * Tests for EmptyState component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from './EmptyState';
import { LucideIcon, Inbox, Search } from 'lucide-react';

describe('EmptyState', () => {
  describe('preset types', () => {
    it('should render inbox preset correctly', () => {
      render(<EmptyState type="inbox" />);
      
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByText('Your inbox is empty. New messages will appear here.')).toBeInTheDocument();
    });

    it('should render tasks preset correctly', () => {
      render(<EmptyState type="tasks" />);
      
      expect(screen.getByText("You don't have any tasks assigned. New tasks will appear here.")).toBeInTheDocument();
    });

    it('should render search preset correctly', () => {
      render(<EmptyState type="search" />);
      
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('should render files preset correctly', () => {
      render(<EmptyState type="files" />);
      
      expect(screen.getByText('Your library is empty. Upload files to see them here.')).toBeInTheDocument();
    });

    it('should render notifications preset correctly', () => {
      render(<EmptyState type="notifications" />);
      
      expect(screen.getByText("You're all caught up! New notifications will appear here.")).toBeInTheDocument();
    });

    it('should render kanban preset correctly', () => {
      render(<EmptyState type="kanban" />);
      
      expect(screen.getByText('This column is empty. Drag items here or create new ones.')).toBeInTheDocument();
    });

    it('should render finance preset correctly', () => {
      render(<EmptyState type="finance" />);
      
      expect(screen.getByText('Your transaction history is empty. Transactions will appear here.')).toBeInTheDocument();
    });

    it('should render generic preset correctly', () => {
      render(<EmptyState type="generic" />);
      
      expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    });
  });

  describe('custom icon and text', () => {
    it('should render custom icon and title', () => {
      const MockIcon: LucideIcon = (props: any) => <svg {...props} data-testid="custom-icon" />;
      
      render(
        <EmptyState
          icon={MockIcon}
          title="Custom Title"
          description="Custom description"
        />
      );
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom description')).toBeInTheDocument();
    });

    it('should use Inbox icon when passed as icon prop', () => {
      render(
        <EmptyState
          icon={Inbox}
          title="Custom Title"
        />
      );
      
      // Check that an icon is rendered (Inbox component)
      const icon = screen.getByRole('img', { hidden: true });
      expect(icon).toBeInTheDocument();
    });
  });

  describe('action button', () => {
    it('should render action button with label and onClick', () => {
      const handleClick = vi.fn();
      
      render(
        <EmptyState
          type="inbox"
          action={{ label: 'Click Me', onClick: handleClick }}
        />
      );
      
      const button = screen.getByRole('button', { name: 'Click Me' });
      expect(button).toBeInTheDocument();
      
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should render secondary variant button', () => {
      render(
        <EmptyState
          type="inbox"
          action={{ label: 'Secondary', onClick: vi.fn(), variant: 'secondary' }}
        />
      );
      
      const button = screen.getByRole('button', { name: 'Secondary' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-clawd-border');
    });

    it('should render primary variant button by default', () => {
      render(
        <EmptyState
          type="inbox"
          action={{ label: 'Primary', onClick: vi.fn() }}
        />
      );
      
      const button = screen.getByRole('button', { name: 'Primary' });
      expect(button).toHaveClass('bg-clawd-accent');
    });

    it('should render React element as action', () => {
      const customElement = <button data-testid="custom-button">Custom</button>;
      
      render(
        <EmptyState
          type="inbox"
          action={customElement}
        />
      );
      
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });

    it('should not render action when not provided', () => {
      render(<EmptyState type="inbox" />);
      
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('description override', () => {
    it('should override preset description when provided', () => {
      render(
        <EmptyState
          type="inbox"
          description="Custom description override"
        />
      );
      
      expect(screen.getByText('Custom description override')).toBeInTheDocument();
      expect(screen.queryByText('Your inbox is empty.')).not.toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    it('should render compact classes when compact=true', () => {
      render(<EmptyState type="inbox" compact />);
      
      const container = screen.getByRole('status');
      expect(container).toHaveClass('py-8');
      expect(container).toHaveClass('px-4');
    });

    it('should not render compact classes when compact=false', () => {
      render(<EmptyState type="inbox" compact={false} />);
      
      const container = screen.getByRole('status');
      expect(container).not.toHaveClass('py-8');
      expect(container).toHaveClass('py-16');
    });
  });

  describe('accessibility', () => {
    it('should have role="status" for live region', () => {
      render(<EmptyState type="inbox" />);
      
      const container = screen.getByRole('status');
      expect(container).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      render(<EmptyState type="inbox" />);
      
      const container = screen.getByRole('status');
      expect(container).toHaveAttribute('aria-live', 'polite');
    });

    it('should hide icon from screen readers', () => {
      render(<EmptyState type="inbox" />);
      
      const icon = screen.getByRole('img', { hidden: true });
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<EmptyState type="inbox" className="custom-class" />);
      
      const container = screen.getByRole('status');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('EmptyStatePresets object', () => {
    it('should export preset configurations', () => {
      expect(EmptyStatePresets.inbox).toEqual({
        icon: 'Inbox',
        title: 'No messages yet',
        description: 'Your inbox is empty. New messages will appear here.'
      });
      
      expect(EmptyStatePresets.search).toEqual({
        icon: 'Search',
        title: 'No results found',
        description: "Try adjusting your search terms or filters to find what you're looking for."
      });
    });

    it('should have all expected presets', () => {
      const expectedPresets = ['inbox', 'tasks', 'search', 'library', 'notifications', 'kanban', 'finance', 'generic'];
      
      expectedPresets.forEach(preset => {
        expect(EmptyStatePresets[preset as keyof typeof EmptyStatePresets]).toBeDefined();
      });
    });
  });
});
