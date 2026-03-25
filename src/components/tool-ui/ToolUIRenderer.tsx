"use client";
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ToolUIRenderer — parses JSON code blocks and renders tool-ui components.
 * Used by MarkdownMessage for `json` code blocks that have an `@type` field.
 *
 * Agent instructions to trigger a component:
 *   ```json
 *   { "@type": "stats-display", "stats": [...] }
 *   ```
 */
import { memo, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, CheckCircle2, Circle,
  Clock, Loader2, XCircle, SkipForward, ExternalLink,
  Copy, Check, AlertTriangle, ShieldAlert, Info, Zap,
  ListChecks, BarChart3, Terminal as TerminalIcon, FileText,
  Image as ImageIcon, Link2, Mail, MessageSquare, Globe,
  ChevronDown, ChevronRight, Play, CheckSquare,
} from 'lucide-react';
import {
  detectToolUIType, safeParseImage, safeParseStatsDisplay, safeParseDataTable,
  safeParseApprovalCard, safeParseTerminal, safeParsePlan, safeParseOptionList,
  safeParseLinkPreview, safeParseProgressTracker, safeParseMessageDraft,
  safeParseOrderSummary, safeParseCitation,
  type SerializableImage, type SerializableStatsDisplay, type SerializableDataTable,
  type SerializableApprovalCard, type SerializableTerminal, type SerializablePlan,
  type SerializableOptionList, type SerializableLinkPreview,
  type SerializableProgressTracker, type SerializableMessageDraft,
  type SerializableOrderSummary, type SerializableCitation,
} from './schemas';

// ─── Main entry point ────────────────────────────────────────────────────────

interface ToolUIRendererProps {
  jsonString: string;
}

export const ToolUIRenderer = memo(function ToolUIRenderer({ jsonString }: ToolUIRendererProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null; // Not JSON — fall through to regular code block
  }

  const type = detectToolUIType(parsed);
  if (!type) return null;

  switch (type) {
    case 'image': {
      const d = safeParseImage(parsed);
      return d ? <ImageComponent {...d} /> : null;
    }
    case 'stats-display': {
      const d = safeParseStatsDisplay(parsed);
      return d ? <StatsDisplay {...d} /> : null;
    }
    case 'data-table': {
      const d = safeParseDataTable(parsed);
      return d ? <DataTable {...d} /> : null;
    }
    case 'approval-card': {
      const d = safeParseApprovalCard(parsed);
      return d ? <ApprovalCard {...d} /> : null;
    }
    case 'terminal': {
      const d = safeParseTerminal(parsed);
      return d ? <TerminalBlock {...d} /> : null;
    }
    case 'plan': {
      const d = safeParsePlan(parsed);
      return d ? <PlanComponent {...d} /> : null;
    }
    case 'option-list': {
      const d = safeParseOptionList(parsed);
      return d ? <OptionList {...d} /> : null;
    }
    case 'link-preview': {
      const d = safeParseLinkPreview(parsed);
      return d ? <LinkPreview {...d} /> : null;
    }
    case 'progress-tracker': {
      const d = safeParseProgressTracker(parsed);
      return d ? <ProgressTracker {...d} /> : null;
    }
    case 'message-draft': {
      const d = safeParseMessageDraft(parsed);
      return d ? <MessageDraft {...d} /> : null;
    }
    case 'order-summary': {
      const d = safeParseOrderSummary(parsed);
      return d ? <OrderSummary {...d} /> : null;
    }
    case 'citation': {
      const d = safeParseCitation(parsed);
      return d ? <CitationList {...d} /> : null;
    }
    default:
      return null;
  }
});

// ─── Shared primitives ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--mission-control-border)] bg-[var(--mission-control-surface)] overflow-hidden my-2 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, icon }: { title?: string; subtitle?: string; icon?: React.ReactNode }) {
  if (!title && !subtitle) return null;
  return (
    <div className="px-4 pt-3 pb-2 border-b border-[var(--mission-control-border)]">
      <div className="flex items-center gap-2">
        {icon && <span className="flex-shrink-0 text-[var(--mission-control-accent)]">{icon}</span>}
        {title && <span className="text-sm font-semibold text-[var(--mission-control-text)]">{title}</span>}
      </div>
      {subtitle && <p className="text-xs text-[var(--mission-control-text-dim)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[var(--mission-control-text-dim)] hover:text-[var(--mission-control-text)] hover:bg-[var(--mission-control-border)]/40 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
    </button>
  );
}

const ACCENT_COLORS: Record<string, string> = {
  accent:  'var(--mission-control-accent)',
  blue:    '#60a5fa',
  violet:  '#a78bfa',
  amber:   '#fbbf24',
  rose:    '#fb7185',
  cyan:    '#22d3ee',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error:   'var(--color-error)',
  neutral: 'var(--mission-control-text-dim)',
};

// ─── Image ────────────────────────────────────────────────────────────────────

function ImageComponent({ src, alt, title, description, href, domain, ratio, fit, source, createdAt }: SerializableImage) {
  const aspectClass = ratio === '1:1' ? 'aspect-square' : ratio === '4:3' ? 'aspect-video' : ratio === '16:9' ? 'aspect-video' : ratio === '9:16' ? '' : '';
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  const Wrapper = href ? 'a' : 'div';
  const wrapperProps = href ? { href, target: '_blank' as const, rel: 'noopener noreferrer' } : {};

  return (
    <Card>
      <Wrapper {...wrapperProps} className="block group">
        <div className={`relative overflow-hidden bg-[var(--mission-control-bg)] ${aspectClass}`} style={ratio === '9:16' ? { paddingTop: '177.78%' } : {}}>
          <img
            src={src}
            alt={alt ?? title ?? ''}
            className={`${ratio === '9:16' ? 'absolute inset-0' : ''} w-full h-full ${fitClass} transition-transform duration-300 group-hover:scale-[1.02]`}
          />
          {/* Hover overlay */}
          {(title || description || source) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
              {title && <p className="text-white text-sm font-semibold leading-tight">{title}</p>}
              {description && <p className="text-white/80 text-xs mt-0.5 line-clamp-2">{description}</p>}
            </div>
          )}
        </div>
        {/* Footer */}
        {(source || domain || createdAt) && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--mission-control-border)]">
            {source?.iconUrl && <img src={source.iconUrl} alt="" className="w-3.5 h-3.5 rounded-sm" />}
            <span className="text-xs text-[var(--mission-control-text-dim)] flex-1 truncate">
              {source?.label ?? domain ?? ''}
            </span>
            {createdAt && (
              <span className="text-[10px] text-[var(--mission-control-text-dim)] opacity-60">
                {new Date(createdAt).toLocaleDateString()}
              </span>
            )}
            {href && <ExternalLink size={11} className="flex-shrink-0 text-[var(--mission-control-text-dim)]" />}
          </div>
        )}
      </Wrapper>
    </Card>
  );
}

// ─── Stats Display ────────────────────────────────────────────────────────────

function StatsDisplay({ title, subtitle, stats, layout = 'grid', period }: SerializableStatsDisplay) {
  const gridCols = stats.length <= 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle ?? period} icon={<BarChart3 size={14} />} />
      <div className={`p-3 ${layout === 'list' ? 'flex flex-col gap-2' : layout === 'row' ? 'flex flex-wrap gap-2' : `grid ${gridCols} gap-2`}`}>
        {stats.map((stat, i) => {
          const color = ACCENT_COLORS[stat.color ?? 'accent'] ?? ACCENT_COLORS.accent;
          const TrendIcon = stat.trend?.direction === 'up' ? TrendingUp : stat.trend?.direction === 'down' ? TrendingDown : Minus;
          const trendColor = stat.trend?.direction === 'up' ? 'var(--color-success)' : stat.trend?.direction === 'down' ? 'var(--color-error)' : 'var(--mission-control-text-dim)';

          return (
            <div
              key={i}
              className="rounded-lg p-3 border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />
              <p className="text-[11px] font-medium text-[var(--mission-control-text-dim)] truncate mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[var(--mission-control-text)] tabular-nums leading-none">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </span>
                {stat.unit && <span className="text-xs text-[var(--mission-control-text-dim)]">{stat.unit}</span>}
              </div>
              {stat.trend && (
                <div className="flex items-center gap-1 mt-1.5">
                  <TrendIcon size={11} style={{ color: trendColor }} />
                  <span className="text-[10px] font-medium" style={{ color: trendColor }}>{stat.trend.value}</span>
                  {stat.trend.label && <span className="text-[10px] text-[var(--mission-control-text-dim)]">{stat.trend.label}</span>}
                </div>
              )}
              {stat.description && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-1 opacity-70">{stat.description}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────

function DataTable({ title, columns, rows, footer, caption, searchable }: SerializableDataTable) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = rows.filter(row => {
    if (!search) return true;
    return Object.values(row).some(v =>
      String(v ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }).sort((a, b) => {
    if (!sortKey) return 0;
    const av = String(a[sortKey] ?? '');
    const bv = String(b[sortKey] ?? '');
    const cmp = av.localeCompare(bv, undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const renderCell = (col: (typeof columns)[0], value: unknown) => {
    if (value === null || value === undefined) return <span className="text-[var(--mission-control-text-dim)] opacity-40">—</span>;
    const str = String(value);
    if (col.type === 'boolean') {
      return value ? <CheckCircle2 size={13} className="text-[var(--color-success)]" /> : <XCircle size={13} className="text-[var(--mission-control-text-dim)] opacity-40" />;
    }
    if (col.type === 'badge') {
      return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--mission-control-accent)]/10 text-[var(--mission-control-accent)] border border-[var(--mission-control-accent)]/20">{str}</span>;
    }
    if (col.type === 'link') {
      return <a href={str} target="_blank" rel="noopener noreferrer" className="text-[var(--mission-control-accent)] hover:underline underline-offset-2 text-xs truncate max-w-[160px] block">{str}</a>;
    }
    if (col.type === 'currency') {
      const num = parseFloat(str);
      return isNaN(num) ? str : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return <span className="truncate max-w-[200px] block">{str}</span>;
  };

  return (
    <Card>
      <div className="px-4 py-2.5 border-b border-[var(--mission-control-border)] flex items-center gap-2">
        <BarChart3 size={13} className="text-[var(--mission-control-accent)] flex-shrink-0" />
        {title && <span className="text-sm font-semibold text-[var(--mission-control-text)] flex-1">{title}</span>}
        <span className="text-[10px] text-[var(--mission-control-text-dim)] ml-auto">{filtered.length} rows</span>
        {searchable && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter..."
            className="text-xs px-2 py-0.5 rounded border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)] text-[var(--mission-control-text)] outline-none focus:border-[var(--mission-control-accent)] w-28"
          />
        )}
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--mission-control-surface)] z-10">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--mission-control-text-dim)] border-b border-[var(--mission-control-border)] whitespace-nowrap text-${col.align ?? 'left'} ${col.sortable !== false ? 'cursor-pointer hover:text-[var(--mission-control-text)] select-none' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-[var(--mission-control-accent)]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} className="border-b border-[var(--mission-control-border)]/40 hover:bg-[var(--mission-control-bg)]/40 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={`px-3 py-2 text-[var(--mission-control-text)] text-${col.align ?? 'left'}`}>
                    {renderCell(col, row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-[var(--mission-control-text-dim)] text-xs">
                  No results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(footer || caption) && (
        <div className="px-3 py-2 border-t border-[var(--mission-control-border)] text-[10px] text-[var(--mission-control-text-dim)]">
          {footer ?? caption}
        </div>
      )}
    </Card>
  );
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({ title, description, action, details, risk, requester, expiresAt, confirmLabel, cancelLabel }: SerializableApprovalCard) {
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

  const riskColors: Record<string, string> = {
    low: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20',
    medium: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20',
    high: 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20',
    critical: 'text-[var(--color-error)] bg-[var(--color-error)]/15 border-[var(--color-error)]/30',
  };
  const RiskIcon = risk === 'critical' || risk === 'high' ? ShieldAlert : risk === 'medium' ? AlertTriangle : Info;

  return (
    <Card className="border-[var(--color-warning)]/25">
      {/* Top accent */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--color-warning)] to-[var(--color-warning)]/30" />
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-[var(--color-warning)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--mission-control-text)]">{title}</span>
              {risk && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${riskColors[risk]}`}>
                  <RiskIcon size={9} />
                  {risk} risk
                </span>
              )}
            </div>
            {description && <p className="text-xs text-[var(--mission-control-text-dim)] mt-0.5">{description}</p>}
          </div>
        </div>

        {/* Action */}
        <div className="rounded-lg bg-[var(--mission-control-bg)] border border-[var(--mission-control-border)] px-3 py-2 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mission-control-text-dim)] mb-1">Action</p>
          <p className="text-xs font-mono text-[var(--mission-control-text)]">{action}</p>
        </div>

        {/* Details */}
        {details && details.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {details.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-[var(--mission-control-text-dim)] flex-shrink-0">{d.label}</span>
                <span className={`text-right font-medium ${d.critical ? 'text-[var(--color-error)]' : 'text-[var(--mission-control-text)]'}`}>{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Meta */}
        {(requester || expiresAt) && (
          <div className="flex items-center gap-3 text-[10px] text-[var(--mission-control-text-dim)] mb-3 pb-3 border-b border-[var(--mission-control-border)]">
            {requester && <span>Requested by <span className="font-medium text-[var(--mission-control-text)]">{requester}</span></span>}
            {expiresAt && <span className="flex items-center gap-1"><Clock size={9} />Expires {new Date(expiresAt).toLocaleString()}</span>}
          </div>
        )}

        {/* CTA */}
        {!decided ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDecided('approved')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/25 hover:bg-[var(--color-success)]/20 transition-colors"
            >
              <CheckCircle2 size={12} />
              {confirmLabel ?? 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setDecided('rejected')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/25 hover:bg-[var(--color-error)]/20 transition-colors"
            >
              <XCircle size={12} />
              {cancelLabel ?? 'Reject'}
            </button>
          </div>
        ) : (
          <div className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium ${decided === 'approved' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'}`}>
            {decided === 'approved' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {decided === 'approved' ? 'Approved' : 'Rejected'}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

function TerminalBlock({ title, command, output, exitCode, shell, duration, collapsed: initCollapsed }: SerializableTerminal) {
  const [open, setOpen] = useState(!initCollapsed);
  const isSuccess = exitCode === undefined || exitCode === 0;
  const ExitIcon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <Card className="font-mono">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-[var(--mission-control-bg)] hover:bg-[var(--mission-control-bg)] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <TerminalIcon size={12} className="text-[var(--mission-control-accent)] flex-shrink-0" />
        <span className="text-xs font-medium text-[var(--mission-control-text)] flex-1 truncate">
          {title ?? command ?? 'Terminal output'}
        </span>
        <ExitIcon size={11} className={isSuccess ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'} />
        {exitCode !== undefined && (
          <span className={`text-[10px] font-medium ${isSuccess ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            exit {exitCode}
          </span>
        )}
        {duration !== undefined && (
          <span className="text-[10px] text-[var(--mission-control-text-dim)]">{duration}ms</span>
        )}
        <div className="flex-shrink-0">
          <CopyButton text={output} />
        </div>
        <ChevronRight size={11} className="text-[var(--mission-control-text-dim)] flex-shrink-0 transition-transform duration-150" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      </div>
      {open && (
        <>
          {command && (
            <div className="px-3 py-1.5 border-t border-[var(--mission-control-border)] bg-[var(--mission-control-bg)]/50">
              <span className="text-[10px] text-[var(--mission-control-accent)] mr-2 select-none">{shell ?? '$'}</span>
              <span className="text-xs text-[var(--mission-control-text)]">{command}</span>
            </div>
          )}
          <div className="px-3 py-2 border-t border-[var(--mission-control-border)] max-h-[360px] overflow-y-auto">
            <pre className="text-[11px] leading-relaxed text-[var(--mission-control-text)] whitespace-pre-wrap break-all">
              {output}
            </pre>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

function PlanComponent({ title, description, steps, currentStep, estimatedDuration, tags }: SerializablePlan) {
  const statusConfig = {
    'pending':     { icon: Circle,        color: 'text-[var(--mission-control-text-dim)]', bg: 'bg-[var(--mission-control-border)]/30' },
    'in-progress': { icon: Loader2,       color: 'text-[var(--color-info)]', bg: 'bg-[var(--color-info)]/10', spin: true },
    'done':        { icon: CheckCircle2,  color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10' },
    'skipped':     { icon: SkipForward,   color: 'text-[var(--mission-control-text-dim)] opacity-50', bg: 'bg-[var(--mission-control-border)]/20' },
    'blocked':     { icon: XCircle,       color: 'text-[var(--color-error)]', bg: 'bg-[var(--color-error)]/10' },
  };

  const doneCount = steps.filter(s => s.status === 'done').length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={description ?? (estimatedDuration ? `Est. ${estimatedDuration}` : undefined)}
        icon={<ListChecks size={14} />}
      />
      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-[var(--mission-control-border)]">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--mission-control-border)]">
            <div
              className="h-full rounded-full bg-[var(--mission-control-accent)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-[var(--mission-control-text-dim)] tabular-nums">{doneCount}/{steps.length}</span>
        </div>
        {tags && tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-accent)]/10 text-[var(--mission-control-accent)] border border-[var(--mission-control-accent)]/20">{tag}</span>
            ))}
          </div>
        )}
      </div>
      {/* Steps */}
      <div className="p-3 space-y-1.5">
        {steps.map((step, i) => {
          const s = step.status ?? (i < (currentStep ?? 0) ? 'done' : i === (currentStep ?? 0) ? 'in-progress' : 'pending');
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          const isActive = s === 'in-progress';

          return (
            <div key={i} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${isActive ? cfg.bg : 'hover:bg-[var(--mission-control-bg)]/40'} transition-colors`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                <Icon size={11} className={`${cfg.color} ${(cfg as any).spin ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${s === 'done' ? 'line-through text-[var(--mission-control-text-dim)] opacity-60' : s === 'skipped' ? 'line-through opacity-50 text-[var(--mission-control-text-dim)]' : 'text-[var(--mission-control-text)]'}`}>
                  {step.label}
                </span>
                {step.description && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-0.5">{step.description}</p>}
                {step.substeps && step.substeps.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {step.substeps.map((sub, j) => (
                      <li key={j} className="text-[10px] text-[var(--mission-control-text-dim)] pl-2 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[var(--mission-control-border)] flex-shrink-0" />
                        {sub}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {step.tool && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-border)]/50 text-[var(--mission-control-text-dim)] font-mono">{step.tool}</span>
                )}
                {step.duration && (
                  <span className="text-[9px] text-[var(--mission-control-text-dim)] opacity-60">{step.duration}</span>
                )}
                <span className="text-[10px] text-[var(--mission-control-text-dim)] opacity-40 tabular-nums w-5 text-right">{i + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Option List ──────────────────────────────────────────────────────────────

function OptionList({ question, description, options, multiple }: SerializableOptionList) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const toggle = (id: string) => {
    if (confirmed) return;
    if (!multiple) {
      setSelected(new Set([id]));
      setTimeout(() => setConfirmed(true), 300);
      return;
    }
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <Card>
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[var(--mission-control-text)] mb-0.5">{question}</p>
        {description && <p className="text-xs text-[var(--mission-control-text-dim)] mb-3">{description}</p>}
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        {options.map(opt => {
          const isSelected = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={opt.disabled || confirmed}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-[var(--mission-control-accent)] bg-[var(--mission-control-accent)]/8'
                  : 'border-[var(--mission-control-border)] hover:border-[var(--mission-control-accent)]/40 hover:bg-[var(--mission-control-bg)]/50'
              } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${isSelected ? 'border-[var(--mission-control-accent)] bg-[var(--mission-control-accent)]' : 'border-[var(--mission-control-border)]'}`}>
                {isSelected && <Check size={9} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium ${isSelected ? 'text-[var(--mission-control-accent)]' : 'text-[var(--mission-control-text)]'}`}>{opt.label}</span>
                  {opt.recommended && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-accent)]/12 text-[var(--mission-control-accent)] border border-[var(--mission-control-accent)]/20 font-medium">recommended</span>
                  )}
                  {opt.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-border)]/60 text-[var(--mission-control-text-dim)]">{opt.badge}</span>
                  )}
                </div>
                {opt.description && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-0.5">{opt.description}</p>}
              </div>
            </button>
          );
        })}
        {multiple && selected.size > 0 && !confirmed && (
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className="w-full mt-1 py-2 rounded-lg text-xs font-medium bg-[var(--mission-control-accent)] text-white transition-opacity hover:opacity-90"
          >
            Confirm {selected.size} selection{selected.size > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </Card>
  );
}

// ─── Link Preview ─────────────────────────────────────────────────────────────

function LinkPreview({ url, title, description, image, domain, favicon, type, readTime, publishedAt, author }: SerializableLinkPreview) {
  const displayDomain = domain ?? (url ? new URL(url).hostname.replace('www.', '') : '');

  return (
    <Card>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:bg-[var(--mission-control-bg)]/40 transition-colors group">
        <div className="flex gap-3 p-3">
          <div className="flex-1 min-w-0 space-y-1">
            {/* Source */}
            <div className="flex items-center gap-1.5">
              {favicon && <img src={favicon} alt="" className="w-3.5 h-3.5 rounded-sm flex-shrink-0" />}
              <span className="text-[10px] text-[var(--mission-control-text-dim)] truncate">{displayDomain}</span>
              {type && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-border)]/50 text-[var(--mission-control-text-dim)] ml-auto flex-shrink-0">{type}</span>
              )}
            </div>
            {/* Title */}
            {title && (
              <p className="text-sm font-semibold text-[var(--mission-control-text)] line-clamp-2 group-hover:text-[var(--mission-control-accent)] transition-colors leading-snug">
                {title}
              </p>
            )}
            {/* Description */}
            {description && (
              <p className="text-[11px] text-[var(--mission-control-text-dim)] line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
            {/* Meta */}
            {(author || readTime || publishedAt) && (
              <div className="flex items-center gap-2 text-[10px] text-[var(--mission-control-text-dim)] pt-0.5">
                {author && <span>{author}</span>}
                {readTime && <span className="flex items-center gap-1"><Clock size={9} />{readTime}</span>}
                {publishedAt && <span>{publishedAt}</span>}
              </div>
            )}
          </div>
          {/* Thumbnail */}
          {image && (
            <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--mission-control-bg)]">
              <img src={image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-[var(--mission-control-border)] flex items-center gap-1 text-[10px] text-[var(--mission-control-text-dim)]">
          <Link2 size={9} />
          <span className="truncate">{url}</span>
          <ExternalLink size={9} className="ml-auto flex-shrink-0 opacity-60 group-hover:opacity-100" />
        </div>
      </a>
    </Card>
  );
}

// ─── Progress Tracker ─────────────────────────────────────────────────────────

function ProgressTracker({ title, description, progress, status, phase, steps, startedAt, estimatedDoneAt }: SerializableProgressTracker) {
  const statusConfig = {
    idle:    { color: 'var(--mission-control-text-dim)', label: 'Idle' },
    running: { color: 'var(--color-info)', label: 'Running' },
    done:    { color: 'var(--color-success)', label: 'Done' },
    failed:  { color: 'var(--color-error)', label: 'Failed' },
    paused:  { color: 'var(--color-warning)', label: 'Paused' },
  };
  const cfg = statusConfig[status ?? 'idle'];

  const stepStatusIcons = {
    pending: <Circle size={11} className="text-[var(--mission-control-text-dim)]" />,
    running: <Loader2 size={11} className="text-[var(--color-info)] animate-spin" />,
    done:    <CheckCircle2 size={11} className="text-[var(--color-success)]" />,
    failed:  <XCircle size={11} className="text-[var(--color-error)]" />,
    skipped: <SkipForward size={11} className="text-[var(--mission-control-text-dim)] opacity-50" />,
  };

  return (
    <Card>
      <CardHeader title={title} subtitle={description} icon={<Play size={13} />} />
      <div className="px-4 py-3">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 rounded-full bg-[var(--mission-control-border)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: cfg.color }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: cfg.color }}>{progress}%</span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-[var(--mission-control-text-dim)] mb-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
            {cfg.label}
          </span>
          {phase && <span>Phase: <span className="text-[var(--mission-control-text)]">{phase}</span></span>}
          {startedAt && <span><Clock size={9} className="inline mr-0.5" />{startedAt}</span>}
          {estimatedDoneAt && <span>ETA: {estimatedDoneAt}</span>}
        </div>

        {/* Steps */}
        {steps && steps.length > 0 && (
          <div className="space-y-1">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="flex-shrink-0 mt-0.5">{stepStatusIcons[step.status]}</span>
                <span className={`flex-1 ${step.status === 'done' ? 'line-through text-[var(--mission-control-text-dim)] opacity-60' : 'text-[var(--mission-control-text)]'}`}>
                  {step.label}
                  {step.detail && <span className="text-[var(--mission-control-text-dim)] ml-1">· {step.detail}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Message Draft ────────────────────────────────────────────────────────────

function MessageDraft({ platform, subject, to, cc, body, tone, wordCount, tags }: SerializableMessageDraft) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [body]);

  const platformIcons: Record<string, React.ReactNode> = {
    email: <Mail size={13} />,
    slack: <MessageSquare size={13} />,
    discord: <MessageSquare size={13} />,
    twitter: <Globe size={13} />,
    linkedin: <Globe size={13} />,
    sms: <MessageSquare size={13} />,
    chat: <MessageSquare size={13} />,
  };
  const PlatformIcon = platformIcons[platform ?? 'chat'] ?? <FileText size={13} />;

  const toneColors: Record<string, string> = {
    formal: '#60a5fa', casual: '#4ade80', urgent: '#fb7185',
    friendly: '#fbbf24', professional: '#a78bfa',
  };

  return (
    <Card>
      <div className="px-4 py-2.5 border-b border-[var(--mission-control-border)] flex items-center gap-2">
        <span className="text-[var(--mission-control-accent)]">{PlatformIcon}</span>
        <span className="text-sm font-semibold text-[var(--mission-control-text)] flex-1 truncate">
          {subject ?? `${platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Message'} Draft`}
        </span>
        {tone && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0" style={{ color: toneColors[tone] ?? 'var(--mission-control-text-dim)', borderColor: `${toneColors[tone] ?? 'var(--mission-control-border)'}30`, background: `${toneColors[tone] ?? 'var(--mission-control-border)'}12` }}>
            {tone}
          </span>
        )}
        <button type="button" onClick={copy} className="inline-flex items-center justify-center w-6 h-6 rounded text-[var(--mission-control-text-dim)] hover:text-[var(--mission-control-text)] transition-colors">
          {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
        </button>
      </div>

      {(to || cc) && (
        <div className="px-4 py-2 border-b border-[var(--mission-control-border)] space-y-1">
          {to && to.length > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-[var(--mission-control-text-dim)] w-6 flex-shrink-0">To</span>
              <span className="text-[var(--mission-control-text)]">{to.join(', ')}</span>
            </div>
          )}
          {cc && cc.length > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-[var(--mission-control-text-dim)] w-6 flex-shrink-0">Cc</span>
              <span className="text-[var(--mission-control-text)]">{cc.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <p className="text-xs text-[var(--mission-control-text)] leading-relaxed whitespace-pre-wrap">{body}</p>
      </div>

      {(tags || wordCount) && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          {wordCount && <span className="text-[10px] text-[var(--mission-control-text-dim)]">{wordCount} words</span>}
          {tags && tags.map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-border)]/50 text-[var(--mission-control-text-dim)]">{tag}</span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Order Summary ────────────────────────────────────────────────────────────

function OrderSummary({ title, items, note, cta }: SerializableOrderSummary) {
  const [ctaClicked, setCtaClicked] = useState(false);

  return (
    <Card>
      {title && (
        <div className="px-4 py-2.5 border-b border-[var(--mission-control-border)]">
          <p className="text-sm font-semibold text-[var(--mission-control-text)]">{title}</p>
        </div>
      )}
      <div className="px-4 py-3 space-y-1.5">
        {items.map((item, i) => {
          const isTotal = item.type === 'total';
          const isDiscount = item.type === 'discount';
          const isDivider = item.type === 'subtotal';

          return (
            <div key={i}>
              {isDivider && i > 0 && <div className="border-t border-[var(--mission-control-border)] my-1" />}
              <div className={`flex items-baseline justify-between gap-3 ${isTotal ? 'pt-1' : ''}`}>
                <div>
                  <span className={`text-xs ${isTotal ? 'font-semibold text-[var(--mission-control-text)]' : isDivider ? 'font-medium text-[var(--mission-control-text-dim)]' : 'text-[var(--mission-control-text)]'}`}>
                    {item.label}
                  </span>
                  {item.description && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-0.5">{item.description}</p>}
                </div>
                <span className={`text-xs tabular-nums flex-shrink-0 font-medium ${isDiscount ? 'text-[var(--color-success)]' : isTotal ? 'text-[var(--mission-control-accent)] text-sm font-bold' : 'text-[var(--mission-control-text)]'}`}>
                  {isDiscount && item.value && !item.value.startsWith('-') ? `-${item.value}` : item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <div className="px-4 pb-2 text-[10px] text-[var(--mission-control-text-dim)] italic">{note}</div>
      )}
      {cta && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setCtaClicked(true)}
            disabled={ctaClicked}
            className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${ctaClicked ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/25' : 'bg-[var(--mission-control-accent)] text-white hover:opacity-90'}`}
          >
            {ctaClicked ? <span className="flex items-center justify-center gap-1"><CheckCircle2 size={12} />Confirmed</span> : cta.label}
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── Citation ─────────────────────────────────────────────────────────────────

function CitationList({ sources, query }: SerializableCitation) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => setExpanded(prev => {
    const n = new Set(prev);
    n.has(i) ? n.delete(i) : n.add(i);
    return n;
  });

  return (
    <Card>
      <div className="px-4 py-2.5 border-b border-[var(--mission-control-border)] flex items-center gap-2">
        <Globe size={13} className="text-[var(--mission-control-accent)] flex-shrink-0" />
        <span className="text-sm font-semibold text-[var(--mission-control-text)] flex-1">
          {query ? `Sources: ${query}` : 'Sources'}
        </span>
        <span className="text-[10px] text-[var(--mission-control-text-dim)]">{sources.length} result{sources.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-[var(--mission-control-border)]/50">
        {sources.map((src, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-bold text-[var(--mission-control-text-dim)] w-4 flex-shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <a
                    href={src.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[var(--mission-control-text)] hover:text-[var(--mission-control-accent)] transition-colors line-clamp-1 flex-1"
                  >
                    {src.title}
                  </a>
                  {src.relevance !== undefined && (
                    <span className="text-[10px] text-[var(--mission-control-text-dim)] flex-shrink-0 tabular-nums">{Math.round(src.relevance * 100)}%</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {src.domain && <span className="text-[10px] text-[var(--mission-control-accent)]/70 truncate">{src.domain}</span>}
                  {src.author && <span className="text-[10px] text-[var(--mission-control-text-dim)]">{src.author}</span>}
                  {src.publishedAt && <span className="text-[10px] text-[var(--mission-control-text-dim)] opacity-60">{src.publishedAt}</span>}
                </div>
                {src.excerpt && (
                  <>
                    {expanded.has(i) && (
                      <p className="text-[11px] text-[var(--mission-control-text-dim)] mt-1.5 leading-relaxed">{src.excerpt}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      className="text-[10px] text-[var(--mission-control-accent)]/70 hover:text-[var(--mission-control-accent)] mt-0.5 transition-colors"
                    >
                      {expanded.has(i) ? 'Show less' : 'Show excerpt'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export {
  ImageComponent as ToolUIImage,
  StatsDisplay as ToolUIStatsDisplay,
  DataTable as ToolUIDataTable,
  ApprovalCard as ToolUIApprovalCard,
  TerminalBlock as ToolUITerminal,
  PlanComponent as ToolUIPlan,
  OptionList as ToolUIOptionList,
  LinkPreview as ToolUILinkPreview,
  ProgressTracker as ToolUIProgressTracker,
  MessageDraft as ToolUIMessageDraft,
  OrderSummary as ToolUIOrderSummary,
  CitationList as ToolUICitation,
};
