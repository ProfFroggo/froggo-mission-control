// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/apiErrors.ts
// Standardized API error class and handler for all platform API routes

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Converts any thrown error into a well-formed JSON error response.
 * Use in every API route catch block instead of ad-hoc Response.json calls.
 *
 * Usage:
 *   import { handleApiError } from '@/lib/apiErrors';
 *   } catch (error) { return handleApiError(error); }
 */
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status },
    );
  }
  console.error('Unhandled API error:', error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
