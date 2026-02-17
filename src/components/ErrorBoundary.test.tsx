/**
 * Tests for ErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ErrorBoundary, { withErrorBoundary } from './components/ErrorBoundary';

describe('ErrorBoundary', () => {
  const originalConsole = { ...console };
  
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
    it('should have retry button', async () => {
      let shouldThrow = true;
      const ThrowError = () => {
        if (shouldThrow) throw new Error('Test');
        return <div>Recovered!</div>;
      };
      
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
      
      // Click retry
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);
      
      // Should try to re-render (will still fail since shouldThrow is true)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      // Now set shouldThrow to false and retry again
      shouldThrow = false;
      fireEvent.click(retryButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        expect(screen.getByText('Recovered!')).toBeInTheDocument();
      });
    });
  });

  describe('error reporting', () => {
    it('should have report error button', async () => {
      const ThrowError = () => {
        throw new Error('Test error for reporting');
      };
      
      // Mock clipboard
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      
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
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });

    it('should handle clipboard write failure', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };
      
      // Mock clipboard failure
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      await waitFor(() => {
        const reportButton = screen.getByRole('button', { name: /report error/i });
        fireEvent.click(reportButton);
      });
      
      // Should not throw, just log error
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('reload functionality', () => {
    it('should have reload app button', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };
      
      // Mock location.reload
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      
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
      
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('technical details', () => {
    it('should show technical details when expanded', async () => {
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
      
      const details = screen.getByText('Technical Details').closest('details');
      expect(details).not.toHaveAttribute('open');
      
      fireEvent.click(details!);
      
      expect(details).toHaveAttribute('open');
    });

    it('should show component stack in technical details', async () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };
      
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      await waitFor(() => {
        const details = screen.getByText('Technical Details').closest('details');
        fireEvent.click(details!);
      });
      
      await waitFor(() => {
        const preElement = screen.getByText(/Technical Details/i).closest('details')?.querySelector('pre');
        expect(preElement).toBeInTheDocument();
      });
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
    
    const { container } = render(<WrappedComponent />);
    
    expect(container.getByText('Wrapped Component')).toBeInTheDocument();
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
