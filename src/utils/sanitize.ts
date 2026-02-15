import DOMPurify from 'dompurify';

/**
 * Security utility for sanitizing HTML content
 * Uses DOMPurify for robust XSS protection
 */

// Configure DOMPurify with safe defaults
const purifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'mark', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  SANITIZE_DOM: true,
};

// Strict config for inline content (no HTML tags allowed)
const strictConfig = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

// Config for search snippets (only mark tags allowed)
const searchSnippetConfig = {
  ALLOWED_TAGS: ['mark'],
  ALLOWED_ATTR: ['class'],
  KEEP_CONTENT: true,
};

/**
 * Sanitize HTML content for general use
 * Allows basic formatting tags but removes dangerous content
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback - strip all HTML
    return html.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * Strict sanitization - removes all HTML tags
 * Use for plain text content that should never have HTML
 */
export function sanitizePlainText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(html, strictConfig);
}

/**
 * Sanitize search snippets - only allows mark tags for highlighting
 */
export function sanitizeSearchSnippet(snippet: string): string {
  if (typeof window === 'undefined') {
    // Escape HTML entities for SSR
    return snippet
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;mark&gt;/g, '<mark class="bg-clawd-accent/30 text-clawd-accent font-medium">')
      .replace(/&lt;\/mark&gt;/g, '</mark>');
  }
  return DOMPurify.sanitize(snippet, searchSnippetConfig);
}

/**
 * URL sanitization - prevents javascript: and data: XSS
 */
export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  if (trimmed.startsWith('javascript:') || 
      trimmed.startsWith('data:') || 
      trimmed.startsWith('vbscript:') ||
      trimmed.startsWith('file:')) {
    return null;
  }
  
  // Allow safe protocols and relative URLs
  if (/^(https?|mailto|tel):/i.test(url) || 
      url.startsWith('/') || 
      url.startsWith('#') || 
      url.startsWith('?') ||
      !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url;
  }
  
  return null;
}

/**
 * Escape HTML entities for text content
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize event description - strips all HTML
 * Use for calendar event descriptions
 */
export function sanitizeEventDescription(description: string): string {
  return sanitizePlainText(description);
}
