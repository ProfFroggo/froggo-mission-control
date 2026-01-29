/**
 * Error Boundary Test Component
 * 
 * Use this to test error boundaries in development.
 * Provides buttons to trigger different types of errors.
 */

import { useState } from 'react';
import ErrorBoundary from './ErrorBoundary';

type ErrorType = 
  | 'null-reference'
  | 'network-error'
  | 'timeout'
  | 'function-error'
  | 'infinite-loop'
  | 'websocket-error'
  | 'storage-error'
  | 'permission-error'
  | 'async-error';

interface ErrorGeneratorProps {
  type: ErrorType;
}

function ErrorGenerator({ type }: ErrorGeneratorProps) {
  const [triggerError, setTriggerError] = useState(false);

  if (triggerError) {
    switch (type) {
      case 'null-reference':
        // Simulate null reference error
        const obj: any = null;
        return <div>{obj.property.nested}</div>;

      case 'network-error':
        throw new Error('Network request failed: Unable to connect to server');

      case 'timeout':
        throw new Error('Request timeout: The operation took too long');

      case 'function-error':
        // Simulate calling something that's not a function
        const notAFunction: any = 'string';
        notAFunction();
        break;

      case 'infinite-loop':
        throw new Error('Maximum update depth exceeded. This can happen when a component calls setState inside useEffect');

      case 'websocket-error':
        throw new Error('WebSocket connection failed: Unable to establish real-time connection');

      case 'storage-error':
        throw new Error('localStorage quota exceeded: Not enough storage space');

      case 'permission-error':
        throw new Error('Permission denied: Microphone access not granted');

      case 'async-error':
        // This won't be caught by error boundary (async errors aren't caught)
        setTimeout(() => {
          throw new Error('Async error - this will not be caught by error boundary');
        }, 100);
        break;
    }
  }

  return (
    <button
      onClick={() => setTriggerError(true)}
      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
    >
      Trigger {type} Error
    </button>
  );
}

export function ErrorBoundaryTest() {
  const errorTypes: Array<{ type: ErrorType; label: string }> = [
    { type: 'null-reference', label: 'Null Reference' },
    { type: 'network-error', label: 'Network Error' },
    { type: 'timeout', label: 'Timeout Error' },
    { type: 'function-error', label: 'Function Error' },
    { type: 'infinite-loop', label: 'Infinite Loop' },
    { type: 'websocket-error', label: 'WebSocket Error' },
    { type: 'storage-error', label: 'Storage Error' },
    { type: 'permission-error', label: 'Permission Error' },
    { type: 'async-error', label: 'Async Error (not caught)' },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-clawd-surface rounded-lg border border-clawd-border p-6 space-y-4">
          <h2 className="text-2xl font-bold text-clawd-text">
            🧪 Error Boundary Test
          </h2>
          <p className="text-clawd-text-dim">
            Click any button below to trigger a test error and see how the error boundary handles it.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm text-clawd-text-dim">
              ⚠️ <strong>Note:</strong> Async errors cannot be caught by React error boundaries.
              They need to be caught with try/catch blocks in the component.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
            {errorTypes.map(({ type, label }) => (
              <div key={type}>
                <ErrorBoundary panelName={`Test: ${label}`}>
                  <div className="space-y-2">
                    <p className="text-xs text-clawd-text-dim font-medium">{label}</p>
                    <ErrorGenerator type={type} />
                  </div>
                </ErrorBoundary>
              </div>
            ))}
          </div>
        </div>

        {/* Test nested error boundaries */}
        <div className="mt-6 bg-clawd-surface rounded-lg border border-clawd-border p-6 space-y-4">
          <h3 className="text-xl font-semibold text-clawd-text">
            🎯 Nested Error Boundary Test
          </h3>
          <p className="text-clawd-text-dim">
            This tests that only the inner component fails, not the whole panel.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">
                ✅ Safe Component
              </h4>
              <p className="text-sm text-clawd-text-dim">
                This component is working fine!
              </p>
            </div>

            <ErrorBoundary panelName="Nested Error Test">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">
                  💥 Failing Component
                </h4>
                <ErrorGenerator type="null-reference" />
              </div>
            </ErrorBoundary>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">
            📖 How Error Boundaries Work
          </h3>
          <ul className="space-y-2 text-sm text-clawd-text-dim">
            <li>✅ Catch errors during rendering</li>
            <li>✅ Catch errors in lifecycle methods</li>
            <li>✅ Catch errors in constructors</li>
            <li>✅ Show fallback UI instead of crashing</li>
            <li>❌ Cannot catch errors in event handlers (use try/catch)</li>
            <li>❌ Cannot catch errors in async code (use try/catch)</li>
            <li>❌ Cannot catch errors in server-side rendering</li>
            <li>❌ Cannot catch errors in the error boundary itself</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundaryTest;
