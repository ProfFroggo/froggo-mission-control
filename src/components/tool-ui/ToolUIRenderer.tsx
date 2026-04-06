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
import { memo, useState, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Minus, CheckCircle2, Circle,
  Clock, Loader2, XCircle, SkipForward, ExternalLink,
  Copy, Check, AlertTriangle, ShieldAlert, Info, Zap,
  ListChecks, BarChart3, Terminal as TerminalIcon, FileText,
  Image as ImageIcon, Link2, Mail, MessageSquare, Globe,
  ChevronDown, ChevronRight, Play, CheckSquare, Heart, Repeat2,
  MessageCircle, Eye, Twitter, Instagram, Linkedin, MapPin,
  Music, Pause, Volume2, Film, Sun, Cloud, CloudRain, Snowflake,
  CloudLightning, Wind, Moon, CloudFog, Thermometer, Droplets,
  Settings, SlidersHorizontal, ChevronLeft, Star, BadgeCheck,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { diffLines } from 'diff';
import {
  detectToolUIType, safeParseImage, safeParseStatsDisplay, safeParseDataTable,
  safeParseApprovalCard, safeParseTerminal, safeParsePlan, safeParseOptionList,
  safeParseLinkPreview, safeParseProgressTracker, safeParseMessageDraft,
  safeParseOrderSummary, safeParseCitation,
  safeParseChart, safeParseCodeDiff, safeParseXPost, safeParseImageGallery,
  safeParseParameterSlider, safeParseQuestionFlow, safeParseItemCarousel,
  safeParsePreferencesPanel, safeParseWeather, safeParseAudio, safeParseVideo,
  safeParseGeoMap, safeParseInstagramPost, safeParseLinkedInPost,
  type SerializableImage, type SerializableStatsDisplay, type SerializableDataTable,
  type SerializableApprovalCard, type SerializableTerminal, type SerializablePlan,
  type SerializableOptionList, type SerializableLinkPreview,
  type SerializableProgressTracker, type SerializableMessageDraft,
  type SerializableOrderSummary, type SerializableCitation,
  type SerializableChart, type SerializableCodeDiff, type SerializableXPost,
  type SerializableImageGallery, type SerializableParameterSlider,
  type SerializableQuestionFlow, type SerializableItemCarousel,
  type SerializablePreferencesPanel, type SerializableWeather,
  type SerializableAudio, type SerializableVideo,
  type SerializableGeoMap, type SerializableInstagramPost, type SerializableLinkedInPost,
} from './schemas';

// ─── Main entry point ────────────────────────────────────────────────────────

interface ToolUIRendererProps {
  jsonString: string;
}

export const ToolUIRenderer = memo(function ToolUIRenderer({ jsonString }: ToolUIRendererProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    console.warn('[ToolUIRenderer] Non-critical:', err);
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
    case 'chart': {
      const d = safeParseChart(parsed);
      return d ? <ChartComponent {...d} /> : null;
    }
    case 'code-diff': {
      const d = safeParseCodeDiff(parsed);
      return d ? <CodeDiff {...d} /> : null;
    }
    case 'x-post': {
      const d = safeParseXPost(parsed);
      return d ? <XPost {...d} /> : null;
    }
    case 'image-gallery': {
      const d = safeParseImageGallery(parsed);
      return d ? <ImageGallery {...d} /> : null;
    }
    case 'parameter-slider': {
      const d = safeParseParameterSlider(parsed);
      return d ? <ParameterSlider {...d} /> : null;
    }
    case 'question-flow': {
      const d = safeParseQuestionFlow(parsed);
      return d ? <QuestionFlow {...d} /> : null;
    }
    case 'item-carousel': {
      const d = safeParseItemCarousel(parsed);
      return d ? <ItemCarousel {...d} /> : null;
    }
    case 'preferences-panel': {
      const d = safeParsePreferencesPanel(parsed);
      return d ? <PreferencesPanel {...d} /> : null;
    }
    case 'weather': {
      const d = safeParseWeather(parsed);
      return d ? <WeatherWidget {...d} /> : null;
    }
    case 'audio': {
      const d = safeParseAudio(parsed);
      return d ? <AudioPlayer {...d} /> : null;
    }
    case 'video': {
      const d = safeParseVideo(parsed);
      return d ? <VideoCard {...d} /> : null;
    }
    case 'geo-map': {
      const d = safeParseGeoMap(parsed);
      return d ? <GeoMap {...d} /> : null;
    }
    case 'instagram-post': {
      const d = safeParseInstagramPost(parsed);
      return d ? <InstagramPost {...d} /> : null;
    }
    case 'linkedin-post': {
      const d = safeParseLinkedInPost(parsed);
      return d ? <LinkedInPost {...d} /> : null;
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
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
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
      return value ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-[var(--mission-control-text-dim)] opacity-40" />;
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
    low: 'text-success bg-success/10 border-success/20',
    medium: 'text-warning bg-warning/10 border-warning/20',
    high: 'text-error bg-error/10 border-error/20',
    critical: 'text-error bg-error/15 border-error/30',
  };
  const RiskIcon = risk === 'critical' || risk === 'high' ? ShieldAlert : risk === 'medium' ? AlertTriangle : Info;

  return (
    <Card className="border-warning/25">
      {/* Top accent */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--color-warning)] to-[var(--color-warning)]/30" />
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-warning" />
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
                <span className={`text-right font-medium ${d.critical ? 'text-error' : 'text-[var(--mission-control-text)]'}`}>{d.value}</span>
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
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-success/10 text-success border border-success/25 hover:bg-success/20 transition-colors"
            >
              <CheckCircle2 size={12} />
              {confirmLabel ?? 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setDecided('rejected')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-error/10 text-error border border-error/25 hover:bg-error/20 transition-colors"
            >
              <XCircle size={12} />
              {cancelLabel ?? 'Reject'}
            </button>
          </div>
        ) : (
          <div className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium ${decided === 'approved' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
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
        <ExitIcon size={11} className={isSuccess ? 'text-success' : 'text-error'} />
        {exitCode !== undefined && (
          <span className={`text-[10px] font-medium ${isSuccess ? 'text-success' : 'text-error'}`}>
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
    'in-progress': { icon: Loader2,       color: 'text-info', bg: 'bg-info/10', spin: true },
    'done':        { icon: CheckCircle2,  color: 'text-success', bg: 'bg-success/10' },
    'skipped':     { icon: SkipForward,   color: 'text-[var(--mission-control-text-dim)] opacity-50', bg: 'bg-[var(--mission-control-border)]/20' },
    'blocked':     { icon: XCircle,       color: 'text-error', bg: 'bg-error/10' },
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
    running: <Loader2 size={11} className="text-info animate-spin" />,
    done:    <CheckCircle2 size={11} className="text-success" />,
    failed:  <XCircle size={11} className="text-error" />,
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
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
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
                <span className={`text-xs tabular-nums flex-shrink-0 font-medium ${isDiscount ? 'text-success' : isTotal ? 'text-[var(--mission-control-accent)] text-sm font-bold' : 'text-[var(--mission-control-text)]'}`}>
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
            className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${ctaClicked ? 'bg-success/10 text-success border border-success/25' : 'bg-[var(--mission-control-accent)] text-white hover:opacity-90'}`}
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

// ─── Chart ────────────────────────────────────────────────────────────────────

const CHART_PALETTE = ['#60a5fa', '#a78bfa', '#fbbf24', '#fb7185', '#22d3ee', '#4ade80', '#f97316', '#e879f9'];

function fmtNum(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function ChartComponent({ chartType = 'bar', title, subtitle, data, series, xKey = 'label', height = 220, stacked }: SerializableChart) {
  const resolvedSeries = series ?? [{ key: Object.keys(data[0] ?? {}).find(k => k !== xKey) ?? 'value' }];

  const stackProp = stacked ? { stackId: 'a' } : {};

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-[var(--mission-control-border)] bg-[var(--mission-control-surface)] px-3 py-2 text-xs shadow-lg">
        {label && <p className="text-[var(--mission-control-text-dim)] mb-1">{label}</p>}
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name ?? p.dataKey}: {typeof p.value === 'number' ? fmtNum(p.value) : p.value}</p>
        ))}
      </div>
    );
  };

  const axisProps = {
    tick: { fontSize: 10, fill: 'var(--mission-control-text-dim)' },
    axisLine: { stroke: 'var(--mission-control-border)' },
    tickLine: false,
  };

  const renderChart = () => {
    if (chartType === 'pie') {
      return (
        <PieChart>
          <Pie data={data} dataKey={resolvedSeries[0].key} nameKey={xKey} cx="50%" cy="50%" outerRadius={80} label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </PieChart>
      );
    }

    const commonChildren = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--mission-control-border)', fillOpacity: 0.3 }} />
        {resolvedSeries.map((s, i) => {
          const color = CHART_PALETTE[i % CHART_PALETTE.length];
          if (chartType === 'line') return <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={color} strokeWidth={2} dot={false} />;
          if (chartType === 'area') return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} {...stackProp} />;
          return <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={color} radius={[3, 3, 0, 0]} {...stackProp} />;
        })}
      </>
    );

    if (chartType === 'line') return <LineChart data={data}>{commonChildren}</LineChart>;
    if (chartType === 'area') return <AreaChart data={data}>{commonChildren}</AreaChart>;
    return <BarChart data={data}>{commonChildren}</BarChart>;
  };

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={<BarChart3 size={14} />} />
      {resolvedSeries.length > 1 && (
        <div className="flex gap-3 px-4 pt-2 flex-wrap">
          {resolvedSeries.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
              <span className="text-[10px] text-[var(--mission-control-text-dim)]">{s.label ?? s.key}</span>
            </div>
          ))}
        </div>
      )}
      <div className="px-2 py-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ─── Code Diff ────────────────────────────────────────────────────────────────

function CodeDiff({ before, after, language, filename, context = 3 }: SerializableCodeDiff) {
  const changes = diffLines(before, after);

  // Build line-by-line view with context windowing
  type DiffLine = { text: string; type: 'added' | 'removed' | 'context'; lineNumBefore?: number; lineNumAfter?: number };
  const lines: DiffLine[] = [];
  let lineNumBefore = 1;
  let lineNumAfter = 1;

  for (const change of changes) {
    const rawLines = change.value.split('\n');
    if (rawLines[rawLines.length - 1] === '') rawLines.pop();
    if (change.removed) {
      rawLines.forEach(l => { lines.push({ text: l, type: 'removed', lineNumBefore: lineNumBefore++ }); });
    } else if (change.added) {
      rawLines.forEach(l => { lines.push({ text: l, type: 'added', lineNumAfter: lineNumAfter++ }); });
    } else {
      rawLines.forEach(l => { lines.push({ text: l, type: 'context', lineNumBefore: lineNumBefore++, lineNumAfter: lineNumAfter++ }); });
    }
  }

  const added = lines.filter(l => l.type === 'added').length;
  const removed = lines.filter(l => l.type === 'removed').length;

  return (
    <Card className="font-mono">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--mission-control-border)] bg-[var(--mission-control-bg)]">
        <FileText size={12} className="text-[var(--mission-control-accent)]" />
        <span className="text-xs font-medium text-[var(--mission-control-text)] flex-1 truncate">{filename ?? 'diff'}</span>
        {language && <span className="text-[10px] text-[var(--mission-control-text-dim)] px-1.5 py-0.5 rounded bg-[var(--mission-control-border)]/50">{language}</span>}
        <span className="text-[10px] font-medium text-success">+{added}</span>
        <span className="text-[10px] font-medium text-error">-{removed}</span>
        <CopyButton text={after} />
      </div>
      <div className="overflow-auto max-h-[480px]">
        <table className="w-full text-[11px] leading-5 border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const bg = line.type === 'added' ? 'rgba(74,222,128,0.08)' : line.type === 'removed' ? 'rgba(251,113,133,0.08)' : undefined;
              const gutter = line.type === 'added' ? 'rgba(74,222,128,0.15)' : line.type === 'removed' ? 'rgba(251,113,133,0.15)' : undefined;
              const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
              const textColor = line.type === 'added' ? '#4ade80' : line.type === 'removed' ? '#fb7185' : 'var(--mission-control-text-dim)';
              return (
                <tr key={i} style={{ background: bg }}>
                  <td className="select-none px-2 py-0 text-right tabular-nums w-8 border-r border-[var(--mission-control-border)]/30" style={{ background: gutter, color: 'var(--mission-control-text-dim)' }}>
                    {line.type !== 'added' ? line.lineNumBefore ?? '' : ''}
                  </td>
                  <td className="select-none px-2 py-0 text-right tabular-nums w-8 border-r border-[var(--mission-control-border)]/30" style={{ background: gutter, color: 'var(--mission-control-text-dim)' }}>
                    {line.type !== 'removed' ? line.lineNumAfter ?? '' : ''}
                  </td>
                  <td className="select-none w-4 text-center py-0" style={{ color: textColor }}>{prefix}</td>
                  <td className="px-3 py-0 whitespace-pre" style={{ color: line.type === 'context' ? 'var(--mission-control-text)' : textColor }}>
                    {line.text || '\u00A0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── X Post ───────────────────────────────────────────────────────────────────

function fmtStat(n: number | undefined) {
  if (n === undefined) return null;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function XPost({ username, handle, avatarUrl, content, likes, retweets, replies, views, postedAt, verified, mediaUrl }: SerializableXPost) {
  return (
    <Card>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--mission-control-border)] flex-shrink-0 flex items-center justify-center">
            {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : <Twitter size={16} className="text-[var(--mission-control-text-dim)]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-[var(--mission-control-text)] truncate">{username}</span>
              {verified && <BadgeCheck size={14} className="text-sky-400 flex-shrink-0" />}
            </div>
            {handle && <p className="text-xs text-[var(--mission-control-text-dim)]">@{handle.replace(/^@/, '')}</p>}
          </div>
          <Twitter size={16} className="text-[var(--mission-control-text-dim)] flex-shrink-0 opacity-60" />
        </div>

        {/* Content */}
        <p className="text-sm text-[var(--mission-control-text)] leading-relaxed whitespace-pre-wrap mb-3">{content}</p>

        {/* Media */}
        {mediaUrl && (
          <div className="rounded-xl overflow-hidden mb-3 border border-[var(--mission-control-border)]">
            <img src={mediaUrl} alt="" className="w-full object-cover max-h-64" />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-5 text-[var(--mission-control-text-dim)]">
          {replies !== undefined && (
            <span className="flex items-center gap-1.5 text-xs hover:text-sky-400 transition-colors cursor-default">
              <MessageCircle size={14} />{fmtStat(replies)}
            </span>
          )}
          {retweets !== undefined && (
            <span className="flex items-center gap-1.5 text-xs hover:text-green-400 transition-colors cursor-default">
              <Repeat2 size={14} />{fmtStat(retweets)}
            </span>
          )}
          {likes !== undefined && (
            <span className="flex items-center gap-1.5 text-xs hover:text-rose-400 transition-colors cursor-default">
              <Heart size={14} />{fmtStat(likes)}
            </span>
          )}
          {views !== undefined && (
            <span className="flex items-center gap-1.5 text-xs ml-auto cursor-default">
              <Eye size={14} />{fmtStat(views)}
            </span>
          )}
        </div>

        {postedAt && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-2 opacity-60">{postedAt}</p>}
      </div>
    </Card>
  );
}

// ─── Image Gallery ────────────────────────────────────────────────────────────

function ImageGallery({ title, images, columns = 3 }: SerializableImageGallery) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const cols = Math.min(Math.max(1, columns), 4);
  const gridClass = cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <Card>
      {title && <CardHeader title={title} icon={<ImageIcon size={14} />} />}
      <div className={`grid ${gridClass} gap-1 p-2`}>
        {images.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-lg cursor-pointer group bg-[var(--mission-control-bg)]"
            onClick={() => setLightbox(i)}
          >
            <img src={img.src} alt={img.alt ?? ''} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
            {img.caption && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <p className="text-white text-[10px] line-clamp-2">{img.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-3 pb-2 text-[10px] text-[var(--mission-control-text-dim)]">{images.length} image{images.length !== 1 ? 's' : ''}</div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={images[lightbox].src} alt={images[lightbox].alt ?? ''} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
            {images[lightbox].caption && <p className="text-white/80 text-sm text-center mt-2">{images[lightbox].caption}</p>}
            <button type="button" onClick={() => setLightbox(null)} className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm">×</button>
            {lightbox > 0 && <button type="button" onClick={() => setLightbox(l => l! - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"><ChevronLeft size={16} /></button>}
            {lightbox < images.length - 1 && <button type="button" onClick={() => setLightbox(l => l! + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"><ChevronRight size={16} /></button>}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Parameter Slider ─────────────────────────────────────────────────────────

function ParameterSlider({ title, description, params }: SerializableParameterSlider) {
  const [values, setValues] = useState<Record<string, number>>(
    () => Object.fromEntries(params.map(p => [p.id, p.default]))
  );

  return (
    <Card>
      <CardHeader title={title} subtitle={description} icon={<SlidersHorizontal size={14} />} />
      <div className="px-4 py-3 space-y-5">
        {params.map(param => {
          const val = values[param.id] ?? param.default;
          const pct = ((val - param.min) / (param.max - param.min)) * 100;
          return (
            <div key={param.id}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-medium text-[var(--mission-control-text)]">{param.label}</span>
                <span className="text-sm font-bold text-[var(--mission-control-accent)] tabular-nums">
                  {val}{param.unit ? ` ${param.unit}` : ''}
                </span>
              </div>
              {param.description && <p className="text-[10px] text-[var(--mission-control-text-dim)] mb-2">{param.description}</p>}
              <div className="relative h-4 flex items-center">
                <div className="w-full h-1.5 rounded-full bg-[var(--mission-control-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--mission-control-accent)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 1}
                  value={val}
                  onChange={e => setValues(prev => ({ ...prev, [param.id]: Number(e.target.value) }))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[9px] text-[var(--mission-control-text-dim)] mt-1">
                <span>{param.min}{param.unit ? ` ${param.unit}` : ''}</span>
                <span>{param.max}{param.unit ? ` ${param.unit}` : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Question Flow ────────────────────────────────────────────────────────────

function QuestionFlow({ title, description, questions, submitLabel = 'Submit' }: SerializableQuestionFlow) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  const q = questions[current];
  const isLast = current === questions.length - 1;
  const progress = ((current) / questions.length) * 100;

  const answer = answers[q?.id ?? ''];
  const canProceed = !q?.required || (Array.isArray(answer) ? answer.length > 0 : Boolean(answer));

  if (submitted) {
    return (
      <Card>
        <div className="p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-success" />
          <p className="text-sm font-semibold text-[var(--mission-control-text)]">Responses submitted</p>
          <p className="text-xs text-[var(--mission-control-text-dim)] mt-1">{questions.length} question{questions.length !== 1 ? 's' : ''} answered</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {title && <CardHeader title={title} subtitle={description} icon={<MessageCircle size={14} />} />}
      <div className="px-4 pt-2 pb-1">
        <div className="h-1 rounded-full bg-[var(--mission-control-border)] mb-3">
          <div className="h-full rounded-full bg-[var(--mission-control-accent)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] text-[var(--mission-control-text-dim)] mb-3">{current + 1} / {questions.length}</p>
      </div>

      <div className="px-4 pb-4">
        <p className="text-sm font-semibold text-[var(--mission-control-text)] mb-3">
          {q.question}{q.required && <span className="text-error ml-1">*</span>}
        </p>

        {(q.type === 'choice' || q.type === 'yes-no') && (
          <div className="space-y-2">
            {(q.type === 'yes-no' ? ['Yes', 'No'] : q.options ?? []).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { setAnswers(prev => ({ ...prev, [q.id]: opt })); if (!isLast) setTimeout(() => setCurrent(c => c + 1), 200); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${answers[q.id] === opt ? 'border-[var(--mission-control-accent)] bg-[var(--mission-control-accent)]/8 text-[var(--mission-control-accent)]' : 'border-[var(--mission-control-border)] hover:border-[var(--mission-control-accent)]/40 text-[var(--mission-control-text)]'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.type === 'multi-choice' && (
          <div className="space-y-2">
            {(q.options ?? []).map(opt => {
              const sel = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const prev = (answers[q.id] as string[] | undefined) ?? [];
                    setAnswers(a => ({ ...a, [q.id]: sel ? prev.filter(v => v !== opt) : [...prev, opt] }));
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${sel ? 'border-[var(--mission-control-accent)] bg-[var(--mission-control-accent)]/8 text-[var(--mission-control-accent)]' : 'border-[var(--mission-control-border)] hover:border-[var(--mission-control-accent)]/40 text-[var(--mission-control-text)]'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${sel ? 'border-[var(--mission-control-accent)] bg-[var(--mission-control-accent)]' : 'border-[var(--mission-control-border)]'}`}>
                      {sel && <Check size={9} className="text-white" />}
                    </span>
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'rating' && (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setAnswers(prev => ({ ...prev, [q.id]: String(n) }))}
                className="transition-transform hover:scale-110"
              >
                <Star size={24} className={Number(answers[q.id]) >= n ? 'text-warning fill-current' : 'text-[var(--mission-control-border)]'} />
              </button>
            ))}
          </div>
        )}

        {(!q.type || q.type === 'text') && (
          <textarea
            rows={3}
            value={(answers[q.id] as string) ?? ''}
            onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            placeholder={q.placeholder ?? 'Your answer…'}
            className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)] text-[var(--mission-control-text)] placeholder-[var(--mission-control-text-dim)] outline-none focus:border-[var(--mission-control-accent)] resize-none"
          />
        )}

        <div className="flex items-center gap-2 mt-4">
          {current > 0 && (
            <button type="button" onClick={() => setCurrent(c => c - 1)} className="px-3 py-1.5 rounded-lg border border-[var(--mission-control-border)] text-xs text-[var(--mission-control-text-dim)] hover:text-[var(--mission-control-text)] transition-colors">
              Back
            </button>
          )}
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => isLast ? setSubmitted(true) : setCurrent(c => c + 1)}
            className="ml-auto px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--mission-control-accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {isLast ? submitLabel : 'Next'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─── Item Carousel ────────────────────────────────────────────────────────────

function ItemCarousel({ title, items }: SerializableItemCarousel) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });

  return (
    <Card>
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--mission-control-border)]">
          <span className="text-sm font-semibold text-[var(--mission-control-text)]">{title}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => scroll(-1)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--mission-control-border)]/40 text-[var(--mission-control-text-dim)] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button type="button" onClick={() => scroll(1)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--mission-control-border)]/40 text-[var(--mission-control-text-dim)] transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
      <div ref={ref} className="flex gap-3 p-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => {
          const Wrapper = item.href ? 'a' : 'div';
          const wrapperProps = item.href ? { href: item.href, target: '_blank' as const, rel: 'noopener noreferrer' } : {};
          return (
            <Wrapper key={item.id} {...wrapperProps} className="flex-shrink-0 w-40 rounded-xl border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)] overflow-hidden hover:border-[var(--mission-control-accent)]/40 transition-colors group block">
              {item.image && (
                <div className="h-24 overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                </div>
              )}
              <div className="p-2.5">
                {item.badge && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--mission-control-accent)]/10 text-[var(--mission-control-accent)] border border-[var(--mission-control-accent)]/20 mb-1 inline-block">{item.badge}</span>
                )}
                <p className="text-xs font-semibold text-[var(--mission-control-text)] line-clamp-2 leading-tight">{item.title}</p>
                {item.subtitle && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-0.5 line-clamp-1">{item.subtitle}</p>}
                {item.meta && <p className="text-[10px] text-[var(--mission-control-accent)] mt-1">{item.meta}</p>}
              </div>
            </Wrapper>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Preferences Panel ────────────────────────────────────────────────────────

function PreferencesPanel({ title, groups }: SerializablePreferencesPanel) {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => {
      const init: Record<string, unknown> = {};
      for (const g of groups) for (const p of g.prefs) init[p.id] = p.value;
      return init;
    }
  );

  return (
    <Card>
      <CardHeader title={title ?? 'Preferences'} icon={<Settings size={14} />} />
      <div className="divide-y divide-[var(--mission-control-border)]/50">
        {groups.map((group, gi) => (
          <div key={gi} className="px-4 py-3 space-y-3">
            {group.label && <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mission-control-text-dim)] mb-2">{group.label}</p>}
            {group.prefs.map(pref => {
              const val = values[pref.id];
              const type = pref.type ?? 'toggle';
              return (
                <div key={pref.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--mission-control-text)]">{pref.label}</p>
                    {pref.description && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-0.5">{pref.description}</p>}
                  </div>
                  {type === 'toggle' && (
                    <button
                      type="button"
                      onClick={() => setValues(prev => ({ ...prev, [pref.id]: !prev[pref.id] }))}
                      className={`flex-shrink-0 w-9 h-5 rounded-full border transition-all ${val ? 'bg-[var(--mission-control-accent)] border-[var(--mission-control-accent)]' : 'bg-[var(--mission-control-border)] border-[var(--mission-control-border)]'}`}
                    >
                      <span className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  )}
                  {type === 'select' && pref.options && (
                    <select
                      value={String(val ?? '')}
                      onChange={e => setValues(prev => ({ ...prev, [pref.id]: e.target.value }))}
                      className="text-xs px-2 py-1 rounded-lg border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)] text-[var(--mission-control-text)] outline-none focus:border-[var(--mission-control-accent)]"
                    >
                      {pref.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {(type === 'text' || type === 'number') && (
                    <input
                      type={type}
                      value={String(val ?? '')}
                      onChange={e => setValues(prev => ({ ...prev, [pref.id]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                      className="text-xs px-2 py-1 rounded-lg border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)] text-[var(--mission-control-text)] outline-none focus:border-[var(--mission-control-accent)] w-24"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Weather Widget ───────────────────────────────────────────────────────────

const WEATHER_ICONS: Record<string, React.ReactNode> = {
  sunny: <Sun size={40} className="text-amber-400" />,
  cloudy: <Cloud size={40} className="text-slate-400" />,
  rainy: <CloudRain size={40} className="text-sky-400" />,
  snowy: <Snowflake size={40} className="text-sky-200" />,
  stormy: <CloudLightning size={40} className="text-violet-400" />,
  'partly-cloudy': <Cloud size={40} className="text-slate-300" />,
  foggy: <CloudFog size={40} className="text-slate-400" />,
  windy: <Wind size={40} className="text-teal-400" />,
  'clear-night': <Moon size={40} className="text-indigo-300" />,
};

const WEATHER_COND_SMALL: Record<string, React.ReactNode> = {
  sunny: <Sun size={14} className="text-amber-400" />,
  cloudy: <Cloud size={14} className="text-slate-400" />,
  rainy: <CloudRain size={14} className="text-sky-400" />,
  snowy: <Snowflake size={14} className="text-sky-200" />,
  stormy: <CloudLightning size={14} className="text-violet-400" />,
  'partly-cloudy': <Cloud size={14} className="text-slate-300" />,
  foggy: <CloudFog size={14} className="text-slate-400" />,
  windy: <Wind size={14} className="text-teal-400" />,
  'clear-night': <Moon size={14} className="text-indigo-300" />,
};

function WeatherWidget({ location, condition, temperature, unit = 'F', humidity, windSpeed, windUnit = 'mph', feelsLike, uvIndex, forecast }: SerializableWeather) {
  return (
    <Card>
      <div className="p-4">
        {/* Main */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-[var(--mission-control-text-dim)] flex items-center gap-1 mb-1">
              <MapPin size={11} />{location}
            </p>
            {temperature !== undefined && (
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-[var(--mission-control-text)] tabular-nums leading-none">{temperature}</span>
                <span className="text-xl text-[var(--mission-control-text-dim)]">°{unit}</span>
              </div>
            )}
            {feelsLike !== undefined && (
              <p className="text-xs text-[var(--mission-control-text-dim)] mt-1">Feels like {feelsLike}°{unit}</p>
            )}
            {condition && (
              <p className="text-sm text-[var(--mission-control-text)] mt-1 capitalize">{condition.replace('-', ' ')}</p>
            )}
          </div>
          <div className="flex-shrink-0 mt-1">
            {condition ? WEATHER_ICONS[condition] ?? <Sun size={40} className="text-amber-400" /> : <Thermometer size={40} className="text-[var(--mission-control-text-dim)]" />}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {humidity !== undefined && (
            <div className="rounded-lg bg-[var(--mission-control-bg)] border border-[var(--mission-control-border)] p-2 text-center">
              <Droplets size={14} className="mx-auto mb-1 text-sky-400" />
              <p className="text-sm font-bold text-[var(--mission-control-text)]">{humidity}%</p>
              <p className="text-[10px] text-[var(--mission-control-text-dim)]">Humidity</p>
            </div>
          )}
          {windSpeed !== undefined && (
            <div className="rounded-lg bg-[var(--mission-control-bg)] border border-[var(--mission-control-border)] p-2 text-center">
              <Wind size={14} className="mx-auto mb-1 text-teal-400" />
              <p className="text-sm font-bold text-[var(--mission-control-text)]">{windSpeed}</p>
              <p className="text-[10px] text-[var(--mission-control-text-dim)]">{windUnit}</p>
            </div>
          )}
          {uvIndex !== undefined && (
            <div className="rounded-lg bg-[var(--mission-control-bg)] border border-[var(--mission-control-border)] p-2 text-center">
              <Sun size={14} className="mx-auto mb-1 text-amber-400" />
              <p className="text-sm font-bold text-[var(--mission-control-text)]">{uvIndex}</p>
              <p className="text-[10px] text-[var(--mission-control-text-dim)]">UV Index</p>
            </div>
          )}
        </div>

        {/* Forecast */}
        {forecast && forecast.length > 0 && (
          <div className="border-t border-[var(--mission-control-border)] pt-3">
            <div className="flex justify-between gap-1">
              {forecast.map((day, i) => (
                <div key={i} className="flex-1 text-center">
                  <p className="text-[10px] text-[var(--mission-control-text-dim)] mb-1">{day.day}</p>
                  <div className="flex justify-center mb-1">
                    {day.condition ? WEATHER_COND_SMALL[day.condition] ?? <Sun size={14} className="text-amber-400" /> : <Sun size={14} className="text-amber-400" />}
                  </div>
                  <p className="text-[10px] font-semibold text-[var(--mission-control-text)]">{day.high}°</p>
                  <p className="text-[10px] text-[var(--mission-control-text-dim)]">{day.low}°</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({ title, artist, duration, src, coverUrl, genre, album, waveform }: SerializableAudio) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = useCallback(() => {
    if (!src) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current!;
        if (a.duration) setProgress((a.currentTime / a.duration) * 100);
      };
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(err => console.warn('[ToolUIRenderer] Non-critical:', err)); setPlaying(true); }
  }, [playing, src]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
    setProgress(pct * 100);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const currentTime = audioRef.current ? audioRef.current.currentTime : 0;

  const bars = waveform ?? Array.from({ length: 60 }, (_, i) => 0.2 + 0.7 * Math.abs(Math.sin(i * 0.4)));

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--mission-control-border)] flex items-center justify-center flex-shrink-0">
            {coverUrl ? <img src={coverUrl} alt={title} className="w-full h-full object-cover" /> : <Music size={20} className="text-[var(--mission-control-text-dim)]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--mission-control-text)] truncate">{title}</p>
            {artist && <p className="text-xs text-[var(--mission-control-text-dim)] truncate">{artist}</p>}
            {(album || genre) && <p className="text-[10px] text-[var(--mission-control-text-dim)] opacity-60 truncate">{[album, genre].filter(Boolean).join(' · ')}</p>}
          </div>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!src}
            className="w-10 h-10 rounded-full bg-[var(--mission-control-accent)] text-white flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
        </div>

        {/* Waveform / scrubber */}
        <div className="flex items-end gap-px h-10 cursor-pointer mb-2" onClick={seek}>
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-colors"
              style={{
                height: `${h * 100}%`,
                background: (i / bars.length) * 100 < progress
                  ? 'var(--mission-control-accent)'
                  : 'var(--mission-control-border)',
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] text-[var(--mission-control-text-dim)] tabular-nums">
          <span>{fmtTime(currentTime)}</span>
          {duration !== undefined && <span>{fmtTime(duration)}</span>}
        </div>
      </div>
    </Card>
  );
}

// ─── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ title, src, thumbnailUrl, duration, platform, embedId, description, author }: SerializableVideo) {
  const [playing, setPlaying] = useState(false);

  const fmtDur = (s: number) => s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const getEmbedUrl = () => {
    if (platform === 'youtube' && embedId) return `https://www.youtube.com/embed/${embedId}?autoplay=1`;
    if (platform === 'vimeo' && embedId) return `https://player.vimeo.com/video/${embedId}?autoplay=1`;
    if (platform === 'loom' && embedId) return `https://www.loom.com/embed/${embedId}?autoplay=1`;
    return null;
  };

  const embedUrl = getEmbedUrl();

  return (
    <Card>
      <div className="relative aspect-video overflow-hidden bg-[var(--mission-control-bg)]">
        {playing && embedUrl ? (
          <iframe
            src={embedUrl}
            allow="autoplay; fullscreen"
            className="w-full h-full border-0"
            title={title ?? 'Video'}
          />
        ) : playing && src ? (
          <video src={src} autoPlay controls className="w-full h-full" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center cursor-pointer group"
            onClick={() => setPlaying(true)}
          >
            {thumbnailUrl && <img src={thumbnailUrl} alt={title ?? ''} className="absolute inset-0 w-full h-full object-cover" />}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-colors backdrop-blur-sm">
                <Play size={22} className="text-white ml-1" />
              </div>
            </div>
            {duration !== undefined && (
              <span className="absolute bottom-2 right-2 text-[10px] font-medium text-white bg-black/70 px-1.5 py-0.5 rounded tabular-nums">{fmtDur(duration)}</span>
            )}
            {platform && (
              <span className="absolute top-2 left-2 text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded capitalize">{platform}</span>
            )}
          </div>
        )}
      </div>
      {(title || description || author) && (
        <div className="px-4 py-3">
          {title && <p className="text-sm font-semibold text-[var(--mission-control-text)] mb-0.5">{title}</p>}
          {author && <p className="text-xs text-[var(--mission-control-text-dim)]">{author}</p>}
          {description && <p className="text-xs text-[var(--mission-control-text-dim)] mt-1 line-clamp-2">{description}</p>}
        </div>
      )}
    </Card>
  );
}

// ─── Geo Map ──────────────────────────────────────────────────────────────────

function GeoMap({ title, locations }: SerializableGeoMap) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <Card>
      <div className="px-4 py-2.5 border-b border-[var(--mission-control-border)] flex items-center gap-2">
        <MapPin size={13} className="text-[var(--mission-control-accent)]" />
        <span className="text-sm font-semibold text-[var(--mission-control-text)] flex-1">{title ?? 'Locations'}</span>
        <span className="text-[10px] text-[var(--mission-control-text-dim)]">{locations.length} location{locations.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-[var(--mission-control-border)]/50">
        {locations.map((loc, i) => (
          <div
            key={i}
            className={`px-4 py-3 cursor-pointer transition-colors ${selected === i ? 'bg-[var(--mission-control-accent)]/5' : 'hover:bg-[var(--mission-control-bg)]/40'}`}
            onClick={() => setSelected(selected === i ? null : i)}
          >
            <div className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${selected === i ? 'bg-[var(--mission-control-accent)] text-white' : 'bg-[var(--mission-control-border)]/60 text-[var(--mission-control-text-dim)]'}`}>
                <span className="text-[10px] font-bold">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--mission-control-text)]">{loc.name}</p>
                {loc.address && <p className="text-[11px] text-[var(--mission-control-text-dim)] mt-0.5">{loc.address}</p>}
                {loc.type && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--mission-control-border)]/50 text-[var(--mission-control-text-dim)] mt-1 inline-block">{loc.type}</span>
                )}
                {selected === i && loc.note && (
                  <p className="text-[11px] text-[var(--mission-control-text)] mt-2 leading-relaxed">{loc.note}</p>
                )}
                {selected === i && loc.lat !== undefined && loc.lng !== undefined && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[var(--mission-control-accent)] hover:underline mt-2"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={9} />
                    View on Google Maps
                  </a>
                )}
              </div>
              {loc.lat !== undefined && loc.lng !== undefined && (
                <span className="text-[9px] text-[var(--mission-control-text-dim)] font-mono flex-shrink-0">
                  {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Instagram Post ───────────────────────────────────────────────────────────

function InstagramPost({ username, avatarUrl, verified, image, images, caption, likes, comments, postedAt, location }: SerializableInstagramPost) {
  const allImages = images ?? (image ? [image] : []);
  const [imgIndex, setImgIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  return (
    <Card className="max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--mission-control-border)]">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center flex-shrink-0">
          {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : <Instagram size={14} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-[var(--mission-control-text)]">{username}</span>
            {verified && <BadgeCheck size={12} className="text-sky-400 flex-shrink-0" />}
          </div>
          {location && <p className="text-[10px] text-[var(--mission-control-text-dim)]">{location}</p>}
        </div>
        <Instagram size={16} className="text-[var(--mission-control-text-dim)] opacity-60 flex-shrink-0" />
      </div>

      {/* Media */}
      {allImages.length > 0 && (
        <div className="relative aspect-square bg-[var(--mission-control-bg)]">
          <img src={allImages[imgIndex]} alt="" className="w-full h-full object-cover" />
          {allImages.length > 1 && (
            <>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {allImages.map((_, i) => (
                  <button key={i} type="button" onClick={() => setImgIndex(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-[var(--mission-control-accent)]' : 'bg-white/50'}`} />
                ))}
              </div>
              {imgIndex > 0 && <button type="button" onClick={() => setImgIndex(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white"><ChevronLeft size={14} /></button>}
              {imgIndex < allImages.length - 1 && <button type="button" onClick={() => setImgIndex(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white"><ChevronRight size={14} /></button>}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-3 mb-2">
          <button type="button" onClick={() => setLiked(l => !l)} className="transition-transform hover:scale-110 active:scale-90">
            <Heart size={20} className={liked ? 'text-rose-500 fill-current' : 'text-[var(--mission-control-text-dim)]'} />
          </button>
          <MessageCircle size={20} className="text-[var(--mission-control-text-dim)]" />
        </div>
        {(likes !== undefined || comments !== undefined) && (
          <div className="flex gap-3 text-xs text-[var(--mission-control-text-dim)] mb-1.5">
            {likes !== undefined && <span className="font-semibold text-[var(--mission-control-text)]">{(likes + (liked ? 1 : 0)).toLocaleString()} likes</span>}
            {comments !== undefined && <span>{comments.toLocaleString()} comments</span>}
          </div>
        )}
        {caption && (
          <p className="text-xs text-[var(--mission-control-text)] leading-relaxed">
            <span className="font-bold mr-1">{username}</span>{caption}
          </p>
        )}
        {postedAt && <p className="text-[10px] text-[var(--mission-control-text-dim)] mt-1 opacity-60 uppercase tracking-wide">{postedAt}</p>}
      </div>
    </Card>
  );
}

// ─── LinkedIn Post ────────────────────────────────────────────────────────────

function LinkedInPost({ authorName, authorTitle, authorCompany, avatarUrl, content, image, likes, comments, reposts, postedAt, hashtags }: SerializableLinkedInPost) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 200;
  const displayContent = isLong && !expanded ? content.slice(0, 200) + '…' : content;

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-[var(--mission-control-border)]">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--mission-control-border)] flex-shrink-0 flex items-center justify-center">
          {avatarUrl ? <img src={avatarUrl} alt={authorName} className="w-full h-full object-cover" /> : <Linkedin size={18} className="text-info" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--mission-control-text)]">{authorName}</p>
          {authorTitle && <p className="text-xs text-[var(--mission-control-text-dim)] truncate">{authorTitle}{authorCompany ? ` · ${authorCompany}` : ''}</p>}
          {postedAt && <p className="text-[10px] text-[var(--mission-control-text-dim)] opacity-60 mt-0.5">{postedAt}</p>}
        </div>
        <Linkedin size={16} className="text-info flex-shrink-0 opacity-70 mt-0.5" />
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-[var(--mission-control-text)] leading-relaxed whitespace-pre-wrap">
          {displayContent}
        </p>
        {isLong && (
          <button type="button" onClick={() => setExpanded(e => !e)} className="text-xs text-[var(--mission-control-accent)] hover:underline mt-1">
            {expanded ? 'Show less' : 'See more'}
          </button>
        )}
        {hashtags && hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {hashtags.map(tag => (
              <span key={tag} className="text-[11px] text-info">#{tag.replace(/^#/, '')}</span>
            ))}
          </div>
        )}
      </div>

      {/* Image */}
      {image && (
        <div className="border-t border-[var(--mission-control-border)] overflow-hidden">
          <img src={image} alt="" className="w-full object-cover max-h-64" />
        </div>
      )}

      {/* Reactions */}
      {(likes !== undefined || comments !== undefined || reposts !== undefined) && (
        <div className="px-4 py-2.5 border-t border-[var(--mission-control-border)] flex items-center gap-3 text-[11px] text-[var(--mission-control-text-dim)]">
          {likes !== undefined && <span className="flex items-center gap-1"><Heart size={11} className="text-rose-400" />{likes.toLocaleString()}</span>}
          {comments !== undefined && <span className="flex items-center gap-1"><MessageCircle size={11} />{comments.toLocaleString()} comments</span>}
          {reposts !== undefined && <span className="flex items-center gap-1"><Repeat2 size={11} />{reposts.toLocaleString()} reposts</span>}
        </div>
      )}
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
  ChartComponent as ToolUIChart,
  CodeDiff as ToolUICodeDiff,
  XPost as ToolUIXPost,
  ImageGallery as ToolUIImageGallery,
  ParameterSlider as ToolUIParameterSlider,
  QuestionFlow as ToolUIQuestionFlow,
  ItemCarousel as ToolUIItemCarousel,
  PreferencesPanel as ToolUIPreferencesPanel,
  WeatherWidget as ToolUIWeather,
  AudioPlayer as ToolUIAudio,
  VideoCard as ToolUIVideo,
  GeoMap as ToolUIGeoMap,
  InstagramPost as ToolUIInstagramPost,
  LinkedInPost as ToolUILinkedInPost,
};
