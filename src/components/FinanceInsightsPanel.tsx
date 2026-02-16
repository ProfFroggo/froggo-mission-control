import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Lightbulb, Bell, Target, BarChart3, X, Loader2, RefreshCw } from 'lucide-react';
import { showToast } from './Toast';

interface Insight {
  id: string;
  type: string;
  title: string;
  content: string;
  severity: string;
  generated_at: number;
}

export default function FinanceInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
    
    // Refresh insights every 30 seconds
    const interval = setInterval(loadInsights, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await (window as any).clawdbot?.finance?.getInsights();
      
      if (result?.success) {
        setInsights(result.insights || []);
      } else {
        throw new Error(result?.error || 'Failed to load insights');
      }
    } catch (err: any) {
      console.error('[FinanceInsights] Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      showToast('info', 'Analyzing finances...', 'This may take a moment');
      
      const result = await window.clawdbot?.finance?.triggerAnalysis({
        daysBack: 7,
        focus: 'general'
      });
      
      if (result?.success) {
        showToast('success', 'Analysis complete!', 'New insights generated');
        // Reload insights to show new analysis
        await loadInsights();
      } else {
        throw new Error(result?.error || 'Analysis failed');
      }
    } catch (err: any) {
      console.error('[FinanceInsights] Analysis error:', err);
      showToast('error', 'Analysis failed', err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      const result = await window.clawdbot?.finance?.dismissInsight(insightId);
      
      if (result?.success) {
        // Remove from UI
        setInsights(prev => prev.filter(i => i.id !== insightId));
        showToast('success', 'Insight dismissed');
      } else {
        throw new Error(result?.error || 'Failed to dismiss insight');
      }
    } catch (err: any) {
      console.error('[FinanceInsights] Dismiss error:', err);
      showToast('error', 'Failed to dismiss insight');
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'spending_pattern':
        return <BarChart3 className="w-5 h-5" />;
      case 'anomaly':
        return <AlertTriangle className="w-5 h-5" />;
      case 'recommendation':
        return <Lightbulb className="w-5 h-5" />;
      case 'alert':
        return <Bell className="w-5 h-5" />;
      case 'budget_status':
        return <TrendingUp className="w-5 h-5" />;
      case 'goal_progress':
        return <Target className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-error-subtle border-error-border text-error';
      case 'warning':
        return 'bg-yellow-500/10 border-warning-border text-warning';
      default:
        return 'bg-info-subtle border-info-border text-info';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading && insights.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-clawd-text-dim" />
        <span className="ml-2 text-clawd-text-dim">Loading AI insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-subtle border border-error-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-error">
          <AlertTriangle className="w-5 h-5" />
          <span>Failed to load insights: {error}</span>
        </div>
        <button
          onClick={loadInsights}
          className="mt-2 text-sm text-error hover:text-error"
        >
          Retry
        </button>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8 text-clawd-text-dim">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 text-clawd-text-dim" />
        <p className="text-sm">No AI insights yet</p>
        <p className="text-xs mt-1">Upload transactions to get analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-warning" />
          AI Insights
          <span className="px-2 py-0.5 text-xs bg-warning-subtle text-warning rounded-full">
            {insights.length}
          </span>
        </h3>
        <button
          onClick={triggerAnalysis}
          disabled={analyzing}
          className="px-3 py-1.5 bg-clawd-accent hover:bg-clawd-accent/90 disabled:bg-clawd-bg-alt disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
          title="Run AI analysis on recent transactions"
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {insights.map((insight) => (
        <div
          key={insight.id}
          className={`rounded-lg border p-4 ${getSeverityStyles(insight.severity)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-0.5">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1">{insight.title}</h4>
                <div className="text-sm text-clawd-text whitespace-pre-wrap break-words">
                  {insight.content}
                </div>
                <div className="mt-2 text-xs text-clawd-text-dim">
                  {formatTimestamp(insight.generated_at)}
                </div>
              </div>
            </div>
            <button
              onClick={() => dismissInsight(insight.id)}
              className="p-1 hover:bg-clawd-bg-alt rounded transition-colors flex-shrink-0"
              title="Dismiss insight"
            >
              <X className="w-4 h-4 text-clawd-text-dim" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
