/**
 * Tests for Toast component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ToastContainer, { showToast, dismissToast, ToastType, _resetToasts } from './Toast';

describe('Toast component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetToasts();
  });

  afterEach(() => {
    _resetToasts();
  });

  describe('ToastItem rendering', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should render toast with correct text for success', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('success', 'Success!', 'Operation completed');
      });

      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Operation completed')).toBeInTheDocument();
    });

    it('should render toast with correct text for error', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('error', 'Error!', 'Something went wrong');
      });

      expect(screen.getByText('Error!')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should render toast with correct text for warning', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('warning', 'Warning!', 'Be careful');
      });

      expect(screen.getByText('Warning!')).toBeInTheDocument();
    });

    it('should render toast with correct text for info', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Info', 'Just letting you know');
      });

      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('should call dismiss when close button is clicked', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Test Dismiss');
      });

      const closeButton = screen.getByRole('button', { name: /dismiss/i });
      act(() => {
        fireEvent.click(closeButton);
      });

      expect(screen.queryByText('Test Dismiss')).not.toBeInTheDocument();
    });

    it('should auto-dismiss after duration', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Auto Dismiss', undefined, 1000);
      });

      expect(screen.getByText('Auto Dismiss')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText('Auto Dismiss')).not.toBeInTheDocument();
    });

    it('should not show message if not provided', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('success', 'Title Only');
      });

      expect(screen.getByText('Title Only')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });
  });

  describe('ToastContainer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should render nothing when no toasts', () => {
      const { container } = render(<ToastContainer />);

      expect(container.firstChild).toBeNull();
    });

    it('should render toasts when present', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('success', 'Test Title', 'Test Message');
      });

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Message')).toBeInTheDocument();
    });

    it('should render multiple toasts', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('success', 'Toast 1', 'Message 1');
        showToast('error', 'Toast 2', 'Message 2');
        showToast('warning', 'Toast 3');
      });

      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
      expect(screen.getByText('Toast 3')).toBeInTheDocument();
    });

    it('should dismiss toast and update list', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'To Be Dismissed');
      });

      expect(screen.getByText('To Be Dismissed')).toBeInTheDocument();

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      act(() => {
        fireEvent.click(dismissButton);
      });

      expect(screen.queryByText('To Be Dismissed')).not.toBeInTheDocument();
    });
  });

  describe('showToast function', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create toast with correct parameters', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('success', 'Success Title', 'Success message');
      });

      expect(screen.getByText('Success Title')).toBeInTheDocument();
    });

    it('should handle alternate signature (title first)', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('Alternate Title', 'success', 'Alternate message');
      });

      expect(screen.getByText('Alternate Title')).toBeInTheDocument();
    });

    it('should generate unique IDs', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('success', 'Toast 1');
        showToast('success', 'Toast 2');
      });

      const toasts = screen.getAllByText(/Toast/);
      expect(toasts).toHaveLength(2);
    });

    it('should handle custom duration', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Quick Toast', undefined, 500);
      });

      expect(screen.getByText('Quick Toast')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByText('Quick Toast')).not.toBeInTheDocument();
    });
  });

  describe('dismissToast function', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle dismissing non-existent toast', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Existing Toast');
      });

      expect(screen.getByText('Existing Toast')).toBeInTheDocument();

      // Should not throw
      act(() => {
        dismissToast('non-existent-id');
      });

      expect(screen.getByText('Existing Toast')).toBeInTheDocument();
    });
  });

  describe('toast types', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should support all toast types', () => {
      render(<ToastContainer />);

      const types: ToastType[] = ['success', 'error', 'warning', 'info'];

      act(() => {
        types.forEach(type => {
          showToast(type, `${type} title`, `${type} message`);
        });
      });

      types.forEach(type => {
        expect(screen.getByText(`${type} title`)).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should have aria-label on dismiss button', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Accessible Toast');
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('should have role region for notifications', () => {
      render(<ToastContainer />);

      act(() => {
        showToast('info', 'Region Test');
      });

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Notifications');
    });
  });
});
