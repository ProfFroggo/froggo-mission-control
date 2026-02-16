<<<<<<< HEAD
/**
 * ErrorBoundary - Global error boundary to catch React errors
 * Provides graceful degradation and error recovery with smart error detection
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Network, Clock, Code, Database, Lock, Wifi } from 'lucide-react';
import { LoadingButton } from './LoadingStates';
=======
import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Bug, XCircle } from 'lucide-react';
>>>>>>> 8214873 (feat: add error boundaries for crash protection [P1])

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
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

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
    // Log to console for development
    console.group('🚨 Error Boundary Report');
    console.log('Component:', this.getComponentName());
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    console.log('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

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

<<<<<<< HEAD
    // Copy to clipboard
    navigator.clipboard.writeText(bugReport);
    alert('Bug report copied to clipboard! Please send it to the support team.');
=======
    navigator.clipboard.writeText(errorDetails).then(() => {
      // Show feedback - using alert for simplicity as toast might not be available in error state
      alert('Error details copied to clipboard. Please share with the development team.');
    }).catch(() => {
      console.error('[ErrorBoundary] Failed to copy error details');
    });
>>>>>>> 8214873 (feat: add error boundaries for crash protection [P1])
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="h-full flex items-center justify-center p-6 bg-clawd-bg">
          <div className="max-w-md w-full bg-clawd-surface rounded-2xl border border-error-border p-6 shadow-xl">
            {/* Icon and Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-error-subtle rounded-xl">
                <AlertTriangle size={28} className="text-error" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-clawd-text">
                  Something went wrong
                </h2>
                {this.getComponentName() !== 'Unknown' && (
                  <p className="text-sm text-clawd-text-dim">
                    in {this.getComponentName()}
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            <div className="mb-6">
              <p className="text-sm text-clawd-text-dim mb-2">
                An error occurred while rendering this component. Don&apos;t worry - your data is safe.
              </p>
              {this.state.error && (
                <div className="bg-clawd-bg rounded-lg p-3 border border-clawd-border">
                  <code className="text-xs text-error font-mono break-all">
                    {this.state.error.message}
                  </code>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors font-medium"
              >
                <RefreshCw size={18} />
                Try Again
              </button>

              <div className="flex gap-2">
                <button
                  onClick={this.handleReportError}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-clawd-bg border border-clawd-border text-clawd-text rounded-xl hover:bg-clawd-border transition-colors text-sm"
                >
                  <Bug size={16} />
                  Report Error
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-clawd-bg border border-clawd-border text-clawd-text rounded-xl hover:bg-clawd-border transition-colors text-sm"
                >
                  <XCircle size={16} />
                  Reload App
                </button>
              </div>
            </div>

            {/* Technical Details (collapsible) */}
            {this.state.errorInfo && (
              <details className="mt-4">
                <summary className="text-xs text-clawd-text-dim cursor-pointer hover:text-clawd-text transition-colors">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-clawd-text-dim bg-clawd-bg p-3 rounded-lg overflow-auto max-h-40 font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
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
