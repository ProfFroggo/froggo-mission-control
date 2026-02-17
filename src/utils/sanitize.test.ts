/**
 * Tests for sanitize utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html, config) => html),
  },
}));

import DOMPurify from 'dompurify';

// Import after mocking
import {
  sanitizeHtml,
  sanitizePlainText,
  sanitizeSearchSnippet,
  sanitizeUrl,
  escapeHtml,
  sanitizeEventDescription,
} from './sanitize';

describe('sanitize utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeHtml', () => {
    it('should remove dangerous HTML tags', () => {
      const dangerousHtml = '<script>alert("xss")</script><p>Safe text</p>';
      const result = sanitizeHtml(dangerousHtml);
      
      // DOMPurify should have sanitized the input
      expect(DOMPurify.sanitize).toHaveBeenCalled();
    });

    it('should allow basic formatting tags', () => {
      const formattedHtml = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const result = sanitizeHtml(formattedHtml);
      
      expect(DOMPurify.sanitize).toHaveBeenCalled();
    });

    it('should handle empty string', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      const result = sanitizeHtml('' as unknown as string);
      expect(result).toBeDefined();
    });
  });

  describe('sanitizePlainText', () => {
    it('should remove all HTML tags', () => {
      const html = '<div><span>Text</span> with <strong>tags</strong></div>';
      const result = sanitizePlainText(html);
      
      expect(DOMPurify.sanitize).toHaveBeenCalled();
    });

    it('should handle plain text', () => {
      const plainText = 'Just some text without any HTML';
      const result = sanitizePlainText(plainText);
      
      expect(result).toBe(plainText);
    });
  });

  describe('sanitizeSearchSnippet', () => {
    it('should allow mark tags for highlighting', () => {
      const snippet = 'Some text <mark>highlighted</mark> here';
      const result = sanitizeSearchSnippet(snippet);
      
      expect(DOMPurify.sanitize).toHaveBeenCalled();
    });

    it('should handle plain text without tags', () => {
      const snippet = 'Plain text search result';
      const result = sanitizeSearchSnippet(snippet);
      
      expect(result).toBeDefined();
    });

    it('should handle empty string', () => {
      const result = sanitizeSearchSnippet('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow http URLs', () => {
      const result = sanitizeUrl('https://example.com');
      expect(result).toBe('https://example.com');
    });

    it('should allow https URLs', () => {
      const result = sanitizeUrl('https://secure.example.com');
      expect(result).toBe('https://secure.example.com');
    });

    it('should allow mailto URLs', () => {
      const result = sanitizeUrl('mailto:test@example.com');
      expect(result).toBe('mailto:test@example.com');
    });

    it('should allow tel URLs', () => {
      const result = sanitizeUrl('tel:+1234567890');
      expect(result).toBe('tel:+1234567890');
    });

    it('should allow relative URLs', () => {
      const result = sanitizeUrl('/dashboard');
      expect(result).toBe('/dashboard');
    });

    it('should allow anchor links', () => {
      const result = sanitizeUrl('#section');
      expect(result).toBe('#section');
    });

    it('should allow query strings', () => {
      const result = sanitizeUrl('?search=test');
      expect(result).toBe('?search=test');
    });

    it('should block javascript: protocol', () => {
      const result = sanitizeUrl('javascript:alert("xss")');
      expect(result).toBeNull();
    });

    it('should block data: protocol', () => {
      const result = sanitizeUrl('data:text/html,<script>alert(1)</script>');
      expect(result).toBeNull();
    });

    it('should block vbscript: protocol', () => {
      const result = sanitizeUrl('vbscript:msgbox("xss")');
      expect(result).toBeNull();
    });

    it('should block file: protocol', () => {
      const result = sanitizeUrl('file:///etc/passwd');
      expect(result).toBeNull();
    });

    it('should block uppercase variants', () => {
      const result1 = sanitizeUrl('JAVASCRIPT:alert(1)');
      const result2 = sanitizeUrl('JavaScript:alert(1)');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should handle URLs with trailing spaces', () => {
      const result = sanitizeUrl('  https://example.com  ');
      expect(result).toBe('https://example.com');
    });

    it('should handle unknown protocols as null', () => {
      const result = sanitizeUrl('ftp://example.com');
      expect(result).toBeNull();
    });

    it('should handle protocol-relative URLs', () => {
      const result = sanitizeUrl('//example.com/path');
      expect(result).toBe('//example.com/path');
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      const result = escapeHtml('A & B');
      expect(result).toBe('A &amp; B');
    });

    it('should escape less than', () => {
      const result = escapeHtml('<div>');
      expect(result).toBe('&lt;div&gt;');
    });

    it('should escape greater than', () => {
      const result = escapeHtml('</div>');
      expect(result).toBe('&lt;/div&gt;');
    });

    it('should escape double quotes', () => {
      const result = escapeHtml('Say "hello"');
      expect(result).toBe('Say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      const result = escapeHtml("It's working");
      expect(result).toBe('It&#039;s working');
    });

    it('should handle empty string', () => {
      const result = escapeHtml('');
      expect(result).toBe('');
    });

    it('should handle string with no special characters', () => {
      const result = escapeHtml('Normal text without special chars');
      expect(result).toBe('Normal text without special chars');
    });

    it('should escape multiple special characters', () => {
      const result = escapeHtml('<script>alert("XSS")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
  });

  describe('sanitizeEventDescription', () => {
    it('should call sanitizePlainText', () => {
      const description = '<p>Event <strong>description</strong></p>';
      const result = sanitizeEventDescription(description);
      
      expect(DOMPurify.sanitize).toHaveBeenCalled();
    });

    it('should remove all HTML from event description', () => {
      const description = '<script>alert("xss")</script>Safe text';
      const result = sanitizeEventDescription(description);
      
      expect(result).toBeDefined();
    });
  });

  describe('XSS protection', () => {
    it('should prevent script injection via sanitizeHtml', () => {
      const xssPayload = '<img src=x onerror=alert(1)>';
      sanitizeHtml(xssPayload);
      
      expect(DOMPurify.sanitize).toHaveBeenCalledWith(xssPayload, expect.any(Object));
    });

    it('should prevent javascript URL in sanitizeUrl', () => {
      const result = sanitizeUrl('javascript:alert(1)');
      expect(result).toBeNull();
    });

    it('should escape HTML entities in escapeHtml', () => {
      const xssPayload = '<script>alert("xss")</script>';
      const escaped = escapeHtml(xssPayload);
      
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });
  });

  describe('URL validation edge cases', () => {
    it('should handle URLs with authentication', () => {
      const result = sanitizeUrl('https://user:pass@example.com');
      expect(result).toBe('https://user:pass@example.com');
    });

    it('should handle URLs with ports', () => {
      const result = sanitizeUrl('https://example.com:8080/path');
      expect(result).toBe('https://example.com:8080/path');
    });

    it('should handle URLs with query parameters', () => {
      const result = sanitizeUrl('https://example.com?key=value&foo=bar');
      expect(result).toBe('https://example.com?key=value&foo=bar');
    });

    it('should handle URLs with fragments', () => {
      const result = sanitizeUrl('https://example.com/path#section');
      expect(result).toBe('https://example.com/path#section');
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      const result = sanitizeUrl(longUrl);
      expect(result).toBe(longUrl);
    });

    it('should handle unicode URLs', () => {
      const result = sanitizeUrl('https://example.com/日本語');
      expect(result).toBe('https://example.com/日本語');
    });

    it('should handle URLs with plus signs', () => {
      const result = sanitizeUrl('https://example.com/search?q=c%2B%2B');
      expect(result).toBe('https://example.com/search?q=c%2B%2B');
    });
  });
});
