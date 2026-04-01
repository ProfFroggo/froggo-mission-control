import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Bug, XCircle } from 'lucide-react';
import { Button, Box, Flex, Text, Heading } from '@radix-ui/themes';
import { createLogger } from '../utils/logger';
import { showToast } from './Toast';

const logger = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
  panelName?: string; // Alias for componentName (used in App.tsx)
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component for crash protection
 * Catches JavaScript errors anywhere in child component tree
 * and displays a fallback UI instead of crashing the app
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    logger.error('Caught error:', error);
    logger.error('Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Report to any error tracking service
    this.reportError(error, errorInfo);
  }

  private getComponentName(): string {
    return this.props.componentName || this.props.panelName || 'Unknown';
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    logger.error('Component:', this.getComponentName());
    logger.error('Error:', error.message);
    logger.error('Stack:', error.stack);
    logger.error('Component Stack:', errorInfo.componentStack);

    // Could integrate with Sentry, LogRocket, etc. here
    // Example: Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  private handleRetry = () => {
    // Reset error state to attempt re-render
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReportError = () => {
    // Copy error details to clipboard for reporting
    const errorDetails = `
Component: ${this.getComponentName()}
Error: ${this.state.error?.message}
Stack: ${this.state.error?.stack}
Time: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      showToast('success', 'Error Details Copied', 'Please share with the development team.');
    }).catch((err) => {
      logger.error('Failed to copy error details to clipboard:', err);
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Flex align="center" justify="center" p="5" height="100%" className="bg-mission-control-bg">
          <Box className="max-w-md w-full bg-mission-control-surface rounded-2xl border border-error/30 shadow-xl" p="5">
            {/* Icon and Title */}
            <Flex align="center" gap="3" mb="4">
              <Box p="3" className="bg-error/10 rounded-lg">
                <AlertTriangle size={28} className="text-error" />
              </Box>
              <Box>
                <Heading size="4" as="h2" className="text-mission-control-text">
                  Something went wrong
                </Heading>
                {this.getComponentName() !== 'Unknown' && (
                  <Text size="2" className="text-mission-control-text-dim">
                    in {this.getComponentName()}
                  </Text>
                )}
              </Box>
            </Flex>

            {/* Error Message */}
            <Box mb="5">
              <Text size="2" className="text-mission-control-text-dim" as="p" mb="2">
                An error occurred while rendering this component. Don&apos;t worry - your data is safe.
              </Text>
              {this.state.error && (
                <Box p="3" className="bg-mission-control-bg rounded-lg border border-mission-control-border">
                  <code className="text-xs text-error font-mono break-all">
                    {this.state.error.message}
                  </code>
                </Box>
              )}
            </Box>

            {/* Action Buttons */}
            <Flex direction="column" gap="2">
              <Button
                onClick={this.handleRetry}
                variant="solid"
                color="violet"
                size="3"
                className="w-full"
              >
                <RefreshCw size={18} />
                Try Again
              </Button>

              <Flex gap="2">
                <Button
                  onClick={this.handleReportError}
                  variant="surface"
                  color="gray"
                  size="2"
                  className="flex-1"
                >
                  <Bug size={16} />
                  Report Error
                </Button>

                <Button
                  onClick={() => window.location.reload()}
                  variant="surface"
                  color="gray"
                  size="2"
                  className="flex-1"
                >
                  <XCircle size={16} />
                  Reload App
                </Button>
              </Flex>
            </Flex>

            {/* Technical Details (collapsible) */}
            {this.state.errorInfo && (
              <details className="mt-4">
                <summary className="text-xs text-mission-control-text-dim cursor-pointer hover:text-mission-control-text transition-colors">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-mission-control-text-dim bg-mission-control-bg p-3 rounded-lg overflow-auto max-h-40 font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </Box>
        </Flex>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || Component.displayName || Component.name || 'Component';
  
  function ErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary componentName={displayName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  }
  
  ErrorBoundaryWrapper.displayName = `withErrorBoundary(${displayName})`;
  return ErrorBoundaryWrapper;
}

export default ErrorBoundary;
