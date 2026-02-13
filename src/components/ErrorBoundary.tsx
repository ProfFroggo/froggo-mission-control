/**
 * ErrorBoundary - Global error boundary to catch React errors
 * Provides graceful degradation and error recovery with smart error detection
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Network, Clock, Code, Database, Lock, Wifi } from 'lucide-react';
import { LoadingButton } from './LoadingStates';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  panelName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

// Common error patterns and their user-friendly messages
interface ErrorPattern {
  test: RegExp;
  title: string;
  message: string;
  suggestion: string;
  icon: React.ReactNode;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    test: /Cannot read propert(y|ies) of (null|undefined)/i,
    title: 'Missing Data',
    message: 'Some expected data is not available yet.',
    suggestion: 'Try refreshing the page or waiting a moment for data to load.',
    icon: <Database size={32} className="text-orange-400" />
  },
  {
    test: /Network (request )?failed/i,
    title: 'Connection Problem',
    message: 'Unable to connect to the server.',
    suggestion: 'Check your internet connection and try again.',
    icon: <Network size={32} className="text-error" />
  },
  {
    test: /Failed to fetch/i,
    title: 'Network Error',
    message: 'Could not retrieve data from the server.',
    suggestion: 'The server might be down. Try again in a few moments.',
    icon: <Wifi size={32} className="text-error" />
  },
  {
    test: /timeout/i,
    title: 'Request Timeout',
    message: 'The request took too long to complete.',
    suggestion: 'The server might be slow. Try refreshing the page.',
    icon: <Clock size={32} className="text-warning" />
  },
  {
    test: /is not a function/i,
    title: 'Code Error',
    message: 'Something unexpected happened in the application.',
    suggestion: 'Try refreshing the page. If this persists, please report it.',
    icon: <Code size={32} className="text-review" />
  },
  {
    test: /Cannot access.*before initialization/i,
    title: 'Loading Error',
    message: 'A component tried to use data before it was ready.',
    suggestion: 'Refresh the page to restart the loading process.',
    icon: <RefreshCw size={32} className="text-info" />
  },
  {
    test: /Maximum update depth exceeded/i,
    title: 'Infinite Loop',
    message: 'A component got stuck in an update loop.',
    suggestion: 'Refresh the page. If this keeps happening, please report it.',
    icon: <AlertTriangle size={32} className="text-error" />
  },
  {
    test: /WebSocket/i,
    title: 'Connection Lost',
    message: 'Real-time connection to the server was interrupted.',
    suggestion: 'Check your connection and refresh the page.',
    icon: <Wifi size={32} className="text-orange-400" />
  },
  {
    test: /localStorage|sessionStorage/i,
    title: 'Storage Error',
    message: 'Unable to save or load local data.',
    suggestion: 'Check if you have enough storage space or try clearing browser cache.',
    icon: <Database size={32} className="text-warning" />
  },
  {
    test: /permission denied/i,
    title: 'Permission Denied',
    message: 'The app does not have permission to perform this action.',
    suggestion: 'Check your browser permissions and try again.',
    icon: <Lock size={32} className="text-error" />
  }
];

const getErrorDetails = (error: Error): ErrorPattern => {
  const errorMessage = error.message;
  
  // Try to match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test.test(errorMessage)) {
      return pattern;
    }
  }
  
  // Default fallback
  return {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    suggestion: 'Try refreshing the page. If the problem persists, please contact support.',
    test: /.*/,
    icon: <AlertTriangle size={32} className="text-error" />
  };
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log to external service (e.g., Sentry) in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Log to error tracking service
      console.error('Production error:', {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    const { error, errorInfo } = this.state;
    const bugReport = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}
    `.trim();

    // Copy to clipboard
    navigator.clipboard.writeText(bugReport);
    alert('Bug report copied to clipboard! Please send it to the support team.');
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const { error, errorInfo, errorCount } = this.state;
      const { panelName } = this.props;
      const isCritical = errorCount > 3;
      const errorDetails = error ? getErrorDetails(error) : null;
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-[300px] bg-clawd-bg flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                {errorDetails?.icon || <AlertTriangle size={40} className="text-error" />}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center text-clawd-text mb-2">
              {isCritical ? 'Critical Error' : errorDetails?.title || 'Something Went Wrong'}
            </h1>

            {/* Panel name if provided */}
            {panelName && (
              <p className="text-center text-clawd-text-dim mb-6 text-sm">
                in {panelName}
              </p>
            )}

            {/* User-friendly message */}
            <div className="bg-clawd-surface border border-clawd-border rounded-lg p-6 mb-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-clawd-text mb-2">
                  What happened?
                </h3>
                <p className="text-clawd-text-dim text-sm">
                  {isCritical
                    ? 'The application has encountered multiple errors. Please reload the page or contact support.'
                    : errorDetails?.message || 'An unexpected error occurred.'}
                </p>
              </div>

              {!isCritical && errorDetails && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-600 mb-2">
                    💡 What to try
                  </h3>
                  <p className="text-sm text-clawd-text-dim">
                    {errorDetails.suggestion}
                  </p>
                </div>
              )}
            </div>

            {/* Error details (dev mode or expanded) */}
            {error && (
              <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4 mb-6">
                {isDevelopment && (
                  <div className="mb-4">
                    <p className="text-sm font-mono text-error mb-2">
                      {error.toString()}
                    </p>
                    {errorInfo && (
                      <details className="text-xs text-clawd-text-dim">
                        <summary className="cursor-pointer hover:text-clawd-text font-medium mb-2">
                          🔧 Stack Trace (dev mode)
                        </summary>
                        <pre className="mt-2 overflow-auto max-h-64 whitespace-pre-wrap bg-error-subtle border border-red-500/20 rounded p-3 text-error">
                          {errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {!isCritical && (
                <LoadingButton
                  onClick={this.handleReset}
                  variant="primary"
                  icon={<RefreshCw size={16} />}
                  className="w-full"
                >
                  Try Again
                </LoadingButton>
              )}

              <LoadingButton
                onClick={this.handleReload}
                variant="secondary"
                icon={<RefreshCw size={16} />}
                className="w-full"
              >
                Reload Page
              </LoadingButton>

              <LoadingButton
                onClick={this.handleGoHome}
                variant="secondary"
                icon={<Home size={16} />}
                className="w-full"
              >
                Go to Home
              </LoadingButton>

              <LoadingButton
                onClick={this.handleReportBug}
                variant="ghost"
                icon={<Bug size={16} />}
                className="w-full"
              >
                Copy Error Report
              </LoadingButton>
            </div>

            {/* Error count warning */}
            {errorCount > 1 && (
              <div className="mt-4 text-center text-xs text-clawd-text-dim">
                {errorCount} errors occurred. If this continues, try restarting the app.
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to use error boundary imperatively
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}

/**
 * Higher-order component to wrap any component with an error boundary
 * Uses ErrorBoundary without a static fallback so the built-in error UI
 * with "Try Again" (reset) button is shown, allowing in-place recovery.
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary panelName={componentName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Default export
export default ErrorBoundary;
