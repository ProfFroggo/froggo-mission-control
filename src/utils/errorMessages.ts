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
export function getErrorInfo(error: any, context?: ErrorContext): ErrorInfo {
  const action = context?.action || 'perform this action';
  const resource = context?.resource || 'data';

  // Network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('ENOTFOUND')) {
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
  if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
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
  if (error?.message?.includes('permission') || error?.code === 'EACCES' || error?.status === 403) {
    return {
      title: 'Permission Denied',
      message: `You don't have permission to ${action}. Contact your administrator if you believe this is incorrect.`,
      recoverable: false,
      severity: 'error',
      code: 'PERMISSION_DENIED',
      recovery: [
        { label: 'Go Back', action: 'navigate', url: '/' },
        { label: 'Contact Support', action: 'contact' },
      ],
    };
  }

  // Not found errors
  if (error?.message?.includes('not found') || error?.code === 'ENOENT' || error?.status === 404) {
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
  if (error?.status >= 500 || error?.message?.includes('server error')) {
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
  if (error?.status === 401 || error?.message?.includes('unauthorized') || error?.message?.includes('authentication')) {
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
  if (error?.status === 429 || error?.message?.includes('rate limit') || error?.message?.includes('too many requests')) {
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
  if (error?.message?.includes('invalid') || error?.message?.includes('validation') || error?.status === 400) {
    const validationDetails = error?.details || error?.fields || '';
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
  if (error?.message?.includes('database') || error?.message?.includes('sqlite') || error?.message?.includes('SQLITE')) {
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
  if (error?.message?.includes('IPC') || error?.message?.includes('ipcRenderer') || error?.message?.includes('main process')) {
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
  if (error?.status === 409 || error?.message?.includes('conflict')) {
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
  if (error?.message?.includes('spawn') || error?.message?.includes('agent')) {
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
  const errorMsg = error?.message || error?.error || '';
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
export function getUserFriendlyError(error: any, context?: ErrorContext): string {
  return getErrorInfo(error, context).message;
}

/**
 * Get a short, friendly error title
 */
export function getErrorTitle(error: any): string {
  return getErrorInfo(error).title;
}

/**
 * Determine if an error is recoverable (user should retry)
 */
export function isRecoverableError(error: any): boolean {
  return getErrorInfo(error).recoverable;
}

/**
 * Get recovery suggestions for an error
 */
export function getRecoveryActions(error: any, context?: ErrorContext): RecoveryAction[] {
  return getErrorInfo(error, context).recovery || [];
}
