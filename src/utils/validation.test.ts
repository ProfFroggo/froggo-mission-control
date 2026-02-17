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
  ValidationResult,
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
  describe('validateRule', () => {
    describe('required rule', () => {
      it('should fail for empty string', () => {
        const rule: ValidationRule = { type: 'required', message: 'Field is required' };
        const result = validateRule('', rule);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Field is required');
      });

      it('should fail for whitespace-only string', () => {
        const rule: ValidationRule = { type: 'required', message: 'Field is required' };
        const result = validateRule('   ', rule);
        expect(result.valid).toBe(false);
      });

      it('should pass for non-empty string', () => {
        const rule: ValidationRule = { type: 'required', message: 'Field is required' };
        const result = validateRule('hello', rule);
        expect(result.valid).toBe(true);
      });
    });

    describe('minLength rule', () => {
      it('should fail for string shorter than minimum', () => {
        const rule: ValidationRule = { type: 'minLength', value: 5, message: 'Minimum 5 characters' };
        const result = validateRule('hi', rule);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Minimum 5 characters');
      });

      it('should pass for string equal to minimum', () => {
        const rule: ValidationRule = { type: 'minLength', value: 5, message: 'Minimum 5 characters' };
        const result = validateRule('hello', rule);
        expect(result.valid).toBe(true);
      });

      it('should pass for string longer than minimum', () => {
        const rule: ValidationRule = { type: 'minLength', value: 5, message: 'Minimum 5 characters' };
        const result = validateRule('hello world', rule);
        expect(result.valid).toBe(true);
      });
    });

    describe('maxLength rule', () => {
      it('should fail for string longer than maximum', () => {
        const rule: ValidationRule = { type: 'maxLength', value: 5, message: 'Maximum 5 characters' };
        const result = validateRule('hello world', rule);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Maximum 5 characters');
      });

      it('should pass for string equal to maximum', () => {
        const rule: ValidationRule = { type: 'maxLength', value: 5, message: 'Maximum 5 characters' };
        const result = validateRule('hello', rule);
        expect(result.valid).toBe(true);
      });

      it('should pass for string shorter than maximum', () => {
        const rule: ValidationRule = { type: 'maxLength', value: 10, message: 'Maximum 10 characters' };
        const result = validateRule('hi', rule);
        expect(result.valid).toBe(true);
      });
    });

    describe('pattern rule', () => {
      it('should fail for string not matching pattern', () => {
        const rule: ValidationRule = { type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' };
        const result = validateRule('abc', rule);
        expect(result.valid).toBe(false);
      });

      it('should pass for string matching pattern', () => {
        const rule: ValidationRule = { type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' };
        const result = validateRule('123', rule);
        expect(result.valid).toBe(true);
      });
    });

    describe('email rule', () => {
      it('should pass for valid email', () => {
        const rule: ValidationRule = { type: 'email', message: 'Invalid email' };
        expect(validateRule('user@example.com', rule).valid).toBe(true);
        expect(validateRule('user.name@example.co.uk', rule).valid).toBe(true);
        expect(validateRule('user+tag@example.org', rule).valid).toBe(true);
      });

      it('should fail for invalid email', () => {
        const rule: ValidationRule = { type: 'email', message: 'Invalid email' };
        expect(validateRule('invalid', rule).valid).toBe(false);
        expect(validateRule('invalid@', rule).valid).toBe(false);
        expect(validateRule('@example.com', rule).valid).toBe(false);
        expect(validateRule('user@.com', rule).valid).toBe(false);
      });
    });

    describe('url rule', () => {
      it('should pass for valid URL', () => {
        const rule: ValidationRule = { type: 'url', message: 'Invalid URL' };
        expect(validateRule('https://example.com', rule).valid).toBe(true);
        expect(validateRule('http://example.com/path', rule).valid).toBe(true);
        expect(validateRule('https://example.com?query=value', rule).valid).toBe(true);
      });

      it('should fail for invalid URL', () => {
        const rule: ValidationRule = { type: 'url', message: 'Invalid URL' };
        expect(validateRule('not-a-url', rule).valid).toBe(false);
        expect(validateRule('http://', rule).valid).toBe(false);
      });
    });

    describe('custom rule', () => {
      it('should use custom validator function', () => {
        const rule: ValidationRule = {
          type: 'custom',
          message: 'Must be even number',
          validator: (value: string) => parseInt(value) % 2 === 0,
        };
        expect(validateRule('2', rule).valid).toBe(true);
        expect(validateRule('3', rule).valid).toBe(false);
      });
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
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(sanitizeInput('<div>Content</div>')).toBe('&lt;div&gt;Content&lt;/div&gt;');
    });

    it('should escape quotes', () => {
      expect(sanitizeInput('He said "hello"')).toBe('He said &quot;hello&quot;');
      expect(sanitizeInput("It's working")).toBe("It&#x27;s working");
    });

    it('should escape forward slash', () => {
      expect(sanitizeInput('path/to/file')).toBe('path&#x2F;file');
    });

    it('should leave plain text unchanged', () => {
      expect(sanitizeInput('Plain text without special chars')).toBe('Plain text without special chars');
    });
  });

  describe('validateFile', () => {
    it('should pass for valid file', () => {
      const file = new MockFile('test.txt', 1024, 'text/plain');
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should fail for file exceeding max size', () => {
      const file = new MockFile('large.txt', 20 * 1024 * 1024, 'text/plain'); // 20MB
      const result = validateFile(file, { maxSize: 10 * 1024 * 1024 }); // 10MB max
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
      expect(result.error).toContain('10MB');
    });

    it('should fail for disallowed MIME type', () => {
      const file = new MockFile('file.exe', 1024, 'application/x-msdownload');
      const result = validateFile(file, { allowedTypes: ['image/*', 'text/*'] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should pass for allowed MIME type', () => {
      const file = new MockFile('image.png', 1024, 'image/png');
      const result = validateFile(file, { allowedTypes: ['image/*'] });
      expect(result.valid).toBe(true);
    });

    it('should fail for disallowed file extension', () => {
      const file = new MockFile('file.js', 1024, 'text/javascript');
      const result = validateFile(file, { allowedExtensions: ['.txt', '.md'] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File extension not allowed');
    });

    it('should pass for allowed file extension', () => {
      const file = new MockFile('document.md', 1024, 'text/markdown');
      const result = validateFile(file, { allowedExtensions: ['.md', '.txt'] });
      expect(result.valid).toBe(true);
    });

    it('should use default max size of 10MB', () => {
      const file = new MockFile('file.txt', 10 * 1024 * 1024 + 1, 'text/plain');
      const result = validateFile(file);
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
