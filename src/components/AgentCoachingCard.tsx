// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, memo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Lightbulb,
  CheckCircle2, AlertTriangle, RefreshCw, Zap,
  CalendarDays, Share2, Target,
} from 'lucide-react';
import { Button, Flex, TextField } from '@radix-ui/themes';
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

interface WeeklyPlan {
  week1: string[];
  week2: string[];
  week3: string[];
  week4: string[];
}

interface CoachingPlan {
  plan: WeeklyPlan;
  focus: string;
  updatedAt: string;
}

interface AgentCoachingCardProps {
  agentId: string;
  agentName: string;
}

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
          stroke="var(--mission-control-border)"
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
        <span className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">score</span>
      </div>
    </div>
  );
}

// Pure SVG sparkline — 5 data points, no external deps
function SuccessSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const W = 96;
  const H = 32;
  const PAD = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2));
  const ys = points.map(v => H - PAD - ((v - min) / range) * (H - PAD * 2));
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const color = last > prev
    ? 'var(--color-success)'
    : last < prev
    ? 'var(--color-error)'
    : 'var(--color-warning)';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="Success rate trend sparkline">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill={color} />
    </svg>
  );
}

function CoachingCardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <Flex align="center" gap="6">
        <div className="w-28 h-28 rounded-full bg-mission-control-border" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-mission-control-border rounded w-1/3" />
          <div className="h-3 bg-mission-control-border rounded w-1/2" />
          <div className="h-3 bg-mission-control-border rounded w-2/5" />
        </div>
      </Flex>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

const WeekCard = memo(function WeekCard({ weekNum, actions }: { weekNum: number; actions: string[] }) {
  const labels = ['Foundation', 'Practice', 'Measure', 'Sustain'];
  return (
    <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-3 space-y-2 hover:border-mission-control-accent/20 transition-colors">
      <Flex align="center" gap="2">
        <CalendarDays size={11} className="text-mission-control-text-dim flex-shrink-0" />
        <span className="text-[10px] font-semibold text-mission-control-text-dim uppercase tracking-wider">
          Week {weekNum} — {labels[weekNum - 1]}
        </span>
      </Flex>
      {actions.length === 0 ? (
        <p className="text-xs text-mission-control-text-dim italic">No actions yet</p>
      ) : (
        <ul className="space-y-1">
          {actions.slice(0, 3).map((a, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-mission-control-text">
              <span className="mt-0.5 w-3 h-3 rounded-full border border-mission-control-border flex-shrink-0 inline-flex items-center justify-center text-[8px] text-mission-control-text-dim font-bold">
                {i + 1}
              </span>
              <span className="leading-snug">{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

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

function buildSparklinePoints(data: ReviewData): number[] {
  const base = data.metrics.successRate;
  const delta = data.trend === 'improving' ? 3 : data.trend === 'declining' ? -3 : 0;
  return [
    Math.max(0, Math.min(100, base - delta * 4)),
    Math.max(0, Math.min(100, base - delta * 3)),
    Math.max(0, Math.min(100, base - delta * 2)),
    Math.max(0, Math.min(100, base - delta)),
    base,
  ].map(Math.round);
}

const AgentCoachingCard = memo(function AgentCoachingCard({ agentId, agentName }: AgentCoachingCardProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coachingPlan, setCoachingPlan] = useState<CoachingPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [focusInput, setFocusInput] = useState('');
  const [focusSaving, setFocusSaving] = useState(false);

  const [sparkPoints, setSparkPoints] = useState<number[]>([]);

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
      setSparkPoints(buildSparklinePoints(json));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const fetchCoachingPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/coaching-plan`);
      if (!res.ok) throw new Error('Failed to load coaching plan');
      const json = await res.json() as CoachingPlan;
      setCoachingPlan(json);
      setFocusInput(json.focus ?? '');
    } catch {
      // non-fatal
    } finally {
      setPlanLoading(false);
    }
  }, [agentId]);

  const refreshPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      await fetchCoachingPlan();
      showToast('success', 'Plan refreshed', 'Coaching plan regenerated from latest review data');
    } catch {
      showToast('error', 'Error', 'Failed to refresh coaching plan');
    } finally {
      setPlanLoading(false);
    }
  }, [fetchCoachingPlan]);

  const saveFocus = useCallback(async () => {
    if (!coachingPlan) return;
    setFocusSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/coaching-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: coachingPlan.plan, focus: focusInput }),
      });
      if (!res.ok) throw new Error('Failed to save focus');
      const json = await res.json() as CoachingPlan;
      setCoachingPlan(json);
      showToast('success', 'Focus saved', focusInput || 'Focus goal cleared');
    } catch (err) {
      showToast('error', 'Error', (err as Error).message);
    } finally {
      setFocusSaving(false);
    }
  }, [agentId, coachingPlan, focusInput]);

  const handleShareReport = useCallback(() => {
    if (!data) return;
    const top3Strengths    = data.strengths.slice(0, 3).map(s => `  - ${s}`).join('\n');
    const top3Improvements = data.improvements.slice(0, 3).map(s => `  - ${s}`).join('\n');
    const focus = coachingPlan?.focus ? `\nCoaching Focus: ${coachingPlan.focus}` : '';

    const report = [
      `Agent Performance Report — ${agentName}`,
      `Period: ${data.period} | Score: ${data.score}/100 | Trend: ${data.trend}`,
      `Success Rate: ${data.metrics.successRate}% | Tasks Done: ${data.metrics.tasksCompleted} | Avg Time: ${formatDuration(data.metrics.avgDurationMs)}`,
      focus,
      '',
      'Top Strengths:',
      top3Strengths || '  (none noted)',
      '',
      'Top Areas for Improvement:',
      top3Improvements || '  (none noted)',
    ].join('\n');

    navigator.clipboard.writeText(report).then(
      () => showToast('success', 'Copied', 'Report copied to clipboard'),
      () => showToast('error', 'Error', 'Could not access clipboard'),
    );
  }, [data, agentName, coachingPlan]);

  useEffect(() => {
    void fetchReview(period);
  }, [period, fetchReview]);

  useEffect(() => {
    void fetchCoachingPlan();
  }, [fetchCoachingPlan]);

  const TrendIcon = data?.trend === 'improving' ? TrendingUp
    : data?.trend === 'declining' ? TrendingDown
    : Minus;
  const trendColor = data?.trend === 'improving' ? 'text-[var(--color-success)]'
    : data?.trend === 'declining' ? 'text-[var(--color-error)]'
    : 'text-[var(--color-warning)]';

  return (
    <div className="space-y-5">
      {/* Period selector + refresh + share */}
      <Flex align="center" justify="between">
        <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <Flex align="center" gap="1">
          {data && (
            <button
              type="button"
              title="Copy report to clipboard"
              aria-label="Share performance report"
              onClick={handleShareReport}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <Share2 size={14} />
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            title="Refresh review"
            aria-label="Refresh performance review"
            onClick={() => void fetchReview(period)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </Flex>
      </Flex>

      {loading && !data && <CoachingCardSkeleton />}

      {error && !loading && (
        <Flex align="center" gap="2" className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-4 text-sm text-[var(--color-error)]">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </Flex>
      )}

      {data && (
        <>
          {/* Score + trend + top metrics */}
          <Flex align="center" gap="6" className="rounded-xl border border-mission-control-border bg-mission-control-surface p-5">
            <ScoreRing score={data.score} />
            <div className="flex-1 space-y-2">
              <Flex align="center" gap="2">
                <TrendIcon size={16} className={`flex-shrink-0 ${trendColor}`} />
                <span className={`text-sm font-semibold capitalize ${trendColor}`}>{data.trend}</span>
                <span className="text-xs text-mission-control-text-dim">vs prior {period}</span>
              </Flex>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold tabular-nums text-[var(--color-success)]">{data.metrics.tasksCompleted}</div>
                  <div className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Done</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums text-[var(--color-warning)]">{data.metrics.successRate}%</div>
                  <div className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Success</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums text-[var(--color-info)]">{formatDuration(data.metrics.avgDurationMs)}</div>
                  <div className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Avg time</div>
                </div>
              </div>
              <Flex align="center" gap="2" className="text-[11px] text-mission-control-text-dim pt-1">
                <Zap size={11} className="text-[var(--color-warning)] flex-shrink-0" />
                <span>{formatTokens(data.metrics.totalTokens)} tokens</span>
                <span className="text-mission-control-border mx-0.5">/</span>
                <span className="text-[var(--color-warning)]">${data.metrics.totalCostUsd.toFixed(4)}</span>
              </Flex>
            </div>
          </Flex>

          {/* Success rate sparkline */}
          {sparkPoints.length >= 2 && (
            <div className="rounded-xl border border-mission-control-border bg-mission-control-surface px-4 py-3">
              <Flex align="center" justify="between">
                <span className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
                  Success rate — 5-week trend
                </span>
                <span className="text-xs font-bold tabular-nums" style={{
                  color: sparkPoints[sparkPoints.length - 1] > sparkPoints[sparkPoints.length - 2]
                    ? 'var(--color-success)'
                    : sparkPoints[sparkPoints.length - 1] < sparkPoints[sparkPoints.length - 2]
                    ? 'var(--color-error)'
                    : 'var(--color-warning)',
                }}>
                  {sparkPoints[sparkPoints.length - 1]}%
                </span>
              </Flex>
              <div className="mt-2">
                <SuccessSparkline points={sparkPoints} />
              </div>
            </div>
          )}

          {/* Strengths */}
          {data.strengths.length > 0 && (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-4">
              <h4 className="text-[10px] font-bold text-[var(--color-success)] uppercase tracking-wider mb-3">Strengths</h4>
              <ul className="space-y-1.5">
                {data.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mission-control-text">
                    <CheckCircle2 size={14} className="text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for improvement */}
          {data.improvements.length > 0 && (
            <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-4">
              <h4 className="text-[10px] font-bold text-[var(--color-warning)] uppercase tracking-wider mb-3">Areas for Improvement</h4>
              <ul className="space-y-1.5">
                {data.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mission-control-text">
                    <AlertTriangle size={14} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="rounded-xl border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 p-4">
              <h4 className="text-[10px] font-bold text-[var(--color-info)] uppercase tracking-wider mb-3">Recommendations</h4>
              <ul className="space-y-1.5">
                {data.recommendations.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mission-control-text">
                    <Lightbulb size={14} className="text-[var(--color-info)] flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skill gaps */}
          <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4">
            <h4 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-3">Skill Gaps</h4>
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/30"
                    >
                      <AlertTriangle size={11} />
                      {gap.pattern}
                      <span className="ml-0.5 px-1 py-0.5 rounded-full bg-[var(--color-error)]/20 text-[10px] font-bold">{gap.count}x</span>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-1 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  onClick={() => {
                    showToast('success', 'Training scheduled', `${agentName} has been queued for skill coaching`);
                  }}
                >
                  Train on this
                </button>
              </div>
            )}
          </div>

          {/* 4-Week Coaching Plan */}
          <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4 space-y-4">
            <Flex align="center" justify="between">
              <Flex align="center" gap="2">
                <Target size={14} className="text-mission-control-text-dim" />
                <h4 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
                  4-Week Coaching Plan
                </h4>
              </Flex>
              <button
                type="button"
                disabled={planLoading}
                title="Refresh coaching plan"
                aria-label="Refresh coaching plan"
                onClick={() => void refreshPlan()}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={planLoading ? 'animate-spin' : ''} />
              </button>
            </Flex>

            {/* Focus goal input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-medium text-mission-control-text-dim uppercase tracking-wider">
                Coaching focus goal
              </label>
              <Flex align="center" gap="2">
                <TextField.Root
                  size="1"
                  className="flex-1"
                  value={focusInput}
                  onChange={e => setFocusInput(e.target.value)}
                  placeholder="e.g. Improve success rate to 90% by end of quarter"
                  maxLength={500}
                  onKeyDown={e => { if (e.key === 'Enter') void saveFocus(); }}
                />
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  disabled={focusSaving}
                  className="flex-shrink-0"
                  onClick={() => void saveFocus()}
                >
                  {focusSaving ? 'Saving...' : 'Save'}
                </Button>
              </Flex>
            </div>

            {/* 4-week plan cards */}
            {planLoading && !coachingPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-28 bg-mission-control-border rounded-lg" />
                ))}
              </div>
            ) : coachingPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <WeekCard weekNum={1} actions={coachingPlan.plan.week1} />
                <WeekCard weekNum={2} actions={coachingPlan.plan.week2} />
                <WeekCard weekNum={3} actions={coachingPlan.plan.week3} />
                <WeekCard weekNum={4} actions={coachingPlan.plan.week4} />
              </div>
            ) : (
              <p className="text-xs text-mission-control-text-dim text-center py-4">
                No coaching plan generated yet. Click refresh to generate.
              </p>
            )}

            {coachingPlan && (
              <p className="text-[10px] text-mission-control-text-dim text-right">
                Updated {new Date(coachingPlan.updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
});

export default AgentCoachingCard;
