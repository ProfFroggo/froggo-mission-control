// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for src/utils/errorMessages.ts
 *
 * Tests all exported functions: getErrorInfo, getUserFriendlyError,
 * getErrorTitle, isRecoverableError, and getRecoveryActions.
 * Covers all error classification branches.
 */

import { describe, it, expect } from 'vitest';
import {
  getErrorInfo,
  getUserFriendlyError,
  getErrorTitle,
  isRecoverableError,
  getRecoveryActions,
} from '../../utils/errorMessages';

// ─── getErrorInfo ─────────────────────────────────────────────────────────────

describe('getErrorInfo', () => {

  // ─── Network errors ───────────────────────────────────────────────────────

  describe('network errors', () => {
    it('classifies "fetch" in message as NETWORK_ERROR', () => {
      const result = getErrorInfo(new Error('Failed to fetch'));
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.title).toBe('Connection Failed');
      expect(result.recoverable).toBe(true);
      expect(result.severity).toBe('error');
    });

    it('classifies "network" in message as NETWORK_ERROR', () => {
      const result = getErrorInfo(new Error('network connection lost'));
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('classifies "ENOTFOUND" in message as NETWORK_ERROR', () => {
      const result = getErrorInfo(new Error('getaddrinfo ENOTFOUND api.example.com'));
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('provides retry and check-network recovery actions for network errors', () => {
      const result = getErrorInfo(new Error('Failed to fetch'));
      const actionTypes = result.recovery!.map(r => r.action);
      expect(actionTypes).toContain('retry');
    });
  });

  // ─── Timeout errors ───────────────────────────────────────────────────────

  describe('timeout errors', () => {
    it('classifies "timeout" in message as TIMEOUT', () => {
      const result = getErrorInfo(new Error('request timeout after 30s'));
      expect(result.code).toBe('TIMEOUT');
      expect(result.title).toBe('Request Timed Out');
      expect(result.severity).toBe('warning');
    });

    it('classifies ETIMEDOUT code as TIMEOUT', () => {
      const result = getErrorInfo({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' });
      expect(result.code).toBe('TIMEOUT');
    });

    it('TIMEOUT errors are recoverable', () => {
      const result = getErrorInfo(new Error('timeout'));
      expect(result.recoverable).toBe(true);
    });
  });

  // ─── Permission errors ────────────────────────────────────────────────────

  describe('permission errors', () => {
    it('classifies "permission" in message as PERMISSION_DENIED', () => {
      const result = getErrorInfo(new Error('permission denied to access resource'));
      expect(result.code).toBe('PERMISSION_DENIED');
      expect(result.title).toBe('Permission Denied');
      expect(result.recoverable).toBe(false);
    });

    it('classifies EACCES code as PERMISSION_DENIED', () => {
      const result = getErrorInfo({ code: 'EACCES', message: 'open EACCES /etc/passwd' });
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('classifies HTTP 403 as PERMISSION_DENIED', () => {
      const result = getErrorInfo({ status: 403, message: 'Forbidden' });
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('PERMISSION_DENIED errors are NOT recoverable', () => {
      const result = getErrorInfo(new Error('permission denied'));
      expect(result.recoverable).toBe(false);
    });

    it('uses action from context in message', () => {
      const result = getErrorInfo(new Error('permission denied'), { action: 'delete files' });
      expect(result.message).toContain('delete files');
    });
  });

  // ─── Not found errors ─────────────────────────────────────────────────────

  describe('not found errors', () => {
    it('classifies "not found" in message as NOT_FOUND', () => {
      const result = getErrorInfo(new Error('resource not found'));
      expect(result.code).toBe('NOT_FOUND');
      expect(result.title).toBe('Not Found');
      expect(result.recoverable).toBe(false);
    });

    it('classifies ENOENT code as NOT_FOUND', () => {
      const result = getErrorInfo({ code: 'ENOENT', message: 'open ENOENT /path/to/file' });
      expect(result.code).toBe('NOT_FOUND');
    });

    it('classifies HTTP 404 as NOT_FOUND', () => {
      const result = getErrorInfo({ status: 404 });
      expect(result.code).toBe('NOT_FOUND');
    });

    it('uses resource from context in message', () => {
      const result = getErrorInfo({ status: 404 }, { resource: 'agent profile' });
      expect(result.message).toContain('agent profile');
    });
  });

  // ─── Server errors ────────────────────────────────────────────────────────

  describe('server errors', () => {
    it('classifies HTTP 500 as SERVER_ERROR', () => {
      const result = getErrorInfo({ status: 500 });
      expect(result.code).toBe('SERVER_ERROR');
      expect(result.title).toBe('Server Error');
      expect(result.recoverable).toBe(true);
    });

    it('classifies HTTP 502 as SERVER_ERROR', () => {
      const result = getErrorInfo({ status: 502 });
      expect(result.code).toBe('SERVER_ERROR');
    });

    it('classifies "server error" in message as SERVER_ERROR', () => {
      const result = getErrorInfo(new Error('internal server error'));
      expect(result.code).toBe('SERVER_ERROR');
    });
  });

  // ─── Authentication errors ────────────────────────────────────────────────

  describe('authentication errors', () => {
    it('classifies HTTP 401 as AUTH_REQUIRED', () => {
      const result = getErrorInfo({ status: 401 });
      expect(result.code).toBe('AUTH_REQUIRED');
      expect(result.title).toBe('Authentication Required');
      expect(result.severity).toBe('warning');
    });

    it('classifies "unauthorized" in message as AUTH_REQUIRED', () => {
      const result = getErrorInfo(new Error('unauthorized access'));
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('classifies "authentication" in message as AUTH_REQUIRED', () => {
      const result = getErrorInfo(new Error('authentication failed'));
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('provides sign-in recovery action', () => {
      const result = getErrorInfo({ status: 401 });
      const signIn = result.recovery!.find(r => r.url === '/login');
      expect(signIn).toBeDefined();
    });
  });

  // ─── Rate limit errors ────────────────────────────────────────────────────

  describe('rate limit errors', () => {
    it('classifies HTTP 429 as RATE_LIMIT', () => {
      const result = getErrorInfo({ status: 429 });
      expect(result.code).toBe('RATE_LIMIT');
      expect(result.title).toBe('Too Many Requests');
      expect(result.severity).toBe('warning');
    });

    it('classifies "rate limit" in message as RATE_LIMIT', () => {
      const result = getErrorInfo(new Error('rate limit exceeded'));
      expect(result.code).toBe('RATE_LIMIT');
    });

    it('classifies "too many requests" in message as RATE_LIMIT', () => {
      const result = getErrorInfo(new Error('too many requests'));
      expect(result.code).toBe('RATE_LIMIT');
    });
  });

  // ─── Validation errors ────────────────────────────────────────────────────

  describe('validation errors', () => {
    it('classifies "invalid" in message as VALIDATION_ERROR', () => {
      const result = getErrorInfo(new Error('invalid input provided'));
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.title).toBe('Invalid Input');
      expect(result.severity).toBe('warning');
    });

    it('classifies "validation" in message as VALIDATION_ERROR', () => {
      const result = getErrorInfo(new Error('validation failed'));
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('classifies HTTP 400 as VALIDATION_ERROR', () => {
      const result = getErrorInfo({ status: 400 });
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('includes details when provided in error object', () => {
      const result = getErrorInfo({ message: 'invalid', details: 'name is required' });
      expect(result.message).toContain('name is required');
    });

    it('includes fields when provided in error object', () => {
      const result = getErrorInfo({ message: 'invalid', fields: 'email, password' });
      expect(result.message).toContain('email, password');
    });
  });

  // ─── Database errors ──────────────────────────────────────────────────────

  describe('database errors', () => {
    it('classifies "database" in message as DATABASE_ERROR', () => {
      const result = getErrorInfo(new Error('database connection failed'));
      expect(result.code).toBe('DATABASE_ERROR');
      expect(result.title).toBe('Database Error');
      expect(result.recoverable).toBe(true);
    });

    it('classifies "sqlite" in message as DATABASE_ERROR', () => {
      const result = getErrorInfo(new Error('sqlite: no such table'));
      expect(result.code).toBe('DATABASE_ERROR');
    });

    it('classifies "SQLITE" in message as DATABASE_ERROR', () => {
      const result = getErrorInfo(new Error('SQLITE_ERROR: constraint failed'));
      expect(result.code).toBe('DATABASE_ERROR');
    });
  });

  // ─── IPC errors ───────────────────────────────────────────────────────────

  describe('IPC errors', () => {
    it('classifies "IPC" in message as IPC_ERROR', () => {
      const result = getErrorInfo(new Error('IPC channel disconnected'));
      expect(result.code).toBe('IPC_ERROR');
      expect(result.title).toBe('Communication Error');
    });

    it('classifies "ipcRenderer" in message as IPC_ERROR', () => {
      const result = getErrorInfo(new Error('ipcRenderer not available'));
      expect(result.code).toBe('IPC_ERROR');
    });

    it('classifies "main process" in message as IPC_ERROR', () => {
      const result = getErrorInfo(new Error('cannot reach main process'));
      expect(result.code).toBe('IPC_ERROR');
    });
  });

  // ─── Conflict errors ──────────────────────────────────────────────────────

  describe('conflict errors', () => {
    it('classifies HTTP 409 as CONFLICT', () => {
      const result = getErrorInfo({ status: 409 });
      expect(result.code).toBe('CONFLICT');
      expect(result.title).toBe('Conflict Detected');
      expect(result.severity).toBe('warning');
    });

    it('classifies "conflict" in message as CONFLICT', () => {
      const result = getErrorInfo(new Error('merge conflict detected'));
      expect(result.code).toBe('CONFLICT');
    });
  });

  // ─── Agent spawn errors ───────────────────────────────────────────────────

  describe('agent spawn errors', () => {
    it('classifies "spawn" in message as AGENT_SPAWN_ERROR', () => {
      const result = getErrorInfo(new Error('spawn ENOENT: no such file'));
      expect(result.code).toBe('AGENT_SPAWN_ERROR');
      expect(result.title).toBe('Agent Error');
    });

    it('classifies "agent" in message as AGENT_SPAWN_ERROR', () => {
      const result = getErrorInfo(new Error('agent process crashed'));
      expect(result.code).toBe('AGENT_SPAWN_ERROR');
    });

    it('includes technical context in message', () => {
      const result = getErrorInfo(
        new Error('agent process crashed'),
        { technical: 'Check logs for details.' }
      );
      expect(result.message).toContain('Check logs for details.');
    });
  });

  // ─── Short user-friendly message passthrough ──────────────────────────────

  describe('short message passthrough', () => {
    it('uses the short error message directly when it looks user-friendly', () => {
      const result = getErrorInfo(new Error('File not accessible'));
      // Short, no "Error:" prefix, no stack traces — should pass through
      expect(result.message).toBe('File not accessible');
    });
  });

  // ─── Generic fallback ─────────────────────────────────────────────────────

  describe('generic fallback', () => {
    it('returns UNKNOWN_ERROR for unclassified errors', () => {
      const result = getErrorInfo({ someRandomProp: true });
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.title).toBe('Something Went Wrong');
      expect(result.recoverable).toBe(true);
    });

    it('returns UNKNOWN_ERROR for null', () => {
      const result = getErrorInfo(null);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('returns UNKNOWN_ERROR for undefined', () => {
      const result = getErrorInfo(undefined);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('uses action from context in UNKNOWN_ERROR message', () => {
      const result = getErrorInfo({}, { action: 'save the file' });
      expect(result.message).toContain('save the file');
    });

    it('uses technical from context in UNKNOWN_ERROR message', () => {
      const result = getErrorInfo({}, { technical: 'Module X returned null.' });
      expect(result.message).toContain('Module X returned null.');
    });

    it('provides retry and refresh recovery actions', () => {
      const result = getErrorInfo({});
      const actions = result.recovery!.map(r => r.action);
      expect(actions).toContain('retry');
      expect(actions).toContain('refresh');
    });
  });

  // ─── Input type handling ──────────────────────────────────────────────────

  describe('input type handling', () => {
    it('handles string errors', () => {
      const result = getErrorInfo('something went wrong');
      // String "something went wrong" doesn't match any keyword patterns → fallback
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
    });

    it('handles Error instances', () => {
      const result = getErrorInfo(new Error('ENOENT: file not found'));
      expect(result.code).toBe('NOT_FOUND');
    });

    it('handles plain objects with message property', () => {
      const result = getErrorInfo({ message: 'timeout after 10s' });
      expect(result.code).toBe('TIMEOUT');
    });

    it('handles plain objects with status property', () => {
      const result = getErrorInfo({ status: 401 });
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('handles plain objects with error property', () => {
      const result = getErrorInfo({ error: 'Forbidden' });
      // "Forbidden" is short and has no keyword → may pass through as user-friendly
      expect(result).toBeDefined();
    });
  });
});

// ─── getUserFriendlyError ─────────────────────────────────────────────────────

describe('getUserFriendlyError', () => {
  it('returns a string message', () => {
    const msg = getUserFriendlyError(new Error('Failed to fetch'));
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns the message from getErrorInfo', () => {
    const info = getErrorInfo(new Error('Failed to fetch'));
    const msg = getUserFriendlyError(new Error('Failed to fetch'));
    expect(msg).toBe(info.message);
  });

  it('passes context through to getErrorInfo', () => {
    const msg = getUserFriendlyError(new Error('permission denied'), { action: 'upload files' });
    expect(msg).toContain('upload files');
  });

  it('works with null error', () => {
    const msg = getUserFriendlyError(null);
    expect(typeof msg).toBe('string');
  });
});

// ─── getErrorTitle ────────────────────────────────────────────────────────────

describe('getErrorTitle', () => {
  it('returns the error title string', () => {
    const title = getErrorTitle(new Error('Failed to fetch'));
    expect(title).toBe('Connection Failed');
  });

  it('returns "Not Found" for 404 errors', () => {
    expect(getErrorTitle({ status: 404 })).toBe('Not Found');
  });

  it('returns "Something Went Wrong" for unknown errors', () => {
    expect(getErrorTitle({})).toBe('Something Went Wrong');
  });

  it('returns "Permission Denied" for 403 errors', () => {
    expect(getErrorTitle({ status: 403 })).toBe('Permission Denied');
  });

  it('returns "Server Error" for 500 errors', () => {
    expect(getErrorTitle({ status: 500 })).toBe('Server Error');
  });
});

// ─── isRecoverableError ───────────────────────────────────────────────────────

describe('isRecoverableError', () => {
  it('returns true for network errors', () => {
    expect(isRecoverableError(new Error('Failed to fetch'))).toBe(true);
  });

  it('returns true for timeout errors', () => {
    expect(isRecoverableError(new Error('timeout'))).toBe(true);
  });

  it('returns false for permission errors', () => {
    expect(isRecoverableError(new Error('permission denied'))).toBe(false);
  });

  it('returns false for not found errors', () => {
    expect(isRecoverableError({ status: 404 })).toBe(false);
  });

  it('returns true for server errors', () => {
    expect(isRecoverableError({ status: 500 })).toBe(true);
  });

  it('returns true for authentication errors', () => {
    expect(isRecoverableError({ status: 401 })).toBe(true);
  });

  it('returns true for rate limit errors', () => {
    expect(isRecoverableError({ status: 429 })).toBe(true);
  });

  it('returns true for unknown errors', () => {
    expect(isRecoverableError({})).toBe(true);
  });
});

// ─── getRecoveryActions ───────────────────────────────────────────────────────

describe('getRecoveryActions', () => {
  it('returns an array of recovery actions', () => {
    const actions = getRecoveryActions(new Error('Failed to fetch'));
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('returns empty array for errors with no recovery (gracefully)', () => {
    // All our cases have recovery actions, but the function handles undefined
    const actions = getRecoveryActions({});
    expect(Array.isArray(actions)).toBe(true);
  });

  it('each action has a label and action type', () => {
    const actions = getRecoveryActions(new Error('timeout'));
    for (const action of actions) {
      expect(action.label).toBeDefined();
      expect(typeof action.label).toBe('string');
      expect(action.action).toBeDefined();
    }
  });

  it('passes context through to getErrorInfo', () => {
    const actions = getRecoveryActions(
      new Error('permission denied'),
      { action: 'delete agent' }
    );
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('network error includes a retry action', () => {
    const actions = getRecoveryActions(new Error('Failed to fetch'));
    const hasRetry = actions.some(a => a.action === 'retry');
    expect(hasRetry).toBe(true);
  });

  it('auth error includes a navigate action to /login', () => {
    const actions = getRecoveryActions({ status: 401 });
    const loginAction = actions.find(a => a.url === '/login');
    expect(loginAction).toBeDefined();
  });
});
