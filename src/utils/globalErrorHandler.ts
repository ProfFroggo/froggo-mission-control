/**
 * Global error handler for uncaught errors and promise rejections
 */

import { getErrorInfo } from './errorMessages';
import { showToast } from '../components/Toast';

interface ErrorLog {
  timestamp: number;
  type: 'error' | 'promise';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  userAgent: string;
}

const errorLogs: ErrorLog[] = [];
const MAX_ERROR_LOGS = 100;

/**
 * Log error for debugging and analytics
 */
function logError(log: ErrorLog) {
  errorLogs.push(log);
  if (errorLogs.length > MAX_ERROR_LOGS) {
    errorLogs.shift(); // Keep only recent errors
  }

  // In production, send to error tracking service
  if (import.meta.env.PROD) {
    // TODO: Send to Sentry, LogRocket, etc.
    console.error('[Production Error]', log);
  } else {
    console.error('[Global Error]', log);
  }
}

/**
 * Get recent error logs (for debugging)
 */
export function getErrorLogs(): ErrorLog[] {
  return [...errorLogs];
}

/**
 * Clear error logs
 */
export function clearErrorLogs() {
  errorLogs.length = 0;
}

/**
 * Handle window.onerror events
 */
function handleWindowError(
  message: Event | string,
  source?: string,
  line?: number,
  column?: number,
  error?: Error
) {
  const errorLog: ErrorLog = {
    timestamp: Date.now(),
    type: 'error',
    message: typeof message === 'string' ? message : error?.message || 'Unknown error',
    stack: error?.stack,
    url: source,
    line,
    column,
    userAgent: navigator.userAgent,
  };

  logError(errorLog);

  // Show user-friendly toast
  if (error) {
    const errorInfo = getErrorInfo(error, {
      action: 'perform this action',
    });
    showToast('error', errorInfo.title, errorInfo.message, 7000);
  } else {
    showToast('error', 'Something went wrong', 'An unexpected error occurred.', 7000);
  }

  // Don't prevent default error handling
  return false;
}

/**
 * Handle unhandledrejection events (Promise rejections)
 */
function handleUnhandledRejection(event: PromiseRejectionEvent) {
  const error = event.reason;

  const errorLog: ErrorLog = {
    timestamp: Date.now(),
    type: 'promise',
    message: error?.message || error?.toString() || 'Unhandled promise rejection',
    stack: error?.stack,
    userAgent: navigator.userAgent,
  };

  logError(errorLog);

  // Show user-friendly toast
  const errorInfo = getErrorInfo(error, {
    action: 'complete this operation',
  });
  showToast('error', errorInfo.title, errorInfo.message, 7000);

  // Prevent unhandled rejection warning
  event.preventDefault();
}

/**
 * Initialize global error handlers
 */
export function initializeGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  // Remove existing handlers to avoid duplicates
  window.removeEventListener('error', handleWindowError as any);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  // Add error handlers
  window.addEventListener('error', handleWindowError as any);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  if (import.meta.env.DEV) {
    // Global error handler initialized
  }
}

/**
 * Cleanup global error handlers
 */
export function cleanupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.removeEventListener('error', handleWindowError as any);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  if (import.meta.env.DEV) {
    console.log('[GlobalErrorHandler] Cleaned up');
  }
}
