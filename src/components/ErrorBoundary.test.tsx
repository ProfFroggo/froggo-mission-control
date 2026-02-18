/**
 * Tests for ErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ErrorBoundary, { withErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to prevent test output pollution
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error catching', () => {
    it('should catch errors in child components', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
    });

    it('should show component name in error display', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary componentName="TestComponent">
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('in TestComponent')).toBeInTheDocument();
      });
    });

    it('should use panelName as alias for componentName', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary panelName="TestPanel">
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('in TestPanel')).toBeInTheDocument();
      });
    });

    it('should render children when no error', () => {
      const WorkingComponent = () => <div>Working content</div>;

      render(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Working content')).toBeInTheDocument();
    });

    it('should show error message in fallback', async () => {
      const ThrowError = () => {
        throw new Error('Specific error message');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Specific error message')).toBeInTheDocument();
      });
    });

    it('should handle errors without messages', async () => {
      const ThrowError = () => {
        throw {};
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
    });
  });

  describe('retry functionality', () => {
    it('should have retry button and recover on retry', async () => {
      let shouldThrow = true;
      const ThrowError = () => {
        if (shouldThrow) throw new Error('Test');
        return <div>Recovered!</div>;
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      // Retry button should exist
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

      // Set shouldThrow to false and retry
      shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => {
        expect(screen.getByText('Recovered!')).toBeInTheDocument();
      });
    });
  });

  describe('error reporting', () => {
    it('should have report error button', async () => {
      const ThrowError = () => {
        throw new Error('Test error for reporting');
      };

      // Mock clipboard (not available in jsdom by default)
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /report error/i })).toBeInTheDocument();
      });

      const reportButton = screen.getByRole('button', { name: /report error/i });
      fireEvent.click(reportButton);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });

    it('should handle clipboard write failure', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      // Mock clipboard failure
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        const reportButton = screen.getByRole('button', { name: /report error/i });
        fireEvent.click(reportButton);
      });

      // Should not throw
      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });
  });

  describe('reload functionality', () => {
    it('should have reload app button', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      // Mock location.reload (jsdom doesn't allow spying on it directly)
      const originalLocation = window.location;
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, reload: reloadMock },
        writable: true,
        configurable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument();
      });

      const reloadButton = screen.getByRole('button', { name: /reload app/i });
      fireEvent.click(reloadButton);

      expect(reloadMock).toHaveBeenCalled();

      // Restore
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('technical details', () => {
    it('should show technical details section', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Technical Details')).toBeInTheDocument();
      });

      // Details element should exist
      const details = screen.getByText('Technical Details').closest('details');
      expect(details).toBeInTheDocument();
    });

    it('should contain error info in technical details', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Technical Details')).toBeInTheDocument();
      });

      // The details element should have a pre element inside
      const details = screen.getByText('Technical Details').closest('details');
      const preElement = details?.querySelector('pre');
      expect(preElement).toBeInTheDocument();
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback when provided', async () => {
      const ThrowError = () => {
        throw new Error('Test');
      };

      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      });

      // Should not show default error UI
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('onError callback', () => {
    it('should call onError when error is caught', async () => {
      const onError = vi.fn();
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });
  });
});

describe('withErrorBoundary HOC', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should wrap component with ErrorBoundary', () => {
    const TestComponent = () => <div>Test</div>;
    const WrappedComponent = withErrorBoundary(TestComponent, 'TestComponent');

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('should render wrapped component normally', () => {
    const TestComponent = () => <div>Wrapped Component</div>;
    const WrappedComponent = withErrorBoundary(TestComponent, 'Wrapped');

    render(<WrappedComponent />);

    expect(screen.getByText('Wrapped Component')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', async () => {
    const ThrowError = () => {
      throw new Error('Wrapped error');
    };
    const WrappedComponent = withErrorBoundary(ThrowError, 'ThrowComponent');

    render(<WrappedComponent />);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('in ThrowComponent')).toBeInTheDocument();
    });
  });

  it('should infer display name from component', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'CustomDisplayName';

    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toContain('CustomDisplayName');
  });

  it('should use component name if no display name', () => {
    function NamedComponent() {
      return <div>Test</div>;
    }

    const WrappedComponent = withErrorBoundary(NamedComponent);

    expect(WrappedComponent.displayName).toContain('NamedComponent');
  });

  it('should pass through props', async () => {
    interface Props {
      testProp: string;
    }

    const TestComponent = ({ testProp }: Props) => <div>Prop: {testProp}</div>;
    const WrappedComponent = withErrorBoundary(TestComponent, 'Test');

    render(<WrappedComponent testProp="hello" />);

    expect(screen.getByText('Prop: hello')).toBeInTheDocument();
  });
});
