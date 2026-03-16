import { memo, useState, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink, FileCode, GitBranch, FileJson, FileText as FileTextIcon } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { sanitizeUrl } from '../utils/sanitize';

interface MentionData {
  ids: string[];
  names: Record<string, string>;
}

interface MarkdownMessageProps {
  content: string;
  mentions?: MentionData;
  onArtifactOpen?: (lang: string, code: string) => void;
  streaming?: boolean;
}

const MarkdownMessage = memo(function MarkdownMessage({ content, mentions, onArtifactOpen, streaming }: MarkdownMessageProps) {
  if (!content) return null;

  // Strip leaked tool XML
  const cleaned = content
    .replace(/<tool_request\b[^>]*\/>/g, '')
    .replace(/<tool_request\b[^>]*>[\s\S]*?<\/tool_request>/g, '')
    .replace(/<tool_result\b[^>]*>[\s\S]*?<\/tool_result>/g, '')
    .trim();

  return (
    <div className="max-w-none leading-relaxed text-left text-sm break-words" style={{ overflowWrap: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-mission-control-text">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 text-mission-control-text">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-mission-control-text">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-medium mt-2 mb-1 text-mission-control-text">{children}</h4>,
          h5: ({ children }) => <h5 className="text-sm font-medium mt-2 mb-1 text-mission-control-text-dim">{children}</h5>,
          h6: ({ children }) => <h6 className="text-xs font-medium mt-2 mb-1 text-mission-control-text-dim">{children}</h6>,

          // Paragraphs
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,

          // Lists
          ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1 pl-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // Tables
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-mission-control-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-mission-control-surface">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children, ...props }) => {
            const rowIndex = (props as Record<string, unknown>)['data-row-index'];
            return <tr className={typeof rowIndex === 'number' && rowIndex % 2 !== 0 ? 'bg-mission-control-surface/30' : ''}>{children}</tr>;
          },
          th: ({ children }) => <th className="px-3 py-2 text-left font-medium text-mission-control-text border-b border-mission-control-border whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-mission-control-text border-t border-mission-control-border/50">{children}</td>,

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 border-l-2 border-mission-control-accent/40 text-mission-control-text-dim italic">{children}</blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-3 border-mission-control-border" />,

          // Code
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = match || (typeof children === 'string' && children.includes('\n'));

            if (isBlock) {
              const lang = match?.[1] || '';
              const code = String(children).replace(/\n$/, '');

              if (!streaming && onArtifactOpen && PREVIEWABLE_LANGS.has(lang.toLowerCase())) {
                return <ArtifactCard lang={lang} code={code} onOpen={onArtifactOpen} />;
              }
              return <CodeBlock code={code} language={lang} />;
            }

            return (
              <code className="px-1.5 py-0.5 bg-mission-control-border rounded text-sm font-mono text-mission-control-accent font-semibold" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,

          // Links
          a: ({ href, children }) => {
            const safe = href ? sanitizeUrl(href) : null;
            if (!safe) return <span>{children}</span>;
            return (
              <a href={safe} className="text-mission-control-accent hover:underline underline-offset-2 font-medium" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },

          // Images
          img: (props: ComponentPropsWithoutRef<'img'>) => {
            const safe = typeof props.src === 'string' ? sanitizeUrl(props.src) : null;
            if (!safe) return null;
            return <img {...props} src={safe} className="max-w-full rounded-lg my-2 block" style={{ maxHeight: 480, objectFit: 'contain' }} />;
          },

          // Strong / Em
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,

          // Task lists (GFM)
          input: (props: ComponentPropsWithoutRef<'input'>) => (
            <input {...props} disabled className="mr-1.5 accent-mission-control-accent" />
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.mentions === next.mentions &&
  prev.onArtifactOpen === next.onArtifactOpen &&
  prev.streaming === next.streaming
);

export default MarkdownMessage;

const PREVIEWABLE_LANGS = new Set(['html', 'htm', 'svg', 'jsx', 'tsx', 'react']);

function extractArtifactTitle(lang: string, code: string): string {
  const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const commentMatch = code.match(/<!--\s*([^\n-][^\n]*?)\s*-->/);
  if (commentMatch) return commentMatch[1].trim();
  const funcMatch = code.match(/(?:export\s+default\s+function|function)\s+(\w+)/);
  if (funcMatch) return funcMatch[1];
  const labels: Record<string, string> = { html: 'HTML Document', htm: 'HTML Document', svg: 'SVG Image', jsx: 'React Component', tsx: 'React Component' };
  return labels[lang.toLowerCase()] || `${lang.toUpperCase()} File`;
}

function artifactIcon(lang: string) {
  const l = lang.toLowerCase();
  if (l === 'mermaid') return GitBranch;
  if (l === 'json') return FileJson;
  if (['md', 'markdown', 'txt', 'text'].includes(l)) return FileTextIcon;
  return FileCode;
}

function ArtifactCard({ lang, code, onOpen }: { lang: string; code: string; onOpen?: (lang: string, code: string) => void }) {
  const [copied, setCopied] = useState(false);
  const title = extractArtifactTitle(lang, code);
  const lineCount = code.split('\n').filter(l => l.trim()).length;
  const Icon = artifactIcon(lang);

  return (
    <div className="my-2 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40 transition-colors group">
      <Icon size={14} className="text-mission-control-accent flex-shrink-0" />
      <span className="text-xs font-medium text-mission-control-text flex-1 truncate">{title}</span>
      <span className="text-xs text-mission-control-text-dim font-mono opacity-60">{lang.toUpperCase()}</span>
      <span className="text-xs text-mission-control-text-dim opacity-50">{lineCount}L</span>
      <button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="p-1 rounded text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors opacity-0 group-hover:opacity-100" title="Copy code">
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
      {onOpen && (
        <button onClick={() => onOpen(lang, code)}
          className="flex items-center gap-1 px-2 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 text-xs rounded hover:bg-mission-control-accent hover:text-white transition-colors">
          <ExternalLink size={11} /> Open
        </button>
      )}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative my-3 rounded-lg overflow-hidden bg-mission-control-bg border border-mission-control-border shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-mission-control-surface/50 border-b border-mission-control-border/50">
        <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">{language || 'code'}</span>
        <button onClick={async () => { const ok = await copyToClipboard(code); if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded text-mission-control-text-dim hover:bg-mission-control-border/50 hover:text-mission-control-text transition-all" title="Copy code">
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-mission-control-text break-words whitespace-pre-wrap">{code}</code>
      </pre>
    </div>
  );
}
