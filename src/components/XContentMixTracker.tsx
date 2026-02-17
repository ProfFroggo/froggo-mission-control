// LEGACY: XContentMixTracker uses file-level suppression for intentional patterns.
// loadContentMix is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, AlertTriangle, Check } from 'lucide-react';

interface ContentMixData {
  type: string;
  count: number;
  target: number;
  color: string;
}

export const XContentMixTracker: React.FC = () => {
  const [mixData, setMixData] = useState<ContentMixData[]>([
    { type: 'Educational', count: 0, target: 40, color: '#3b82f6' },
    { type: 'Meme', count: 0, target: 30, color: '#f59e0b' },
    { type: 'Thread', count: 0, target: 20, color: '#10b981' },
    { type: 'Announcement', count: 0, target: 10, color: '#8b5cf6' },
  ]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    loadContentMix();
  }, [period]);

  const loadContentMix = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const now = Date.now();
      const daysBack = period === 'week' ? 7 : 30;
      const startDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Fetch posted drafts with content type metadata
      const result = await window.clawdbot?.xDraft?.list({ 
        status: 'posted',
      });

      if (result?.success) {
        const drafts = (result?.drafts ?? []).filter((d: unknown) => {
          const postedAt = (d as any).metadata ? JSON.parse((d as any).metadata).postedAt : 0;
          return postedAt >= startDate;
        });

        // Count by content type
        const counts: Record<string, number> = {
          'educational': 0,
          'meme': 0,
          'thread': 0,
          'announcement': 0,
        };

        for (const draft of drafts) {
          const metadata = (draft as any).metadata ? JSON.parse((draft as any).metadata) : {};
          const contentType = (metadata as any).content_type || 'educational';
          counts[contentType] = (counts[contentType] || 0) + 1;
        }

        // Update mix data
        setMixData(prev => prev.map(item => ({
          ...item,
          count: counts[item.type.toLowerCase()] || 0,
        })));
      }
    } catch (error) {
      // 'Error loading content mix:', error;
    } finally {
      setLoading(false);
    }
  };

  const getTotalPosts = () => {
    return mixData.reduce((sum, item) => sum + item.count, 0);
  };

  const getCurrentPercentage = (count: number) => {
    const total = getTotalPosts();
    return total > 0 ? (count / total) * 100 : 0;
  };

  const getDeviation = (item: ContentMixData) => {
    const current = getCurrentPercentage(item.count);
    return current - item.target;
  };

  const isOffTarget = (item: ContentMixData) => {
    const deviation = Math.abs(getDeviation(item));
    return deviation > 10; // More than 10% off target
  };

  const updateTarget = (type: string, newTarget: number) => {
    setMixData(prev => prev.map(item =>
      item.type === type ? { ...item, target: newTarget } : item
    ));
  };

  const renderMixBar = (item: ContentMixData) => {
    const currentPercent = getCurrentPercentage(item.count);
    const deviation = getDeviation(item);
    const offTarget = isOffTarget(item);

    return (
      <div key={item.type} className="mb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm font-medium text-clawd-text">{item.type}</span>
            <span className="text-xs text-clawd-text-dim">({item.count} posts)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-clawd-text-dim">
              {currentPercent.toFixed(1)}% / {item.target}%
            </span>
            {offTarget ? (
              <AlertTriangle size={14} className="text-warning" />
            ) : (
              <Check size={14} className="text-success" />
            )}
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-1">
          {/* Current */}
          <div className="relative h-6 bg-clawd-surface rounded overflow-hidden">
            <div
              className="absolute h-full transition-all duration-300"
              style={{
                width: `${Math.min(currentPercent, 100)}%`,
                backgroundColor: item.color,
                opacity: 0.8,
              }}
            />
            <div className="absolute inset-0 flex items-center px-2">
              <span className="text-xs font-medium text-clawd-text">Current</span>
            </div>
          </div>

          {/* Target */}
          <div className="relative h-2 bg-clawd-surface rounded overflow-hidden">
            <div
              className="absolute h-full transition-all duration-300"
              style={{
                width: `${item.target}%`,
                backgroundColor: item.color,
                opacity: 0.3,
              }}
            />
          </div>
        </div>

        {/* Deviation indicator */}
        {offTarget && (
          <div className="mt-1 text-xs text-warning flex items-center gap-1">
            <AlertTriangle size={12} />
            {deviation > 0 
              ? `${deviation.toFixed(1)}% over target`
              : `${Math.abs(deviation).toFixed(1)}% under target`
            }
          </div>
        )}

        {/* Target adjuster */}
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={`target-${item.type}`} className="text-xs text-clawd-text-dim">Target:</label>
          <input
            id={`target-${item.type}`}
            type="number"
            value={item.target}
            onChange={(e) => updateTarget(item.type, parseInt(e.target.value) || 0)}
            className="w-16 px-2 py-1 text-xs border border-clawd-border rounded"
            min="0"
            max="100"
          />
          <span className="text-xs text-clawd-text-dim">%</span>
        </div>
      </div>
    );
  };

  const getOverallStatus = () => {
    const offTargetCount = mixData.filter(isOffTarget).length;
    if (offTargetCount === 0) return 'on-target';
    if (offTargetCount <= 1) return 'minor-deviation';
    return 'major-deviation';
  };

  const statusClasses = (status: string) => {
    switch (status) {
      case 'on-target':
        return 'bg-success-subtle border-success-border';
      case 'minor-deviation':
        return 'bg-warning-subtle border-warning-border';
      default:
        return 'bg-error-subtle border-error-border';
    }
  };

  const status = getOverallStatus();
  const totalPosts = getTotalPosts();

  return (
    <div className="flex flex-col h-full bg-clawd-surface p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PieChart className="text-info" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-clawd-text">Content Mix Tracker</h2>
            <p className="text-sm text-clawd-text-dim">
              Monitor your content type distribution
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 text-sm rounded ${period === 'week' ? 'bg-info text-white' : 'border border-clawd-border text-clawd-text hover:bg-clawd-surface'}`}
          >
            Last Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 text-sm rounded ${period === 'month' ? 'bg-info text-white' : 'border border-clawd-border text-clawd-text hover:bg-clawd-surface'}`}
          >
            Last Month
          </button>
        </div>
      </div>

      {/* Overall status card */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${statusClasses(status)}`}>
        <div className="flex items-center gap-2 mb-1">
          {status === 'on-target' ? (
            <>
              <Check className="text-success" size={20} />
              <span className="font-medium text-clawd-text">Content Mix On Target</span>
            </>
          ) : status === 'minor-deviation' ? (
            <>
              <TrendingUp className="text-warning" size={20} />
              <span className="font-medium text-warning">Minor Deviation</span>
            </>
          ) : (
            <>
              <AlertTriangle className="text-error" size={20} />
              <span className="font-medium text-error">Major Deviation</span>
            </>
          )}
        </div>
        <p className="text-sm text-clawd-text-dim">
          {totalPosts} posts in the last {period === 'week' ? '7 days' : '30 days'}
        </p>
      </div>

      {/* Mix breakdown */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
          Loading content mix data...
        </div>
      ) : totalPosts === 0 ? (
        <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
          <div className="text-center">
            <PieChart size={48} className="mx-auto mb-2 text-clawd-text-dim" />
            <div>No posts in this period</div>
            <div className="text-xs mt-2">Start posting to track your content mix</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {mixData.map(renderMixBar)}
          
          {/* Recommendations */}
          <div className="mt-6 p-4 bg-clawd-surface rounded-lg border border-clawd-border">
            <div className="text-sm font-medium text-clawd-text mb-2">💡 Recommendations</div>
            <ul className="text-sm text-clawd-text space-y-1">
              {mixData.filter(isOffTarget).map(item => {
                const deviation = getDeviation(item);
                return (
                  <li key={item.type}>
                    {deviation > 0 
                      ? `Reduce ${item.type.toLowerCase()} content`
                      : `Increase ${item.type.toLowerCase()} content`
                    }
                  </li>
                );
              })}
              {mixData.filter(isOffTarget).length === 0 && (
                <li>Your content mix is well-balanced! Keep it up.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
