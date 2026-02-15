import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { sanitizeUrl } from '../utils/sanitize';

interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="max-w-none leading-relaxed text-left text-sm">
      {parseMarkdown(content)}
    </div>
  );
}

function parseMarkdown(text: string): React.ReactNode[] {
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
      elements.push(<h3 key={key++} className="text-sm font-semibold mt-3 mb-1.5 text-clawd-text">{line.slice(4)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-semibold mt-3 mb-2 text-clawd-text">{line.slice(3)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-lg font-bold mt-3 mb-2 text-clawd-text">{line.slice(2)}</h1>);
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
            <li key={idx} className="leading-relaxed">{formatInline(item)}</li>
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
            <li key={idx} className="leading-relaxed">{formatInline(item)}</li>
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
    elements.push(<p key={key++} className="my-1.5 leading-relaxed">{formatInline(line)}</p>);
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

function formatInline(text: string): React.ReactNode {
  let remaining = escapeHtml(text);

  // Bold **text** - restore tags after escaping
  remaining = remaining.replace(/\*\*(.+?)\*\*/g, (_, content) => {
    return `<strong>${content}</strong>`;
  });

  // Inline code `code`
  remaining = remaining.replace(/`([^`]+)`/g, (_, content) => {
    return `<code class="px-1.5 py-0.5 bg-clawd-border rounded text-sm font-mono text-clawd-accent font-semibold">${content}</code>`;
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
    return `<a href="${sanitizedUrl}" class="text-clawd-accent hover:underline underline-offset-2 font-medium" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  });

  return <span dangerouslySetInnerHTML={{ __html: remaining }} />;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden bg-clawd-bg border border-clawd-border shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-clawd-surface/50 border-b border-clawd-border/50">
        <span className="text-xs font-medium text-clawd-text-dim uppercase tracking-wide">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-clawd-border/50 hover:text-clawd-text transition-all"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-clawd-text">{code}</code>
      </pre>
    </div>
  );
}
