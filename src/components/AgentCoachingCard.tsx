// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Lightbulb,
  CheckCircle2, AlertTriangle, RefreshCw, Zap,
} from 'lucide-react';
import { showToast } from './Toast';

type Period = '7d' | '30d' | '90d';

interface SkillGap {
  pattern: string;
  count: number;
}

interface ReviewData {
  period: Period;
  agentId: string;
  agentName: string;
  metrics: {
    tasksCompleted: number;
    tasksRejected: number;
    successRate: number;
    avgDurationMs: number;
    totalTokens: number;
    totalCostUsd: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  skillGaps: SkillGap[];
  score: number;
}

interface AgentCoachingCardProps {
  agentId: string;
  agentName: string;
}

// SVG score ring — renders a circular progress indicator
function ScoreRing({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 75 ? 'var(--color-success)' : score >= 45 ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 112, height: 112 }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke="var(--color-mission-control-border)"
          strokeWidth="8"
        />
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] text-mission-control-text-dim uppercase tracking-wider">score</span>
      </div>
    </div>
  );
}

// Loading skeleton
function CoachingCardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-6">
        <div className="w-28 h-28 rounded-full bg-mission-control-border" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-mission-control-border rounded w-1/3" />
          <div className="h-3 bg-mission-control-border rounded w-1/2" />
          <div className="h-3 bg-mission-control-border rounded w-2/5" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-16 bg-mission-control-border rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map(i => <div key={i} className="h-4 bg-mission-control-border rounded w-full" />)}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function AgentCoachingCard({ agentId, agentName }: AgentCoachingCardProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: p }),
      });
      if (!res.ok) throw new Error('Failed to load review');
      const json = await res.json() as ReviewData;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchReview(period);
  }, [period, fetchReview]);

  const TrendIcon = data?.trend === 'improving' ? TrendingUp
    : data?.trend === 'declining' ? TrendingDown
    : Minus;
  const trendColor = data?.trend === 'improving' ? 'text-success'
    : data?.trend === 'declining' ? 'text-error'
    : 'text-warning';

  return (
    <div className="space-y-5">
      {/* Period selector + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => fetchReview(period)}
          disabled={loading}
          className="icon-btn border border-mission-control-border disabled:opacity-50"
          title="Refresh review"
          aria-label="Refresh performance review"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data && <CoachingCardSkeleton />}

      {error && !loading && (
        <div className="rounded-lg border border-error-border bg-error-subtle p-4 text-sm text-error flex items-center gap-2">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Score + trend + top metrics */}
          <div className="flex items-center gap-6 rounded-xl border border-mission-control-border bg-mission-control-bg p-5">
            <ScoreRing score={data.score} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <TrendIcon size={16} className={`flex-shrink-0 ${trendColor}`} />
                <span className={`text-sm font-semibold capitalize ${trendColor}`}>{data.trend}</span>
                <span className="text-xs text-mission-control-text-dim">vs prior {period}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold tabular-nums text-success">{data.metrics.tasksCompleted}</div>
                  <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">Done</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums text-warning">{data.metrics.successRate}%</div>
                  <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">Success</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums text-info">{formatDuration(data.metrics.avgDurationMs)}</div>
                  <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">Avg time</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-mission-control-text-dim pt-1">
                <Zap size={11} className="text-warning flex-shrink-0" />
                <span>{formatTokens(data.metrics.totalTokens)} tokens</span>
                <span className="text-mission-control-border mx-0.5">/</span>
                <span className="text-warning">${data.metrics.totalCostUsd.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Strengths */}
          {data.strengths.length > 0 && (
            <div className="rounded-xl border border-success-border bg-success-subtle p-4">
              <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-3">Strengths</h4>
              <ul className="space-y-1.5">
                {data.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mission-control-text">
                    <CheckCircle2 size={14} className="text-success flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for improvement */}
          {data.improvements.length > 0 && (
            <div className="rounded-xl border border-warning-border bg-warning-subtle p-4">
              <h4 className="text-xs font-semibold text-warning uppercase tracking-wider mb-3">Areas for Improvement</h4>
              <ul className="space-y-1.5">
                {data.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mission-control-text">
                    <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="rounded-xl border border-info-border bg-info-subtle p-4">
              <h4 className="text-xs font-semibold text-info uppercase tracking-wider mb-3">Recommendations</h4>
              <ul className="space-y-1.5">
                {data.recommendations.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mission-control-text">
                    <Lightbulb size={14} className="text-info flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skill gaps */}
          <div className="rounded-xl border border-mission-control-border p-4">
            <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-3">Skill Gaps</h4>
            {data.skillGaps.length === 0 ? (
              <p className="text-sm text-mission-control-text-dim">
                No recurring rejection patterns detected{data.metrics.tasksRejected === 0 ? ' — no rejected tasks this period' : ''}.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {data.skillGaps.map((gap) => (
                    <span
                      key={gap.pattern}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-error-subtle text-error border border-error-border"
                    >
                      <AlertTriangle size={11} />
                      {gap.pattern}
                      <span className="ml-0.5 px-1 py-0.5 rounded-full bg-error/20 text-[10px] font-bold">{gap.count}x</span>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    showToast('success', 'Training scheduled', `${agentName} has been queued for skill coaching`);
                  }}
                  className="mt-1 w-full py-2 text-sm font-medium rounded-lg border border-mission-control-border bg-mission-control-surface hover:bg-mission-control-border/50 text-mission-control-text transition-colors"
                >
                  Train on this
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
