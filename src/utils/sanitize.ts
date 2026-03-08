import DOMPurify from 'dompurify';

/**
 * Security utility for sanitizing HTML content
 * Uses DOMPurify for robust XSS protection
 * 
 * SECURITY AUDIT: 2026-03-03 - All configurations reviewed and approved
 * See: /Users/worker/mission-control-library/reports/dangerouslySetInnerHTML-security-audit-2026-03-03.md
 */

// Configure DOMPurify with safe defaults
// SECURITY: Restrictive allowlist prevents script injection, event handlers, and dangerous protocols
const purifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'mark', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,        // Prevent data-* attribute abuse
  SANITIZE_DOM: true,             // Enable DOM clobbering protection
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
 * 
 * SECURITY GUARANTEES:
 * - Blocks <script>, <iframe>, <object>, <embed> tags
 * - Removes all event handlers (onclick, onerror, etc.)
 * - Prevents javascript:, data:, vbscript: protocols in hrefs
 * - Protection against DOM clobbering (SANITIZE_DOM: true)
 * - SSR fallback: strips all HTML on server-side
 * 
 * SAFE FOR: External messaging content (WhatsApp/Telegram/Discord/Email)
 * USE CASES: CommsInbox3Pane message display
 * 
 * @param html - User-generated HTML content to sanitize
 * @returns Sanitized HTML safe for dangerouslySetInnerHTML
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
 * 
 * SECURITY GUARANTEES:
 * - STRICTEST config: Only <mark> tags with class attribute allowed
 * - All other HTML tags stripped (including script/iframe/etc.)
 * - No event handlers possible (not in ALLOWED_ATTR)
 * - No hrefs/URLs allowed
 * - SSR fallback: explicitly handles only escaped <mark> tags
 * 
 * SAFE FOR: Backend-generated search results with highlighting
 * USE CASES: GlobalSearch result snippets
 * 
 * @param snippet - Search result snippet from backend (may contain <mark> tags)
 * @returns Sanitized HTML with only safe <mark> highlighting
 */
export function sanitizeSearchSnippet(snippet: string): string {
  if (typeof window === 'undefined') {
    // Escape HTML entities for SSR
    return snippet
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;mark&gt;/g, '<mark class="bg-mission-control-accent/30 text-mission-control-accent font-medium">')
      .replace(/&lt;\/mark&gt;/g, '</mark>');
  }
  return DOMPurify.sanitize(snippet, searchSnippetConfig);
}

/**
 * URL sanitization - prevents javascript: and data: XSS
 * 
 * SECURITY GUARANTEES:
 * - Blocks javascript:, data:, vbscript:, file: protocols
 * - Only allows http:, https:, mailto:, tel: absolute URLs
 * - Allows relative URLs (/, #, ?)
 * - Returns null for unsafe URLs (safe fallback for callers)
 * 
 * SAFE FOR: Markdown links, href attributes in sanitized HTML
 * USE CASES: MarkdownMessage link validation, href sanitization
 * 
 * @param url - URL to validate (from user input or external content)
 * @returns Original URL if safe, null if dangerous
 * 
 * @example
 * sanitizeUrl('https://example.com') // → 'https://example.com'
 * sanitizeUrl('javascript:alert(1)') // → null
 * sanitizeUrl('/relative/path')      // → '/relative/path'
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
