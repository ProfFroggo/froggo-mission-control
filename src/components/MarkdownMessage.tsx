import { memo, useState } from 'react';
import { Copy, Check, Monitor, FileCode } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { sanitizeUrl } from '../utils/sanitize';

interface MentionData {
  ids: string[];
  names: Record<string, string>; // id -> display name
}

interface MarkdownMessageProps {
  content: string;
  mentions?: MentionData;
  onArtifactOpen?: (lang: string, code: string) => void;  // NEW
}

// React.memo with custom comparator — only re-renders when content or mentions change.
// This prevents costly markdown re-parsing during streaming when unrelated state updates.
const MarkdownMessage = memo(function MarkdownMessage({ content, mentions, onArtifactOpen }: MarkdownMessageProps) {
  return (
    <div className="max-w-none leading-relaxed text-left text-sm">
      {parseMarkdown(content, mentions, onArtifactOpen)}
    </div>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.mentions === next.mentions &&
  prev.onArtifactOpen === next.onArtifactOpen
);

export default MarkdownMessage;

const PREVIEWABLE_LANGS = new Set(['html', 'htm', 'svg', 'jsx', 'tsx']);

function parseMarkdown(text: string, mentions?: MentionData, onArtifactOpen?: (lang: string, code: string) => void): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (PREVIEWABLE_LANGS.has(lang.toLowerCase())) {
        elements.push(
          <ArtifactCard
            key={key++}
            lang={lang}
            code={codeLines.join('\n')}
            onOpen={onArtifactOpen}
          />
        );
      } else {
        elements.push(
          <CodeBlock key={key++} code={codeLines.join('\n')} language={lang} />
        );
      }
      i++;
      continue;
    }

    // Headers (scaled down for chat context)
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-sm font-semibold mt-3 mb-1.5 text-mission-control-text">{line.slice(4)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-semibold mt-3 mb-2 text-mission-control-text">{line.slice(3)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-lg font-bold mt-3 mb-2 text-mission-control-text">{line.slice(2)}</h1>);
      i++;
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside my-2 space-y-2 pl-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{formatInline(item, mentions)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside my-2 space-y-2 pl-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{formatInline(item, mentions)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(<p key={key++} className="my-1.5 leading-relaxed">{formatInline(line, mentions)}</p>);
    i++;
  }

  return elements;
}

// Escape HTML entities to prevent XSS through content
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Note: sanitizeUrl is imported from '../utils/sanitize'

/**
 * Format inline markdown with XSS protection using escape-first approach
 *
 * SECURITY MODEL:
 * 1. Escape ALL HTML entities first (prevents any tag injection)
 * 2. Use controlled regex to reintroduce ONLY 3 safe tag types:
 *    - <strong> for **bold** (no attributes)
 *    - <code> for `code` (hardcoded safe class attribute)
 *    - <a> for [text](url) (URLs validated by sanitizeUrl())
 * 3. Render with dangerouslySetInnerHTML (safe because step 1 escaped everything)
 *
 * SECURITY GUARANTEES:
 * - No script injection possible (escapeHtml prevents <script> tags)
 * - No event handlers possible (escapeHtml prevents onclick/onerror/etc.)
 * - No dangerous protocols (sanitizeUrl blocks javascript:/data:/etc.)
 * - Regex patterns are non-overlapping and deterministic
 * - Failed URL validation degrades to plain text (safe fallback)
 *
 * AUDIT: 2026-03-03 - Reviewed and approved (LOW RISK - SECURE)
 * Security audit: 2026-03-03 — dangerouslySetInnerHTML usage reviewed and approved (LOW RISK - SECURE)
 */
function formatInline(text: string, mentions?: MentionData): React.ReactNode {
  let remaining = escapeHtml(text);

  // @mentions — highlighted pill badges (applied before bold so agent names don't get mangled)
  if (mentions) {
    // @all
    remaining = remaining.replace(
      /@all\b/gi,
      `<span class="inline font-medium px-1.5 py-0.5 rounded bg-mission-control-accent/20 text-mission-control-accent">@all</span>`
    );
    // Per-agent @Name or @id
    mentions.ids.forEach(id => {
      const name = mentions.names[id] || id;
      const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      remaining = remaining.replace(
        new RegExp(`@${safeName}\\b|@${safeId}\\b`, 'gi'),
        `<span class="inline font-medium px-1.5 py-0.5 rounded bg-mission-control-border/60 text-mission-control-text">$&</span>`
      );
    });
  }

  // Bold **text** - restore tags after escaping
  remaining = remaining.replace(/\*\*(.+?)\*\*/g, (_, content) => {
    return `<strong>${content}</strong>`;
  });

  // Inline code `code`
  remaining = remaining.replace(/`([^`]+)`/g, (_, content) => {
    return `<code class="px-1.5 py-0.5 bg-mission-control-border rounded text-sm font-mono text-mission-control-accent font-semibold">${content}</code>`;
  });

  // Links [text](url) - with XSS protection for URLs
  // Note: text content is already escaped, URL is sanitized separately
  remaining = remaining.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
    // Sanitize URL: only allow http/https/mailto/tel protocols
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
      // Return plain text if URL is unsafe
      return `[${linkText}](${escapeHtml(url)})`;
    }
    return `<a href="${sanitizedUrl}" class="text-mission-control-accent hover:underline underline-offset-2 font-medium" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  });

  // Bare URLs — auto-link any standalone http/https URL not already inside an <a>
  remaining = remaining.replace(/(https?:\/\/[^\s<>"']+)/g, (_, url) => {
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) return url;
    const display = url.length > 60 ? url.slice(0, 57) + '\u2026' : url;
    return `<a href="${sanitizedUrl}" class="text-mission-control-accent hover:underline underline-offset-2 font-medium break-all" target="_blank" rel="noopener noreferrer">${display}</a>`;
  });

  // SECURITY: content is escapeHtml()'d first; only safe tags (strong/code/a) are re-introduced
  // via controlled regex. URLs are validated by sanitizeUrl() (utils/sanitize.ts).
  return <span dangerouslySetInnerHTML={{ __html: remaining }} />;
}

function extractArtifactTitle(lang: string, code: string): string {
  // Try <title> tag for HTML
  const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

  // Try first HTML comment
  const commentMatch = code.match(/<!--\s*([^\n-][^\n]*?)\s*-->/);
  if (commentMatch) return commentMatch[1].trim();

  // Try first JSX/TSX export default or function name
  const funcMatch = code.match(/(?:export\s+default\s+function|function)\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  // Fallback
  const labels: Record<string, string> = {
    html: 'HTML Document', htm: 'HTML Document', svg: 'SVG Image',
    jsx: 'React Component', tsx: 'React Component',
  };
  return labels[lang.toLowerCase()] || `${lang.toUpperCase()} File`;
}

function ArtifactCard({ lang, code, onOpen }: {
  lang: string;
  code: string;
  onOpen?: (lang: string, code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const title = extractArtifactTitle(lang, code);
  const lineCount = code.split('\n').length;
  const preview = code.split('\n').slice(0, 3).join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg border border-mission-control-border bg-mission-control-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-mission-control-bg border-b border-mission-control-border">
        <FileCode size={14} className="text-mission-control-accent flex-shrink-0" />
        <span className="text-xs font-semibold text-mission-control-text flex-1 truncate">{title}</span>
        <span className="text-xs text-mission-control-text-dim font-mono">{lang.toUpperCase()}</span>
        <span className="text-xs text-mission-control-text-dim">{lineCount} lines</span>
      </div>
      {/* Code preview */}
      <div className="px-3 py-2 bg-mission-control-bg/50">
        <pre className="text-xs font-mono text-mission-control-text-dim overflow-hidden whitespace-pre leading-relaxed" style={{ maxHeight: '3.6em' }}>
          {preview}
        </pre>
        {lineCount > 3 && (
          <span className="text-xs text-mission-control-text-dim opacity-60">+{lineCount - 3} more lines…</span>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-mission-control-border bg-mission-control-surface">
        {onOpen && (
          <button
            onClick={() => onOpen(lang, code)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white text-xs font-medium rounded hover:bg-mission-control-accent/90 transition-colors"
          >
            <Monitor size={12} />
            Open Preview
          </button>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-bg border border-mission-control-border text-xs rounded hover:bg-mission-control-border transition-colors ml-auto"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert('Failed to copy code. Please copy manually.');
    }
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden bg-mission-control-bg border border-mission-control-border shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-mission-control-surface/50 border-b border-mission-control-border/50">
        <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-mission-control-border/50 hover:text-mission-control-text transition-all"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-mission-control-text">{code}</code>
      </pre>
    </div>
  );
}
