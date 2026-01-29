/**
 * API Client with retry logic and error handling
 */

import { getErrorInfo } from './errorMessages';

export interface ApiOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  skipRetryOn?: number[]; // HTTP status codes to skip retry
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error should be retried
 */
function shouldRetry(error: any, attempt: number, maxRetries: number, skipRetryOn: number[]): boolean {
  if (attempt >= maxRetries) return false;

  // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
  if (error?.status) {
    const status = error.status;
    if (skipRetryOn.includes(status)) return false;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  }

  return true;
}

/**
 * Make API request with retry logic
 */
export async function apiCall<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    skipRetryOn = [],
    ...fetchOptions
  } = options;

  let lastError: any = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let data: T | undefined;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      }

      // Return result
      if (response.ok) {
        return {
          data,
          status: response.status,
          ok: true,
        };
      } else {
        // Non-OK response
        const errorInfo = getErrorInfo(
          new Error(`HTTP ${response.status}`),
          { technical: response.statusText }
        );

        lastError = {
          status: response.status,
          message: errorInfo.message,
        };

        // Check if should retry
        if (!shouldRetry(lastError, attempt, retries, skipRetryOn)) {
          return {
            error: errorInfo.message,
            status: response.status,
            ok: false,
          };
        }
      }
    } catch (error: any) {
      // Network or abort error
      if (error.name === 'AbortError') {
        lastError = new Error('Request timeout');
      } else {
        lastError = error;
      }

      // Check if should retry
      if (!shouldRetry(lastError, attempt, retries, skipRetryOn)) {
        const errorInfo = getErrorInfo(lastError);
        return {
          error: errorInfo.message,
          status: 0,
          ok: false,
        };
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < retries - 1) {
      const delay = retryDelay * Math.pow(2, attempt);
      console.log(`[API] Retrying in ${delay}ms... (attempt ${attempt + 2}/${retries})`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  const errorInfo = getErrorInfo(lastError, {
    action: 'connect to the server',
    technical: lastError?.message,
  });

  return {
    error: errorInfo.message,
    status: lastError?.status || 0,
    ok: false,
  };
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(url: string, options?: ApiOptions) =>
    apiCall<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, body?: any, options?: ApiOptions) =>
    apiCall<T>(url, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    }),

  put: <T = any>(url: string, body?: any, options?: ApiOptions) =>
    apiCall<T>(url, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    }),

  delete: <T = any>(url: string, options?: ApiOptions) =>
    apiCall<T>(url, { ...options, method: 'DELETE' }),

  patch: <T = any>(url: string, body?: any, options?: ApiOptions) =>
    apiCall<T>(url, {
      ...options,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    }),
};
