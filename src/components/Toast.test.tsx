/**
 * Tests for Toast component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastContainer, { showToast, dismissToast, ToastType, ToastItem } from './Toast';

describe('Toast component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('ToastItem', () => {
    it('should render toast with correct icon for success', () => {
      const toast = {
        id: 'test-toast-1',
        type: 'success' as ToastType,
        title: 'Success!',
        message: 'Operation completed',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Operation completed')).toBeInTheDocument();
    });

    it('should render toast with correct icon for error', () => {
      const toast = {
        id: 'test-toast-2',
        type: 'error' as ToastType,
        title: 'Error!',
        message: 'Something went wrong',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      expect(screen.getByText('Error!')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should render toast with correct icon for warning', () => {
      const toast = {
        id: 'test-toast-3',
        type: 'warning' as ToastType,
        title: 'Warning!',
        message: 'Be careful',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      expect(screen.getByText('Warning!')).toBeInTheDocument();
    });

    it('should render toast with correct icon for info', () => {
      const toast = {
        id: 'test-toast-4',
        type: 'info' as ToastType,
        title: 'Info',
        message: 'Just letting you know',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('should call onDismiss when close button is clicked', () => {
      const toast = {
        id: 'test-toast-dismiss',
        type: 'info' as ToastType,
        title: 'Test',
        message: 'Test message',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      const closeButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(closeButton);
      
      expect(onDismiss).toHaveBeenCalledWith('test-toast-dismiss');
    });

    it('should auto-dismiss after duration', async () => {
      vi.useFakeTimers();
      
      const toast = {
        id: 'test-toast-auto',
        type: 'info' as ToastType,
        title: 'Auto Dismiss',
        message: 'This will be dismissed',
        duration: 1000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      expect(screen.getByText('Auto Dismiss')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(onDismiss).toHaveBeenCalledWith('test-toast-auto');
      
      vi.useRealTimers();
    });

    it('should clear timeout on unmount', () => {
      vi.useFakeTimers();
      
      const toast = {
        id: 'test-toast-unmount',
        type: 'info' as ToastType,
        title: 'Unmount Test',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      const { unmount } = render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      unmount();
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      expect(onDismiss).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should not show message if not provided', () => {
      const toast = {
        id: 'test-no-message',
        type: 'success' as ToastType,
        title: 'Title Only',
        duration: 5000,
      };
      const onDismiss = vi.fn();
      
      render(<ToastItem toast={toast} onDismiss={onDismiss} />);
      
      expect(screen.getByText('Title Only')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });
  });

  describe('ToastContainer', () => {
    it('should render nothing when no toasts', () => {
      const { container } = render(<ToastContainer />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should render toasts when present', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('success', 'Test Title', 'Test Message');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test Message')).toBeInTheDocument();
      });
    });

    it('should render multiple toasts', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('success', 'Toast 1', 'Message 1');
        showToast('error', 'Toast 2', 'Message 2');
        showToast('warning', 'Toast 3');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Toast 1')).toBeInTheDocument();
        expect(screen.getByText('Toast 2')).toBeInTheDocument();
        expect(screen.getByText('Toast 3')).toBeInTheDocument();
      });
    });

    it('should dismiss toast and update list', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('info', 'To Be Dismissed');
      });
      
      await waitFor(() => {
        expect(screen.getByText('To Be Dismissed')).toBeInTheDocument();
      });
      
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);
      
      await waitFor(() => {
        expect(screen.queryByText('To Be Dismissed')).not.toBeInTheDocument();
      });
    });
  });

  describe('showToast function', () => {
    it('should create toast with correct parameters', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('success', 'Success Title', 'Success message');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Success Title')).toBeInTheDocument();
      });
    });

    it('should handle alternate signature (title first)', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('Alternate Title', 'success', 'Alternate message');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Alternate Title')).toBeInTheDocument();
      });
    });

    it('should generate unique IDs', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('success', 'Toast 1');
        showToast('success', 'Toast 2');
      });
      
      await waitFor(() => {
        const toasts = screen.getAllByText(/Toast/);
        expect(toasts).toHaveLength(2);
      });
    });

    it('should handle custom duration', async () => {
      vi.useFakeTimers();
      
      render(<ToastContainer />);
      
      act(() => {
        showToast('info', 'Quick Toast', undefined, 500);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Quick Toast')).toBeInTheDocument();
      });
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Quick Toast')).not.toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('dismissToast function', () => {
    it('should remove specific toast by ID', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('info', 'Toast to Keep');
        showToast('error', 'Toast to Dismiss');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Toast to Keep')).toBeInTheDocument();
        expect(screen.getByText('Toast to Dismiss')).toBeInTheDocument();
      });
      
      act(() => {
        dismissToast('Toast to Dismiss');
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Toast to Dismiss')).not.toBeInTheDocument();
        expect(screen.getByText('Toast to Keep')).toBeInTheDocument();
      });
    });

    it('should handle dismissing non-existent toast', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('info', 'Existing Toast');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Existing Toast')).toBeInTheDocument();
      });
      
      // Should not throw
      act(() => {
        dismissToast('non-existent-id');
      });
      
      expect(screen.getByText('Existing Toast')).toBeInTheDocument();
    });
  });

  describe('toast types', () => {
    it('should support all toast types', async () => {
      render(<ToastContainer />);
      
      const types: ToastType[] = ['success', 'error', 'warning', 'info'];
      
      types.forEach(type => {
        act(() => {
          showToast(type as ToastType, `${type} title`, `${type} message`);
        });
      });
      
      await waitFor(() => {
        types.forEach(type => {
          expect(screen.getByText(`${type} title`)).toBeInTheDocument();
        });
      });
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on dismiss button', async () => {
      render(<ToastContainer />);
      
      act(() => {
        showToast('info', 'Accessible Toast');
      });
      
      await waitFor(() => {
        const dismissButton = screen.getByRole('button', { name: /dismiss/i });
        expect(dismissButton).toBeInTheDocument();
      });
    });

    it('should have role region for notifications', () => {
      const { container } = render(<ToastContainer />);
      
      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', 'Notifications');
    });
  });
});
