import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Zap, AlertCircle, ChevronDown, Info, Star, X } from 'lucide-react';
import { Box, Flex } from '@radix-ui/themes';
import { settingsApi } from '../lib/api';

// Priority indicator component
export function PriorityIndicator({ 
  level, 
  score, 
  size = 'sm',
  showLabel = true 
}: { 
  level: 'critical' | 'high' | 'normal' | 'low';
  score?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  const configs = {
    critical: {
      color: 'bg-error',
      textColor: 'text-error',
      label: 'Critical',
      icon: Zap,
      pulse: true
    },
    high: {
      color: 'bg-warning',
      textColor: 'text-warning',
      label: 'High',
      icon: AlertCircle,
      pulse: false
    },
    normal: {
      color: 'bg-info',
      textColor: 'text-info',
      label: 'Normal',
      icon: TrendingUp,
      pulse: false
    },
    low: {
      color: 'bg-mission-control-border',
      textColor: 'text-mission-control-text-dim',
      label: 'Low',
      icon: ChevronDown,
      pulse: false
    }
  };

  const config = configs[level];
  const Icon = config.icon;

  return (
    <Flex align="center" gap="2">
      <div className={`${sizeClasses[size]} ${config.color} rounded-full ${config.pulse ? 'animate-pulse' : ''}`} />
      {showLabel && (
        <>
          <Icon size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} className={config.textColor} />
          <span className={`text-xs font-medium ${config.textColor}`}>
            {config.label}
            {score !== undefined && ` (${Math.round(score)})`}
          </span>
        </>
      )}
    </Flex>
  );
}

// Priority explanation tooltip
export function PriorityExplanation({ 
  explanation, 
  senderStats 
}: { 
  explanation: any[];
  senderStats?: {
    importance: number;
    replyRate: number;
    avgResponseTime: number;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Why is this priority?"
        aria-label="Why is this priority?"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
      >
        <Info size={14} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-xl p-4 min-w-[320px] z-50">
          <Flex align="center" justify="between" mb="3">
            <h4 className="font-semibold text-sm">Priority Calculation</h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <X size={14} />
            </button>
          </Flex>
          
          <div className="space-y-2 mb-3">
            {explanation && explanation.map((factor: any, i: number) => (
              <Flex key={i} align="center" justify="between" className="text-xs">
                <Flex align="center" gap="2">
                  <span className="text-mission-control-text-dim">{factor.factor}</span>
                  <span className="text-mission-control-accent font-mono">{Math.round(factor.score)}</span>
                </Flex>
                <Flex align="center" gap="2">
                  <span className="text-mission-control-text-dim">×{factor.weight}</span>
                  <span className="font-semibold">=  {Math.round(factor.contribution)}</span>
                </Flex>
              </Flex>
            ))}
          </div>
          
          {senderStats && (
            <div className="border-t border-mission-control-border pt-3 mt-3">
              <h5 className="text-xs font-semibold text-mission-control-text-dim mb-2">Sender Profile</h5>
              <div className="space-y-1 text-xs">
                <Flex justify="between">
                  <span className="text-mission-control-text-dim">Importance:</span>
                  <span className="font-mono">{Math.round(senderStats.importance)}/100</span>
                </Flex>
                <Flex justify="between">
                  <span className="text-mission-control-text-dim">Reply Rate:</span>
                  <span className="font-mono">{Math.round(senderStats.replyRate)}%</span>
                </Flex>
                <Flex justify="between">
                  <span className="text-mission-control-text-dim">Avg Response:</span>
                  <span className="font-mono">{formatResponseTime(senderStats.avgResponseTime)}</span>
                </Flex>
              </div>
            </div>
          )}
          
          <div className="mt-3 pt-3 border-t border-mission-control-border">
            <p className="text-xs text-mission-control-text-dim italic">
              Priority adapts based on your interaction patterns
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatResponseTime(seconds: number): string {
  if (!seconds) return 'N/A';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

// Priority stats card
export function PriorityStats({ stats }: { stats: any }) {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
      <Flex align="center" gap="2" mb="3">
        <Star size={16} className="text-mission-control-accent" />
        <h3 className="font-semibold text-sm">Priority Stats</h3>
      </Flex>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-mission-control-text-dim mb-1">Critical</div>
          <div className="text-2xl font-bold text-error">{stats.critical || 0}</div>
        </div>
        <div>
          <div className="text-xs text-mission-control-text-dim mb-1">High</div>
          <div className="text-2xl font-bold text-warning">{stats.high || 0}</div>
        </div>
        <div>
          <div className="text-xs text-mission-control-text-dim mb-1">Normal</div>
          <div className="text-2xl font-bold text-info">{stats.normal || 0}</div>
        </div>
        <div>
          <div className="text-xs text-mission-control-text-dim mb-1">Low</div>
          <div className="text-2xl font-bold text-mission-control-text-dim">{stats.low || 0}</div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-mission-control-border">
        <Flex align="center" justify="between" className="text-xs">
          <span className="text-mission-control-text-dim">Avg Score</span>
          <span className="font-mono font-semibold">{stats.avgScore?.toFixed(1) || 'N/A'}</span>
        </Flex>
        <Flex align="center" justify="between" mt="1" className="text-xs">
          <span className="text-mission-control-text-dim">Learning</span>
          <span className="text-success font-medium">{stats.learnedSenders || 0} senders</span>
        </Flex>
      </div>
    </div>
  );
}

// Priority settings panel
export function PrioritySettings({ 
  config, 
  onUpdate 
}: { 
  config: any;
  onUpdate: (key: string, value: number) => void;
}) {
  const weights = [
    { key: 'weight_recency', label: 'Recency', desc: 'How recent the message is' },
    { key: 'weight_sender_importance', label: 'Sender', desc: 'Importance based on past interactions' },
    { key: 'weight_engagement_likelihood', label: 'Engagement', desc: 'Likelihood you\'ll engage' },
    { key: 'weight_urgency', label: 'Urgency', desc: 'Urgent keywords and flags' },
    { key: 'weight_content', label: 'Content', desc: 'Content analysis signals' }
  ];

  const thresholds = [
    { key: 'priority_threshold_critical', label: 'Critical', color: 'red' },
    { key: 'priority_threshold_high', label: 'High', color: 'orange' },
    { key: 'priority_threshold_low', label: 'Low', color: 'gray' }
  ];

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-4">Priority Weights</h3>
      
      <div className="space-y-3 mb-6">
        {weights.map(w => (
          <div key={w.key}>
            <Flex align="center" justify="between" mb="1">
              <div>
                <span className="text-xs font-medium">{w.label}</span>
                <p className="text-xs text-mission-control-text-dim">{w.desc}</p>
              </div>
              <span className="text-xs font-mono text-mission-control-accent">{config[w.key] || 0}%</span>
            </Flex>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={config[w.key] || 0}
              onChange={(e) => onUpdate(w.key, parseFloat(e.target.value))}
              className="w-full h-1 bg-mission-control-border rounded-lg appearance-none cursor-pointer accent-mission-control-accent"
            />
          </div>
        ))}
      </div>
      
      <h3 className="font-semibold text-sm mb-4">Priority Thresholds</h3>
      
      <div className="space-y-3">
        {thresholds.map(t => (
          <div key={t.key}>
            <Flex align="center" justify="between" mb="1">
              <span className="text-xs font-medium">{t.label}</span>
              <span className="text-xs font-mono text-mission-control-accent">{config[t.key] || 0}</span>
            </Flex>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={config[t.key] || 0}
              onChange={(e) => onUpdate(t.key, parseFloat(e.target.value))}
              className="w-full h-1 bg-mission-control-border rounded-lg appearance-none cursor-pointer accent-mission-control-accent"
            />
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-mission-control-border">
        <p className="text-xs text-mission-control-text-dim italic">
          Adjust weights to customize how priority is calculated. Changes take effect on next calculation.
        </p>
      </div>
    </div>
  );
}

// Hook for priority data
export function usePriorityData() {
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const result = await settingsApi.get('priority.stats');
      const stats = result?.value || result?.stats;
      if (stats) {
        setStats(stats);
      }
    } catch (e) {
      // 'Failed to fetch priority stats:', e;
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const result = await settingsApi.get('priority.config');
      const cfg = result?.value || result?.config;
      if (cfg) {
        setConfig(cfg);
      }
    } catch (e) {
      // 'Failed to fetch priority config:', e;
    }
  }, []);

  const updateConfig = useCallback(async (key: string, value: number) => {
    try {
      const result = await settingsApi.set('priority.config', { ...config, [key]: value });
      if (result) {
        setConfig((prev: any) => ({ ...prev, [key]: value }));
      }
    } catch (e) {
      // 'Failed to update config:', e;
    }
  }, [config]);

  const recalculate = useCallback(async (_limit = 100) => {
    try {
      await settingsApi.set('priority.recalculate', { limit: _limit });
      await fetchStats();
    } catch (e) {
      // 'Failed to recalculate priorities:', e;
    }
  }, [fetchStats]);

  useEffect(() => {
    Promise.all([fetchStats(), fetchConfig()]).finally(() => setLoading(false));
  }, [fetchStats, fetchConfig]);

  return {
    stats,
    config,
    loading,
    updateConfig,
    recalculate,
    refresh: () => Promise.all([fetchStats(), fetchConfig()])
  };
}

export default PriorityIndicator;
