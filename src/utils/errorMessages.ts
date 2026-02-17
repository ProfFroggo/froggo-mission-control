/**
 * User-friendly error messages and recovery suggestions
 * Converts technical errors into actionable messages for users
 */

interface ErrorContext {
  action?: string;
  resource?: string;
  technical?: string;
  taskId?: string;
  userId?: string;
}

/** Utility type for unknown errors with common properties */
interface AppError {
  message?: string;
  code?: string;
  status?: number;
  error?: string;
  details?: string;
  fields?: string;
}

/** Type guard to safely extract error properties */
function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      message: typeof err.message === 'string' ? err.message : undefined,
      code: typeof err.code === 'string' ? err.code : undefined,
      status: typeof err.status === 'number' ? err.status : undefined,
      error: typeof err.error === 'string' ? err.error : undefined,
      details: typeof err.details === 'string' ? err.details : undefined,
      fields: typeof err.fields === 'string' ? err.fields : undefined,
    };
  }
  return {};
}

export interface ErrorInfo {
  title: string;
  message: string;
  recoverable: boolean;
  recovery?: RecoveryAction[];
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

export interface RecoveryAction {
  label: string;
  action: 'retry' | 'refresh' | 'restart' | 'contact' | 'navigate' | 'custom';
  url?: string;
  customHandler?: () => void;
}

/**
 * Get comprehensive error information with recovery suggestions
 */
export function getErrorInfo(error: unknown, context?: ErrorContext): ErrorInfo {
  const err = toAppError(error);
  const action = context?.action || 'perform this action';
  const resource = context?.resource || 'data';

  // Network errors
  if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('ENOTFOUND')) {
    return {
      title: 'Connection Failed',
      message: `Unable to connect to the server. Please check your internet connection.`,
      recoverable: true,
      severity: 'error',
      code: 'NETWORK_ERROR',
      recovery: [
        { label: 'Try Again', action: 'retry' },
        { label: 'Check Network', action: 'custom' },
      ],
    };
  }

  // Timeout errors
  if (err.message?.includes('timeout') || err.code === 'ETIMEDOUT') {
    return {
      title: 'Request Timed Out',
      message: `This is taking longer than expected. The server might be busy.`,
      recoverable: true,
      severity: 'warning',
      code: 'TIMEOUT',
      recovery: [
        { label: 'Try Again', action: 'retry' },
        { label: 'Refresh Page', action: 'refresh' },
      ],
    };
  }

  // Permission errors
  if (err.message?.includes('permission') || err.code === 'EACCES' || err.status === 403) {
    return {
      title: 'Permission Denied',
      message: `You don't have permission to ${action}. Contact your administrator if you believe this is incorrect.`,
      recoverable: false,
      severity: 'error',
      code: 'PERMISSION_DENIED',
      recovery: [
        { label: 'Go Back', action: 'navigate', url: '/' },
        { label: 'Refresh', action: 'refresh' },
      ],
    };
  }

  // Not found errors
  if (err.message?.includes('not found') || err.code === 'ENOENT' || err.status === 404) {
    return {
      title: 'Not Found',
      message: `We couldn't find that ${resource}. It may have been moved or deleted.`,
      recoverable: false,
      severity: 'error',
      code: 'NOT_FOUND',
      recovery: [
        { label: 'Go Back', action: 'navigate', url: '/' },
        { label: 'Refresh', action: 'refresh' },
      ],
    };
  }

  // Server errors (5xx)
  if ((err.status ?? 0) >= 500 || err.message?.includes('server error')) {
    return {
      title: 'Server Error',
      message: `Our servers are having trouble right now. Our team has been notified.`,
      recoverable: true,
      severity: 'error',
      code: 'SERVER_ERROR',
      recovery: [
        { label: 'Try Again', action: 'retry' },
        { label: 'Check Status', action: 'navigate', url: '/status' },
      ],
    };
  }

  // Authentication errors
  if (err.status === 401 || err.message?.includes('unauthorized') || err.message?.includes('authentication')) {
    return {
      title: 'Authentication Required',
      message: `Your session has expired. Please sign in again.`,
      recoverable: true,
      severity: 'warning',
      code: 'AUTH_REQUIRED',
      recovery: [
        { label: 'Sign In', action: 'navigate', url: '/login' },
        { label: 'Refresh', action: 'refresh' },
      ],
    };
  }

  // Rate limit errors
  if (err.status === 429 || err.message?.includes('rate limit') || err.message?.includes('too many requests')) {
    return {
      title: 'Too Many Requests',
      message: `You're sending requests too quickly. Please wait a moment before trying again.`,
      recoverable: true,
      severity: 'warning',
      code: 'RATE_LIMIT',
      recovery: [
        { label: 'Wait and Retry', action: 'retry' },
      ],
    };
  }

  // Validation errors
  if (err.message?.includes('invalid') || err.message?.includes('validation') || err.status === 400) {
    const validationDetails = err.details || err.fields || '';
    return {
      title: 'Invalid Input',
      message: validationDetails 
        ? `Please fix the following: ${validationDetails}`
        : `Please check your input and try again.`,
      recoverable: true,
      severity: 'warning',
      code: 'VALIDATION_ERROR',
      recovery: [
        { label: 'Fix Input', action: 'custom' },
      ],
    };
  }

  // Database errors
  if (err.message?.includes('database') || err.message?.includes('sqlite') || err.message?.includes('SQLITE')) {
    return {
      title: 'Database Error',
      message: `We're having trouble saving your changes. Your data is safe, but please try again.`,
      recoverable: true,
      severity: 'error',
      code: 'DATABASE_ERROR',
      recovery: [
        { label: 'Try Again', action: 'retry' },
        { label: 'Restart App', action: 'restart' },
      ],
    };
  }

  // IPC/Electron errors
  if (err.message?.includes('IPC') || err.message?.includes('ipcRenderer') || err.message?.includes('main process')) {
    return {
      title: 'Communication Error',
      message: `Unable to communicate with the application. Try restarting Froggo.`,
      recoverable: true,
      severity: 'error',
      code: 'IPC_ERROR',
      recovery: [
        { label: 'Restart Froggo', action: 'restart' },
        { label: 'Refresh Page', action: 'refresh' },
      ],
    };
  }

  // Conflict errors (409)
  if (err.status === 409 || err.message?.includes('conflict')) {
    return {
      title: 'Conflict Detected',
      message: `This ${resource} has been modified by someone else. Please refresh and try again.`,
      recoverable: true,
      severity: 'warning',
      code: 'CONFLICT',
      recovery: [
        { label: 'Refresh', action: 'refresh' },
        { label: 'Discard Changes', action: 'custom' },
      ],
    };
  }

  // Agent spawn errors
  if (err.message?.includes('spawn') || err.message?.includes('agent')) {
    return {
      title: 'Agent Error',
      message: `Unable to start the agent. ${context?.technical || 'Please try again.'}`,
      recoverable: true,
      severity: 'error',
      code: 'AGENT_SPAWN_ERROR',
      recovery: [
        { label: 'Try Again', action: 'retry' },
        { label: 'Check Logs', action: 'navigate', url: '/logs' },
      ],
    };
  }

  // Parse the actual error message if it's user-friendly
  const errorMsg = err.message || err.error || '';
  if (errorMsg && errorMsg.length < 100 && !errorMsg.includes('Error:') && !errorMsg.includes('at ')) {
    return {
      title: 'Error',
      message: errorMsg,
      recoverable: true,
      severity: 'error',
      recovery: [
        { label: 'Try Again', action: 'retry' },
      ],
    };
  }

  // Generic fallback
  return {
    title: 'Something Went Wrong',
    message: context?.technical 
      ? `Unable to ${action}. ${context.technical}`
      : `An unexpected error occurred while trying to ${action}. Please try again.`,
    recoverable: true,
    severity: 'error',
    code: 'UNKNOWN_ERROR',
    recovery: [
      { label: 'Try Again', action: 'retry' },
      { label: 'Refresh Page', action: 'refresh' },
    ],
  };
}

/**
 * Legacy compatibility - get just the message
 */
export function getUserFriendlyError(error: unknown, context?: ErrorContext): string {
  return getErrorInfo(error, context).message;
}

/**
 * Get a short, friendly error title
 */
export function getErrorTitle(error: unknown): string {
  return getErrorInfo(error).title;
}

/**
 * Determine if an error is recoverable (user should retry)
 */
export function isRecoverableError(error: unknown): boolean {
  return getErrorInfo(error).recoverable;
}

/**
 * Get recovery suggestions for an error
 */
export function getRecoveryActions(error: unknown, context?: ErrorContext): RecoveryAction[] {
  return getErrorInfo(error, context).recovery || [];
}
