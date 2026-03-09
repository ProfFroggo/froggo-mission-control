// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validate,
  commonRules,
  sanitizeInput,
  validateFile,
  formatFileSize,
  ValidationRule,
} from './validation';

// Mock File class for testing
class MockFile {
  constructor(
    public name: string,
    public size: number,
    public type: string
  ) {}
}

describe('validation utilities', () => {
  describe('validate with required rule', () => {
    it('should fail for empty string', () => {
      const rules: ValidationRule[] = [{ type: 'required', message: 'Field is required' }];
      const result = validate('', rules);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should fail for whitespace-only string', () => {
      const rules: ValidationRule[] = [{ type: 'required', message: 'Field is required' }];
      const result = validate('   ', rules);
      expect(result.valid).toBe(false);
    });

    it('should pass for non-empty string', () => {
      const rules: ValidationRule[] = [{ type: 'required', message: 'Field is required' }];
      const result = validate('hello', rules);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate with minLength rule', () => {
    it('should fail for string shorter than minimum', () => {
      const rules: ValidationRule[] = [{ type: 'minLength', value: 5, message: 'Minimum 5 characters' }];
      const result = validate('hi', rules);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum 5 characters');
    });

    it('should pass for string equal to minimum', () => {
      const rules: ValidationRule[] = [{ type: 'minLength', value: 5, message: 'Minimum 5 characters' }];
      const result = validate('hello', rules);
      expect(result.valid).toBe(true);
    });

    it('should pass for string longer than minimum', () => {
      const rules: ValidationRule[] = [{ type: 'minLength', value: 5, message: 'Minimum 5 characters' }];
      const result = validate('hello world', rules);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate with maxLength rule', () => {
    it('should fail for string longer than maximum', () => {
      const rules: ValidationRule[] = [{ type: 'maxLength', value: 5, message: 'Maximum 5 characters' }];
      const result = validate('hello world', rules);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Maximum 5 characters');
    });

    it('should pass for string equal to maximum', () => {
      const rules: ValidationRule[] = [{ type: 'maxLength', value: 5, message: 'Maximum 5 characters' }];
      const result = validate('hello', rules);
      expect(result.valid).toBe(true);
    });

    it('should pass for string shorter than maximum', () => {
      const rules: ValidationRule[] = [{ type: 'maxLength', value: 10, message: 'Maximum 10 characters' }];
      const result = validate('hi', rules);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate with pattern rule', () => {
    it('should fail for string not matching pattern', () => {
      const rules: ValidationRule[] = [{ type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' }];
      const result = validate('abc', rules);
      expect(result.valid).toBe(false);
    });

    it('should pass for string matching pattern', () => {
      const rules: ValidationRule[] = [{ type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' }];
      const result = validate('123', rules);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate with email rule', () => {
    it('should pass for valid email', () => {
      const rules: ValidationRule[] = [{ type: 'email', message: 'Invalid email' }];
      expect(validate('user@example.com', rules).valid).toBe(true);
      expect(validate('user.name@example.co.uk', rules).valid).toBe(true);
      expect(validate('user+tag@example.org', rules).valid).toBe(true);
    });

    it('should fail for invalid email', () => {
      const rules: ValidationRule[] = [{ type: 'email', message: 'Invalid email' }];
      expect(validate('invalid', rules).valid).toBe(false);
      expect(validate('invalid@', rules).valid).toBe(false);
      expect(validate('@example.com', rules).valid).toBe(false);
      expect(validate('user@.com', rules).valid).toBe(false);
    });
  });

  describe('validate with url rule', () => {
    it('should pass for valid URL', () => {
      const rules: ValidationRule[] = [{ type: 'url', message: 'Invalid URL' }];
      expect(validate('https://example.com', rules).valid).toBe(true);
      expect(validate('http://example.com/path', rules).valid).toBe(true);
      expect(validate('https://example.com?query=value', rules).valid).toBe(true);
    });

    it('should fail for invalid URL', () => {
      const rules: ValidationRule[] = [{ type: 'url', message: 'Invalid URL' }];
      expect(validate('not-a-url', rules).valid).toBe(false);
      expect(validate('http://', rules).valid).toBe(false);
    });
  });

  describe('validate with custom rule', () => {
    it('should use custom validator function', () => {
      const rules: ValidationRule[] = [{
        type: 'custom',
        message: 'Must be even number',
        validator: (value: string) => parseInt(value) % 2 === 0,
      }];
      expect(validate('2', rules).valid).toBe(true);
      expect(validate('3', rules).valid).toBe(false);
    });
  });

  describe('validate with multiple rules', () => {
    it('should return first error encountered', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Required' },
        { type: 'minLength', value: 5, message: 'Too short' },
      ];
      const result = validate('', rules);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Required');
    });

    it('should pass when all rules pass', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Required' },
        { type: 'minLength', value: 3, message: 'Too short' },
      ];
      const result = validate('hello', rules);
      expect(result.valid).toBe(true);
    });
  });

  describe('commonRules', () => {
    describe('required rule generator', () => {
      it('should create required rule with default message', () => {
        const rule = commonRules.required();
        expect(rule.type).toBe('required');
        expect(rule.message).toBe('This field is required');
      });

      it('should create required rule with custom field name', () => {
        const rule = commonRules.required('Username');
        expect(rule.message).toBe('Username is required');
      });
    });

    describe('minLength rule generator', () => {
      it('should create minLength rule', () => {
        const rule = commonRules.minLength(8);
        expect(rule.type).toBe('minLength');
        expect(rule.value).toBe(8);
        expect(rule.message).toBe('This field must be at least 8 characters');
      });

      it('should create minLength rule with custom field name', () => {
        const rule = commonRules.minLength(8, 'Password');
        expect(rule.message).toBe('Password must be at least 8 characters');
      });
    });

    describe('maxLength rule generator', () => {
      it('should create maxLength rule', () => {
        const rule = commonRules.maxLength(100);
        expect(rule.type).toBe('maxLength');
        expect(rule.value).toBe(100);
        expect(rule.message).toBe('This field must be no more than 100 characters');
      });
    });

    describe('email rule generator', () => {
      it('should create email rule with default message', () => {
        const rule = commonRules.email();
        expect(rule.type).toBe('email');
      });

      it('should create email rule with custom message', () => {
        const rule = commonRules.email('Enter a valid email address');
        expect(rule.message).toBe('Enter a valid email address');
      });
    });

    describe('url rule generator', () => {
      it('should create url rule', () => {
        const rule = commonRules.url();
        expect(rule.type).toBe('url');
      });
    });

    describe('taskTitle rule generator', () => {
      it('should return array of rules for task title', () => {
        const rules = commonRules.taskTitle();
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBe(3);
      });
    });

    describe('agentName rule generator', () => {
      it('should return array of rules for agent name', () => {
        const rules = commonRules.agentName();
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBe(4);
      });
    });

    describe('fileName rule generator', () => {
      it('should return array of rules for file name', () => {
        const rules = commonRules.fileName();
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBe(2);
      });
    });

    describe('pattern rule generators', () => {
      it('should create noSpecialChars rule', () => {
        const rule = commonRules.noSpecialChars();
        expect(rule.type).toBe('pattern');
        expect(rule.value).toBe('^[a-zA-Z0-9\\s]+$');
      });

      it('should create alphanumeric rule', () => {
        const rule = commonRules.alphanumeric();
        expect(rule.type).toBe('pattern');
        expect(rule.value).toBe('^[a-zA-Z0-9]+$');
      });

      it('should create noWhitespace rule', () => {
        const rule = commonRules.noWhitespace();
        expect(rule.type).toBe('pattern');
        expect(rule.value).toBe('^\\S+$');
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should escape HTML characters', () => {
      const result = sanitizeInput('<script>alert("xss")</script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;xss&quot;');
    });

    it('should escape quotes', () => {
      const result = sanitizeInput('He said "hello"');
      expect(result).toContain('&quot;hello&quot;');
    });

    it('should escape forward slash', () => {
      const result = sanitizeInput('path/to/file');
      expect(result).toContain('&#x2F;');
    });

    it('should leave plain text unchanged', () => {
      expect(sanitizeInput('Plain text without special chars')).toBe('Plain text without special chars');
    });
  });

  describe('validateFile', () => {
    it('should pass for valid file', () => {
      const file = new MockFile('test.txt', 1024, 'text/plain');
      const result = validateFile(file as unknown as File);
      expect(result.valid).toBe(true);
    });

    it('should fail for file exceeding max size', () => {
      const file = new MockFile('large.txt', 20 * 1024 * 1024, 'text/plain'); // 20MB
      const result = validateFile(file as unknown as File, { maxSize: 10 * 1024 * 1024 }); // 10MB max
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
      expect(result.error).toContain('10MB');
    });

    it('should fail for disallowed MIME type', () => {
      const file = new MockFile('file.exe', 1024, 'application/x-msdownload');
      const result = validateFile(file as unknown as File, { allowedTypes: ['image/*', 'text/*'] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should pass for allowed MIME type', () => {
      const file = new MockFile('image.png', 1024, 'image/png');
      const result = validateFile(file as unknown as File, { allowedTypes: ['image/png'] });
      expect(result.valid).toBe(true);
    });

    it('should fail for disallowed file extension', () => {
      const file = new MockFile('file.js', 1024, 'text/javascript');
      const result = validateFile(file as unknown as File, { allowedExtensions: ['.txt', '.md'] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File extension not allowed');
    });

    it('should pass for allowed file extension', () => {
      const file = new MockFile('document.md', 1024, 'text/markdown');
      const result = validateFile(file as unknown as File, { allowedExtensions: ['md'] });
      expect(result.valid).toBe(true);
    });

    it('should use default max size of 10MB', () => {
      const file = new MockFile('file.txt', 10 * 1024 * 1024 + 1, 'text/plain');
      const result = validateFile(file as unknown as File);
      expect(result.valid).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10 * 1024)).toBe('10 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
      expect(formatFileSize(100 * 1024 * 1024)).toBe('100 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });
  });
});
