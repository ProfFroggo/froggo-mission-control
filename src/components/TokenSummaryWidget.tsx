import { useState, useEffect } from 'react';
import { Zap, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface TokenSummary {
  totalTokens: number;
  totalCost: number;
  topAgent?: string;
  topAgentTokens?: number;
}

export default function TokenSummaryWidget() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTokenSummary();
    const interval = setInterval(loadTokenSummary, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadTokenSummary = async () => {
    try {
      const result = await window.clawdbot.tokens.summary({ period: 'day' });
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.by_agent && result.by_agent.length > 0) {
        const totalTokens = result.by_agent.reduce((sum: number, agent: any) => sum + agent.total_all, 0);
        const totalCost = result.by_agent.reduce((sum: number, agent: any) => sum + (agent.total_cost || 0), 0);
        
        // Find top agent by token usage
        const sorted = [...result.by_agent].sort((a: any, b: any) => b.total_all - a.total_all);
        const topAgent = sorted[0];

        setSummary({
          totalTokens,
          totalCost,
          topAgent: topAgent.agent,
          topAgentTokens: topAgent.total_all,
        });
      } else {
        setSummary({
          totalTokens: 0,
          totalCost: 0,
        });
      }
      
      setLoading(false);
      setError(null);
    } catch (err: unknown) {
      // 'Failed to load token summary:', err;
      setError(err.message || 'Failed to load');
      setLoading(false);
    }
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatCost = (cost: number): string => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(4)}`;
  };

  // Budget status (rough thresholds for now)
  const getBudgetStatus = () => {
    if (!summary) return 'unknown';
    const tokens = summary.totalTokens;
    if (tokens < 500000) return 'good'; // < 500K tokens
    if (tokens < 1000000) return 'warning'; // 500K-1M tokens
    return 'alert'; // > 1M tokens
  };

  const status = getBudgetStatus();

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clawd-accent"></div>
        <p className="text-xs text-clawd-text-dim mt-2">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <Zap size={32} className="text-clawd-text-dim/50 mb-2" />
        <p className="text-xs text-clawd-text-dim text-center">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <Zap size={32} className="text-clawd-text-dim/50 mb-2" />
        <p className="text-xs text-clawd-text-dim">No data</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-clawd-accent" />
        <h3 className="text-sm font-semibold text-clawd-text">Token Usage</h3>
        <span className="text-xs text-clawd-text-dim ml-auto">Today</span>
      </div>

      {/* Main stats */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        {/* Total tokens */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-clawd-text-dim">Total</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-clawd-text">{formatTokens(summary.totalTokens)}</span>
            <span className="text-xs text-clawd-text-dim">tokens</span>
          </div>
        </div>

        {/* Cost */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-clawd-text-dim">Cost</span>
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-clawd-text-dim" />
            <span className="text-lg font-semibold text-clawd-text">{formatCost(summary.totalCost)}</span>
          </div>
        </div>

        {/* Top agent */}
        {summary.topAgent && (
          <div className="flex items-baseline justify-between pt-2 border-t border-clawd-border">
            <span className="text-xs text-clawd-text-dim">Top</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-clawd-text capitalize">{summary.topAgent}</span>
              <span className="text-xs text-clawd-text-dim">({formatTokens(summary.topAgentTokens || 0)})</span>
            </div>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className={`mt-3 pt-3 border-t border-clawd-border flex items-center gap-2 text-xs ${
        status === 'good' ? 'text-success' :
        status === 'warning' ? 'text-warning' :
        'text-error'
      }`}>
        {status === 'good' ? (
          <>
            <TrendingDown size={14} />
            <span>On track</span>
          </>
        ) : status === 'warning' ? (
          <>
            <TrendingUp size={14} />
            <span>Elevated</span>
          </>
        ) : (
          <>
            <TrendingUp size={14} />
            <span>High usage</span>
          </>
        )}
      </div>
    </div>
  );
}
