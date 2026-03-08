import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { sanitizeUrl } from '../utils/sanitize';

interface MentionData {
  ids: string[];
  names: Record<string, string>; // id -> display name
}

interface MarkdownMessageProps {
  content: string;
  mentions?: MentionData;
}

export default function MarkdownMessage({ content, mentions }: MarkdownMessageProps) {
  return (
    <div className="max-w-none leading-relaxed text-left text-sm">
      {parseMarkdown(content, mentions)}
    </div>
  );
}

function parseMarkdown(text: string, mentions?: MentionData): React.ReactNode[] {
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
      elements.push(
        <CodeBlock key={key++} code={codeLines.join('\n')} language={lang} />
      );
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
 * See: /Users/worker/mission-control-library/reports/dangerouslySetInnerHTML-security-audit-2026-03-03.md
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

  // SECURITY: content is escapeHtml()'d first; only safe tags (strong/code/a) are re-introduced
  // via controlled regex. URLs are validated by sanitizeUrl() (utils/sanitize.ts).
  return <span dangerouslySetInnerHTML={{ __html: remaining }} />;
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
