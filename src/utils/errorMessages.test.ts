/**
 * Tests for errorMessages utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getErrorInfo,
  getUserFriendlyError,
  getErrorTitle,
  isRecoverableError,
  getRecoveryActions,
} from '../src/utils/errorMessages';

describe('errorMessages utilities', () => {
  describe('getErrorInfo', () => {
    describe('network errors', () => {
      it('should handle fetch errors', () => {
        const error = new Error('Failed to fetch');
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Connection Failed');
        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.severity).toBe('error');
        expect(result.recoverable).toBe(true);
      });

      it('should handle network errors', () => {
        const error = new Error('Network Error');
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Connection Failed');
        expect(result.recovery).toHaveLength(2);
      });

      it('should handle ENOTFOUND errors', () => {
        const error = { message: 'ENOTFOUND: dns resolution failed' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('NETWORK_ERROR');
      });
    });

    describe('timeout errors', () => {
      it('should handle timeout errors', () => {
        const error = new Error('Request timed out');
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Request Timed Out');
        expect(result.code).toBe('TIMEOUT');
        expect(result.severity).toBe('warning');
      });

      it('should handle ETIMEDOUT code', () => {
        const error = { code: 'ETIMEDOUT' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('TIMEOUT');
      });
    });

    describe('permission errors', () => {
      it('should handle permission denied errors', () => {
        const error = new Error('Permission denied to access resource');
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Permission Denied');
        expect(result.code).toBe('PERMISSION_DENIED');
        expect(result.recoverable).toBe(false);
      });

      it('should handle EACCES code', () => {
        const error = { code: 'EACCES', message: 'Access denied' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('PERMISSION_DENIED');
      });

      it('should handle 403 status', () => {
        const error = { status: 403, message: 'Forbidden' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('PERMISSION_DENIED');
      });

      it('should include custom action in context', () => {
        const error = { status: 403 };
        const context = { action: 'delete this task' };
        const result = getErrorInfo(error, context);
        
        expect(result.message).toContain('delete this task');
      });
    });

    describe('not found errors', () => {
      it('should handle not found errors', () => {
        const error = new Error('Resource not found');
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Not Found');
        expect(result.code).toBe('NOT_FOUND');
      });

      it('should handle ENOENT code', () => {
        const error = { code: 'ENOENT' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('NOT_FOUND');
      });

      it('should handle 404 status', () => {
        const error = { status: 404, message: 'Not found' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('NOT_FOUND');
      });

      it('should include custom resource in context', () => {
        const error = { status: 404 };
        const context = { resource: 'task' };
        const result = getErrorInfo(error, context);
        
        expect(result.message).toContain('task');
      });
    });

    describe('server errors', () => {
      it('should handle 500 status', () => {
        const error = { status: 500, message: 'Internal server error' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Server Error');
        expect(result.code).toBe('SERVER_ERROR');
        expect(result.severity).toBe('error');
      });

      it('should handle 503 status', () => {
        const error = { status: 503 };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('SERVER_ERROR');
      });

      it('should handle server error message', () => {
        const error = { message: 'Internal server error occurred' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('SERVER_ERROR');
      });
    });

    describe('authentication errors', () => {
      it('should handle 401 status', () => {
        const error = { status: 401, message: 'Unauthorized' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Authentication Required');
        expect(result.code).toBe('AUTH_REQUIRED');
        expect(result.severity).toBe('warning');
      });

      it('should handle unauthorized message', () => {
        const error = { message: 'User is unauthorized' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('AUTH_REQUIRED');
      });

      it('should handle authentication message', () => {
        const error = { message: 'Authentication failed' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('AUTH_REQUIRED');
      });
    });

    describe('rate limit errors', () => {
      it('should handle 429 status', () => {
        const error = { status: 429, message: 'Too many requests' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Too Many Requests');
        expect(result.code).toBe('RATE_LIMIT');
        expect(result.severity).toBe('warning');
      });

      it('should handle rate limit message', () => {
        const error = { message: 'Rate limit exceeded' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('RATE_LIMIT');
      });

      it('should handle too many requests message', () => {
        const error = { message: 'You are sending requests too quickly' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('RATE_LIMIT');
      });
    });

    describe('validation errors', () => {
      it('should handle validation message', () => {
        const error = { message: 'Invalid input provided' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Invalid Input');
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.severity).toBe('warning');
      });

      it('should handle invalid message', () => {
        const error = { message: 'Invalid email format' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('VALIDATION_ERROR');
      });

      it('should handle 400 status', () => {
        const error = { status: 400, message: 'Bad request' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('VALIDATION_ERROR');
      });

      it('should include validation details', () => {
        const error = { 
          message: 'Invalid', 
          details: 'email is required, password must be at least 8 characters' 
        };
        const result = getErrorInfo(error);
        
        expect(result.message).toContain('email is required');
      });
    });

    describe('database errors', () => {
      it('should handle database message', () => {
        const error = { message: 'Database connection failed' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Database Error');
        expect(result.code).toBe('DATABASE_ERROR');
      });

      it('should handle sqlite message', () => {
        const error = { message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('DATABASE_ERROR');
      });
    });

    describe('IPC errors', () => {
      it('should handle IPC message', () => {
        const error = { message: 'IPC channel closed' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Communication Error');
        expect(result.code).toBe('IPC_ERROR');
      });

      it('should handle ipcRenderer message', () => {
        const error = { message: 'ipcRenderer.invoke failed' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('IPC_ERROR');
      });

      it('should handle main process message', () => {
        const error = { message: 'Error in main process' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('IPC_ERROR');
      });
    });

    describe('conflict errors', () => {
      it('should handle 409 status', () => {
        const error = { status: 409, message: 'Conflict' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Conflict Detected');
        expect(result.code).toBe('CONFLICT');
        expect(result.severity).toBe('warning');
      });

      it('should handle conflict message', () => {
        const error = { message: 'Version conflict detected' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('CONFLICT');
      });
    });

    describe('agent spawn errors', () => {
      it('should handle spawn message', () => {
        const error = { message: 'Failed to spawn agent' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Agent Error');
        expect(result.code).toBe('AGENT_SPAWN_ERROR');
      });

      it('should handle agent message', () => {
        const error = { message: 'Agent crashed' };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('AGENT_SPAWN_ERROR');
      });

      it('should include technical context', () => {
        const error = { message: 'Spawn failed' };
        const context = { technical: 'Agent timeout after 30 seconds' };
        const result = getErrorInfo(error, context);
        
        expect(result.message).toContain('Agent timeout after 30 seconds');
      });
    });

    describe('user-friendly error messages', () => {
      it('should extract simple error messages', () => {
        const error = { message: 'This is a simple user error' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Error');
        expect(result.message).toBe('This is a simple user error');
      });

      it('should not use stack traces as messages', () => {
        const error = { 
          message: 'Error: Something failed\n    at Object.<anonymous> (file.ts:10:5)\n    at Module._compile' 
        };
        const result = getErrorInfo(error);
        
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.title).toBe('Something Went Wrong');
      });
    });

    describe('fallback behavior', () => {
      it('should handle unknown errors', () => {
        const error = { message: 'Some unknown error' };
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Something Went Wrong');
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.recoverable).toBe(true);
      });

      it('should handle empty error object', () => {
        const error = {};
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Something Went Wrong');
      });

      it('should handle null error', () => {
        const error = null;
        const result = getErrorInfo(error);
        
        expect(result.title).toBe('Something Went Wrong');
      });
    });
  });

  describe('getUserFriendlyError', () => {
    it('should return just the message', () => {
      const error = new Error('Network Error');
      const result = getUserFriendlyError(error);
      
      expect(result).toBe('Unable to connect to the server. Please check your internet connection.');
    });

    it('should accept context parameter', () => {
      const error = { status: 403 };
      const context = { action: 'delete this file' };
      const result = getUserFriendlyError(error, context);
      
      expect(result).toContain('delete this file');
    });
  });

  describe('getErrorTitle', () => {
    it('should return just the title', () => {
      const error = new Error('Not found');
      const result = getErrorTitle(error);
      
      expect(result).toBe('Not Found');
    });
  });

  describe('isRecoverableError', () => {
    it('should return true for recoverable errors', () => {
      const error = new Error('Network Error');
      const result = isRecoverableError(error);
      
      expect(result).toBe(true);
    });

    it('should return false for permission errors', () => {
      const error = { status: 403 };
      const result = isRecoverableError(error);
      
      expect(result).toBe(false);
    });

    it('should return false for not found errors', () => {
      const error = { status: 404 };
      const result = isRecoverableError(error);
      
      expect(result).toBe(false);
    });
  });

  describe('getRecoveryActions', () => {
    it('should return recovery actions array', () => {
      const error = new Error('Network Error');
      const result = getRecoveryActions(error);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('action');
    });

    it('should accept context parameter', () => {
      const error = { status: 403 };
      const context = { action: 'delete this task' };
      const result = getRecoveryActions(error, context);
      
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('toAppError type guard', () => {
    it('should handle Error instances', () => {
      const error = new Error('Test error');
      const result = getErrorInfo(error);
      
      expect(result.message).toBeTruthy();
    });

    it('should handle string errors', () => {
      const error = 'Test error string';
      const result = getErrorInfo(error);
      
      expect(result.message).toBe('Test error string');
    });

    it('should handle object errors', () => {
      const error = { message: 'Object error', code: 'TEST_CODE' };
      const result = getErrorInfo(error);
      
      expect(result.message).toBe('Object error');
      expect(result.code).toBe('TEST_CODE');
    });

    it('should handle complex error objects', () => {
      const error = {
        message: 'Complex error',
        code: 'COMPLEX',
        status: 500,
        details: 'Additional details',
      };
      const result = getErrorInfo(error);
      
      expect(result.message).toBe('Complex error');
      expect(result.code).toBe('COMPLEX');
    });
  });
});
