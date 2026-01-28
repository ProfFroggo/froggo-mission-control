/**
 * User-friendly error messages
 * Converts technical errors into actionable messages for users
 */

interface ErrorContext {
  action?: string;
  resource?: string;
  technical?: string;
}

export function getUserFriendlyError(error: any, context?: ErrorContext): string {
  const action = context?.action || 'perform this action';
  const resource = context?.resource || 'data';
  
  // Network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
    return `Unable to connect. Please check your internet connection and try again.`;
  }
  
  // Timeout errors
  if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
    return `This is taking longer than expected. Please try again in a moment.`;
  }
  
  // Permission errors
  if (error?.message?.includes('permission') || error?.code === 'EACCES') {
    return `You don't have permission to ${action}. Please check your settings.`;
  }
  
  // Not found errors
  if (error?.message?.includes('not found') || error?.code === 'ENOENT' || error?.status === 404) {
    return `We couldn't find that ${resource}. It may have been moved or deleted.`;
  }
  
  // Server errors
  if (error?.status >= 500 || error?.message?.includes('server error')) {
    return `Our servers are having trouble right now. Please try again in a few minutes.`;
  }
  
  // Authentication errors
  if (error?.status === 401 || error?.message?.includes('unauthorized')) {
    return `You need to sign in again to ${action}.`;
  }
  
  // Rate limit errors
  if (error?.status === 429 || error?.message?.includes('rate limit')) {
    return `You're going too fast! Please wait a moment and try again.`;
  }
  
  // Validation errors
  if (error?.message?.includes('invalid') || error?.message?.includes('validation')) {
    return `Please check your input and try again.`;
  }
  
  // Database errors
  if (error?.message?.includes('database') || error?.message?.includes('sqlite')) {
    return `We're having trouble saving your changes. Please try again.`;
  }
  
  // IPC/Electron errors
  if (error?.message?.includes('IPC') || error?.message?.includes('ipcRenderer')) {
    return `Unable to communicate with the app. Try restarting Froggo.`;
  }
  
  // Parse the actual error message if it's user-friendly
  const errorMsg = error?.message || error?.error || '';
  if (errorMsg && errorMsg.length < 100 && !errorMsg.includes('Error:') && !errorMsg.includes('at ')) {
    return errorMsg;
  }
  
  // Fallback with technical details if provided
  if (context?.technical) {
    return `Unable to ${action}. ${context.technical}`;
  }
  
  // Generic fallback
  return `Something went wrong while trying to ${action}. Please try again.`;
}

/**
 * Get a short, friendly error title
 */
export function getErrorTitle(error: any): string {
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return 'Connection Error';
  }
  if (error?.status === 404) {
    return 'Not Found';
  }
  if (error?.status >= 500) {
    return 'Server Error';
  }
  if (error?.status === 401) {
    return 'Authentication Required';
  }
  if (error?.status === 429) {
    return 'Too Many Requests';
  }
  return 'Oops!';
}

/**
 * Determine if an error is recoverable (user should retry)
 */
export function isRecoverableError(error: any): boolean {
  // Network and timeout errors are usually recoverable
  if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
    return true;
  }
  // Server errors might be temporary
  if (error?.status >= 500) {
    return true;
  }
  // Rate limits are recoverable after waiting
  if (error?.status === 429) {
    return true;
  }
  // Authentication errors need user action
  if (error?.status === 401) {
    return false;
  }
  // Not found errors are usually not recoverable
  if (error?.status === 404) {
    return false;
  }
  // Default to recoverable to encourage retry
  return true;
}
