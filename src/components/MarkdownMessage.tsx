import { memo, lazy, Suspense, useState, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/prism-light';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/cjs/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/cjs/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css';
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/cjs/languages/prism/sql';
import yaml from 'react-syntax-highlighter/dist/cjs/languages/prism/yaml';
import rust from 'react-syntax-highlighter/dist/cjs/languages/prism/rust';
import go from 'react-syntax-highlighter/dist/cjs/languages/prism/go';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('go', go);
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink, FileCode, GitBranch, FileJson, FileText as FileTextIcon } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { copyToClipboard } from '../utils/clipboard';
import { sanitizeUrl } from '../utils/sanitize';
import { detectToolUIType } from './tool-ui/detectToolUIType';

// Lazy-load ToolUIRenderer — it transitively imports recharts (~300KB),
// diff (~40KB), and 50+ lucide icons. Only needed when a JSON code block
// has an @type field, which is a rare conditional path.
const ToolUIRenderer = lazy(() =>
  import('./tool-ui/ToolUIRenderer').then(m => ({ default: m.ToolUIRenderer }))
);

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
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-sm border border-mission-control-border rounded-lg overflow-hidden">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-mission-control-surface">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children, ...props }) => {
            const rowIndex = (props as Record<string, unknown>)['data-row-index'];
            return <tr className={typeof rowIndex === 'number' && rowIndex % 2 !== 0 ? 'bg-mission-control-surface/30' : ''}>{children}</tr>;
          },
          th: ({ children }) => <th className="bg-mission-control-border/30 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim px-3 py-2 text-left border-b border-mission-control-border whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-mission-control-border/40 text-mission-control-text">{children}</td>,

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 border-l-2 border-mission-control-accent/40 text-mission-control-text-dim italic">{children}</blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-4 border-mission-control-border/40" />,

          // Code
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = match || (typeof children === 'string' && children.includes('\n'));

            if (isBlock) {
              const lang = match?.[1] || '';
              const code = String(children).replace(/\n$/, '');

              // Tool-UI: render JSON blocks with @type field as interactive components
              // ToolUIRenderer is lazy-loaded — only downloads recharts/diff when needed
              if (!streaming && lang.toLowerCase() === 'json') {
                try {
                  const parsed = JSON.parse(code);
                  if (detectToolUIType(parsed)) {
                    return (
                      <Suspense fallback={<div className="animate-pulse bg-mission-control-border rounded-lg h-24" />}>
                        <ToolUIRenderer jsonString={code} />
                      </Suspense>
                    );
                  }
                } catch { /* not valid JSON — fall through */ }
              }

              if (!streaming && onArtifactOpen && PREVIEWABLE_LANGS.has(lang.toLowerCase())) {
                return <ArtifactCard lang={lang} code={code} onOpen={onArtifactOpen} />;
              }
              return <CodeBlock code={code} language={lang} />;
            }

            return (
              <code className="bg-mission-control-bg font-mono text-xs px-1.5 py-0.5 rounded text-mission-control-accent" {...props}>
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
            return <img {...props} src={safe} alt={props.alt || 'Image'} className="max-w-full rounded-lg my-2 block" style={{ maxHeight: 480, objectFit: 'contain' }} />;
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
      <button
        type="button"
        onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        title="Copy code"
        aria-label="Copy code"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
      {onOpen && (
        <Button
          onClick={() => onOpen(lang, code)}
          size="1"
          variant="soft"
         
        >
          <ExternalLink size={11} /> Open
        </Button>
      )}
    </div>
  );
}

// Mission Control syntax theme — maps Prism token types to CSS variables
const MC_THEME: Record<string, CSSProperties> = {
  'code[class*="language-"]': { color: 'var(--color-mission-control-text, #e2e8f0)', background: 'transparent', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: '1.6', whiteSpace: 'pre' },
  'pre[class*="language-"]': { color: 'var(--color-mission-control-text, #e2e8f0)', background: 'transparent', margin: 0, padding: 0, overflow: 'auto' },
  'token.comment': { color: '#6b7a8d', fontStyle: 'italic' },
  'token.prolog': { color: '#6b7a8d' },
  'token.doctype': { color: '#6b7a8d' },
  'token.cdata': { color: '#6b7a8d' },
  'token.punctuation': { color: '#94a3b8' },
  'token.property': { color: '#7dd3fc' },
  'token.tag': { color: '#86efac' },
  'token.boolean': { color: '#f97316' },
  'token.number': { color: '#fb923c' },
  'token.constant': { color: '#fb923c' },
  'token.symbol': { color: '#fb923c' },
  'token.deleted': { color: '#f87171' },
  'token.selector': { color: '#86efac' },
  'token.attr-name': { color: '#7dd3fc' },
  'token.string': { color: '#86efac' },
  'token.char': { color: '#86efac' },
  'token.builtin': { color: '#818cf8' },
  'token.inserted': { color: '#86efac' },
  'token.operator': { color: '#94a3b8' },
  'token.entity': { color: '#fbbf24', cursor: 'help' },
  'token.url': { color: '#7dd3fc', textDecoration: 'underline' },
  'token.atrule': { color: '#a78bfa' },
  'token.attr-value': { color: '#86efac' },
  'token.keyword': { color: '#c084fc' },
  'token.function': { color: '#60a5fa' },
  'token.class-name': { color: '#fcd34d' },
  'token.regex': { color: '#fb923c' },
  'token.important': { color: '#f97316', fontWeight: 'bold' },
  'token.variable': { color: '#e2e8f0' },
  'token.bold': { fontWeight: 'bold' },
  'token.italic': { fontStyle: 'italic' },
};

const KNOWN_LANGS = new Set(['javascript','js','typescript','ts','jsx','tsx','python','py','bash','sh','shell','json','css','markdown','md','sql','yaml','yml','rust','rs','go']);

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const lang = language || 'text';
  const useSyntax = KNOWN_LANGS.has(lang.toLowerCase());

  return (
    <div className="relative my-3 rounded-lg overflow-hidden bg-mission-control-bg border border-mission-control-border shadow-sm group/code">
      {/* Header bar: language label left, copy button right */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-mission-control-border/20 border-b border-mission-control-border/50">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-mission-control-text-dim select-none">
          {lang}
        </span>
        <button
          type="button"
          onClick={async () => { const ok = await copyToClipboard(code); if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
          title="Copy code"
          aria-label="Copy code to clipboard"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors opacity-0 group-hover/code:opacity-100"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      {useSyntax ? (
        <SyntaxHighlighter
          language={lang.toLowerCase()}
          style={MC_THEME}
          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.8125rem', lineHeight: '1.6' }}
          codeTagProps={{ style: { fontFamily: 'var(--font-mono, ui-monospace, monospace)', whiteSpace: 'pre' } }}
          wrapLongLines={false}
          PreTag="div"
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="font-mono text-mission-control-text whitespace-pre">{code}</code>
        </pre>
      )}
    </div>
  );
}
